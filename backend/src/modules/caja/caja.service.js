// @ts-check
// Lógica de la caja: apertura de turno, resumen de lo vendido y cierre con arqueo.
//
// En el demo hay una sola caja por negocio: solo puede haber un turno abierto a la vez
// (lo garantiza un índice parcial en la base, ver la migración inicial).
//
// Arqueo: al cerrar, el cajero cuenta el efectivo. El sistema calcula cuánto debería haber
// (monto inicial + pagos en efectivo del turno) y guarda la diferencia:
//   diferencia > 0 → sobrante;  diferencia < 0 → faltante.
//
// Propinas: se pagan junto con la cuenta, así que los pagos las incluyen y la propina en
// efectivo queda en el cajón. El resumen las muestra aparte de las ventas porque no son
// del negocio sino de los trabajadores (Ley 1935 de 2018).
import { Prisma } from '@prisma/client';
import { ACCIONES, registrarAuditoria } from '../../lib/auditoria.js';
import { Decimal, aDecimal } from '../../lib/dinero.js';
import { AppError } from '../../lib/errors.js';
import { conNegocio } from '../../lib/negocio.js';

/** @typedef {import('../../lib/tokens.js').DatosSesion} DatosSesion */
/** @typedef {import('../../lib/negocio.js').TransaccionPrisma} TransaccionPrisma */
/** @typedef {'efectivo' | 'tarjeta' | 'transferencia' | 'otro'} MetodoPago */

/** Métodos de pago, en el orden en que se muestran en el resumen. */
const METODOS_PAGO = /** @type {const} */ (['efectivo', 'tarjeta', 'transferencia', 'otro']);

/** Estados de un pedido que todavía no se ha cobrado ni anulado. */
const ESTADOS_PEDIDO_ABIERTO = /** @type {const} */ (['abierto', 'enviado_a_cocina']);

/**
 * @typedef {object} ResumenTurno
 * @property {Record<MetodoPago, string>} ventasPorMetodo Total cobrado con cada método de pago, propinas incluidas.
 * @property {string} totalCobrado Suma de todos los pagos del turno (ventas + propinas).
 * @property {string} totalVendido Lo vendido por el negocio, sin las propinas.
 * @property {string} propinas Propinas del turno, para repartir entre los trabajadores.
 * @property {string} efectivoEsperado Monto inicial + pagos en efectivo: lo que debería haber en caja.
 * @property {{ pagados: number, abiertos: number, anulados: number }} pedidos Cantidad de pedidos por estado.
 */

/**
 * Abre un turno de caja.
 * @param {DatosSesion} sesion
 * @param {{ montoInicial: string }} datos
 * @throws {AppError} 409 si ya hay un turno abierto.
 */
export async function abrirTurno(sesion, { montoInicial }) {
  try {
    return await conNegocio(sesion.tenantId, async (tx) => {
      // 1. Revisar si ya hay un turno abierto para dar un mensaje claro.
      const abierto = await tx.turnoCaja.findFirst({ where: { cerradoEn: null } });
      if (abierto) throw errorTurnoYaAbierto();

      // 2. Crear el turno con el efectivo inicial.
      return tx.turnoCaja.create({
        data: { tenantId: sesion.tenantId, abiertoPorId: sesion.usuarioId, montoInicial },
      });
    });
  } catch (error) {
    // Si dos personas abren la caja al mismo tiempo, el índice único de la base frena a la segunda.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw errorTurnoYaAbierto();
    }
    throw error;
  }
}

/**
 * Devuelve el turno abierto con el resumen de lo vendido hasta el momento.
 * @param {DatosSesion} sesion
 * @throws {AppError} 404 si no hay turno abierto.
 */
export function obtenerTurnoActual(sesion) {
  return conNegocio(sesion.tenantId, async (tx) => {
    const turno = await tx.turnoCaja.findFirst({ where: { cerradoEn: null } });
    if (!turno) throw errorSinTurno();

    return { ...turno, resumen: await calcularResumen(tx, turno) };
  });
}

/**
 * Cierra el turno abierto con el arqueo del efectivo y lo registra en la auditoría.
 * @param {DatosSesion} sesion
 * @param {{ montoContado: string }} datos
 * @throws {AppError} 404 si no hay turno abierto; 409 si quedan pedidos sin cobrar.
 */
export function cerrarTurno(sesion, { montoContado }) {
  return conNegocio(sesion.tenantId, async (tx) => {
    // 1. Buscar el turno abierto.
    const turno = await tx.turnoCaja.findFirst({ where: { cerradoEn: null } });
    if (!turno) throw errorSinTurno();

    // 2. No se cierra con pedidos pendientes: el arqueo quedaría incompleto.
    const resumen = await calcularResumen(tx, turno);
    if (resumen.pedidos.abiertos > 0) {
      throw new AppError(
        409,
        'PEDIDOS_ABIERTOS',
        `Hay ${resumen.pedidos.abiertos} pedido(s) sin cobrar o anular en este turno`,
      );
    }

    // 3. Arqueo: diferencia entre lo contado y lo esperado.
    const contado = aDecimal(montoContado);
    const diferencia = contado.minus(resumen.efectivoEsperado);

    // 4. Cerrar. La condición `cerradoEn: null` evita cerrar dos veces si llegan dos peticiones juntas.
    const cerrados = await tx.turnoCaja.updateMany({
      where: { id: turno.id, cerradoEn: null },
      data: { cerradoEn: new Date(), cerradoPorId: sesion.usuarioId, montoContado: contado },
    });
    if (cerrados.count !== 1) throw errorSinTurno();

    // 5. El cierre de caja es una acción sensible: queda en la auditoría.
    const arqueo = {
      efectivoEsperado: resumen.efectivoEsperado,
      montoContado: contado.toFixed(2),
      diferencia: diferencia.toFixed(2),
    };
    await registrarAuditoria(tx, sesion, {
      accion: ACCIONES.CERRAR_CAJA,
      entidad: 'turnos_caja',
      entidadId: turno.id,
      detalle: { ...arqueo, ventasPorMetodo: resumen.ventasPorMetodo },
    });

    const cerrado = await tx.turnoCaja.findUniqueOrThrow({ where: { id: turno.id } });
    return { ...cerrado, resumen, arqueo };
  });
}

/**
 * Historial de turnos, del más reciente al más antiguo.
 * @param {DatosSesion} sesion
 */
export function listarTurnos(sesion) {
  return conNegocio(sesion.tenantId, (tx) =>
    tx.turnoCaja.findMany({
      orderBy: { abiertoEn: 'desc' },
      take: 50,
      include: {
        abiertoPor: { select: { id: true, nombre: true } },
        cerradoPor: { select: { id: true, nombre: true } },
      },
    }),
  );
}

/**
 * Un turno con su resumen y, si ya cerró, su arqueo.
 * @param {DatosSesion} sesion
 * @param {string} id
 */
export function obtenerTurno(sesion, id) {
  return conNegocio(sesion.tenantId, async (tx) => {
    const turno = await tx.turnoCaja.findUnique({ where: { id } });
    if (!turno) throw new AppError(404, 'NO_ENCONTRADO', 'El turno no existe');

    const resumen = await calcularResumen(tx, turno);
    const arqueo = turno.montoContado
      ? {
          efectivoEsperado: resumen.efectivoEsperado,
          montoContado: turno.montoContado.toFixed(2),
          diferencia: turno.montoContado.minus(resumen.efectivoEsperado).toFixed(2),
        }
      : null;
    return { ...turno, resumen, arqueo };
  });
}

// ───────────────────────────── Funciones internas ─────────────────────────────

/**
 * Calcula lo vendido en un turno: pagos por método, total y efectivo esperado en caja.
 * Los pagos de pedidos anulados no cuentan.
 * @param {TransaccionPrisma} tx
 * @param {{ id: string, montoInicial: Prisma.Decimal }} turno
 * @returns {Promise<ResumenTurno>}
 */
async function calcularResumen(tx, turno) {
  // 1. Sumar los pagos del turno agrupados por método.
  const pagos = await tx.pago.groupBy({
    by: ['metodo'],
    where: { pedido: { turnoId: turno.id, estado: { not: 'anulado' } } },
    _sum: { monto: true },
  });

  /** @type {Record<MetodoPago, InstanceType<typeof Decimal>>} */
  const porMetodo = Object.fromEntries(METODOS_PAGO.map((metodo) => [metodo, new Decimal(0)]));
  for (const grupo of pagos) {
    porMetodo[grupo.metodo] = aDecimal(grupo._sum.monto ?? 0);
  }

  // 2. Sumar las propinas de los pedidos cobrados.
  const { _sum: propinasDelTurno } = await tx.pedido.aggregate({
    where: { turnoId: turno.id, estado: 'pagado' },
    _sum: { propina: true },
  });
  const propinas = aDecimal(propinasDelTurno.propina ?? 0);

  // 3. Contar los pedidos según su estado.
  const estados = await tx.pedido.groupBy({
    by: ['estado'],
    where: { turnoId: turno.id },
    _count: { _all: true },
  });
  const contar = (/** @type {string[]} */ buscados) =>
    estados
      .filter((grupo) => buscados.includes(grupo.estado))
      .reduce((total, grupo) => total + grupo._count._all, 0);

  // 4. Totales. Las propinas en efectivo también están en el cajón.
  const totalCobrado = Object.values(porMetodo).reduce((total, monto) => total.plus(monto));
  const totalVendido = totalCobrado.minus(propinas);
  const efectivoEsperado = aDecimal(turno.montoInicial).plus(porMetodo.efectivo);

  return {
    ventasPorMetodo: /** @type {Record<MetodoPago, string>} */ (
      Object.fromEntries(METODOS_PAGO.map((metodo) => [metodo, porMetodo[metodo].toFixed(2)]))
    ),
    totalCobrado: totalCobrado.toFixed(2),
    totalVendido: totalVendido.toFixed(2),
    propinas: propinas.toFixed(2),
    efectivoEsperado: efectivoEsperado.toFixed(2),
    pedidos: {
      pagados: contar(['pagado']),
      abiertos: contar([...ESTADOS_PEDIDO_ABIERTO]),
      anulados: contar(['anulado']),
    },
  };
}

function errorTurnoYaAbierto() {
  return new AppError(409, 'TURNO_YA_ABIERTO', 'Ya hay un turno de caja abierto');
}

function errorSinTurno() {
  return new AppError(404, 'SIN_TURNO_ABIERTO', 'No hay un turno de caja abierto');
}
