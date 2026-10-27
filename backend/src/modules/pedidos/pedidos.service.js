// @ts-check
// Lógica de los pedidos: crear, agregar y quitar ítems, enviar a cocina, cobrar y anular.
//
// Ciclo de un pedido:
//   abierto → enviado_a_cocina → pagado
//      └──────────┴──────────────→ anulado
// Se puede cobrar desde "abierto" (comidas rápidas: el cliente paga antes de que cocinen).
// El estado de cocina de cada ítem avanza por separado: pendiente → preparando → listo → entregado.
//
// Seguridad: PostgreSQL revisa las llaves foráneas sin aplicar RLS, así que toda mesa,
// producto o cliente que llega en la petición se busca primero dentro del negocio activo.
import { Prisma } from '@prisma/client';
import { ACCIONES, registrarAuditoria } from '../../lib/auditoria.js';
import { aDecimal, sumar } from '../../lib/dinero.js';
import { AppError } from '../../lib/errors.js';
import { conNegocio } from '../../lib/negocio.js';
import { calcularLinea, calcularTotalesPedido, obtenerTasaImpuesto } from './calculoImpuestos.js';

/** @typedef {import('../../lib/tokens.js').DatosSesion} DatosSesion */
/** @typedef {import('../../lib/negocio.js').TransaccionPrisma} TransaccionPrisma */
/** @typedef {{ productoId: string, cantidad: string, notas?: string }} DatosItem */
/** @typedef {'efectivo' | 'tarjeta' | 'transferencia' | 'otro'} MetodoPago */
/** @typedef {{ metodo: MetodoPago, monto: string, referencia?: string, recibido?: string }} DatosPago */
/** @typedef {'pendiente' | 'preparando' | 'listo' | 'entregado'} EstadoCocina */

/** Estados en los que el pedido todavía se puede modificar o cobrar. */
const ESTADOS_ABIERTOS = /** @type {const} */ (['abierto', 'enviado_a_cocina']);

/** Orden de los estados de cocina: un ítem solo puede avanzar, nunca retroceder. */
const ORDEN_COCINA = /** @type {const} */ (['pendiente', 'preparando', 'listo', 'entregado']);

/** Lo que se devuelve de un pedido: sus ítems con el nombre del producto, sus pagos y la mesa. */
const DETALLE_PEDIDO = /** @type {const} */ ({
  items: {
    // En el orden en que se agregaron.
    orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }],
    include: { producto: { select: { nombre: true } } },
  },
  pagos: { orderBy: { creadoEn: 'asc' } },
  mesa: { select: { id: true, nombre: true } },
  cliente: { select: { id: true, nombre: true, tipoDocumento: true, numeroDocumento: true } },
});

// ───────────────────────────── Crear y consultar ─────────────────────────────

/**
 * Crea un pedido en una mesa o de mostrador, opcionalmente con sus primeros ítems.
 *
 * Si llega un `uuidOffline` que ya existe, devuelve el pedido existente sin crear otro:
 * así una venta hecha sin internet no se duplica cuando la app la reenvía.
 *
 * @param {DatosSesion} sesion
 * @param {{ mesaId?: string, uuidOffline?: string, items: DatosItem[] }} datos
 * @returns {Promise<{ pedido: object, creado: boolean }>} `creado` es false si ya existía.
 */
export async function crearPedido(sesion, { mesaId, uuidOffline, items }) {
  try {
    return await conNegocio(sesion.tenantId, async (tx) => {
      // 1. Idempotencia: si el pedido ya llegó antes, se devuelve tal cual.
      if (uuidOffline) {
        const existente = await buscarPorUuidOffline(tx, sesion.tenantId, uuidOffline);
        if (existente) return { pedido: existente, creado: false };
      }

      // 2. Debe haber caja abierta: todo pedido pertenece a un turno.
      const turno = await tx.turnoCaja.findFirst({ where: { cerradoEn: null } });
      if (!turno) {
        throw new AppError(409, 'CAJA_CERRADA', 'Abra la caja antes de tomar pedidos');
      }

      // 3. La mesa debe ser del negocio y no tener otro pedido abierto.
      if (mesaId) await ocuparMesa(tx, mesaId);

      // 4. Crear el pedido y agregar sus ítems.
      const pedido = await tx.pedido.create({
        data: {
          tenantId: sesion.tenantId,
          turnoId: turno.id,
          meseroId: sesion.usuarioId,
          mesaId,
          uuidOffline,
        },
      });
      await agregarItems(tx, sesion.tenantId, pedido.id, items);

      return { pedido: await cargarPedido(tx, pedido.id), creado: true };
    });
  } catch (error) {
    // Dos envíos simultáneos del mismo pedido offline: el índice único frena al segundo.
    if (uuidOffline && esViolacionDeUnicidad(error)) {
      const existente = await conNegocio(sesion.tenantId, (tx) =>
        buscarPorUuidOffline(tx, sesion.tenantId, uuidOffline),
      );
      if (existente) return { pedido: existente, creado: false };
    }
    throw error;
  }
}

/**
 * Lista pedidos, del más reciente al más antiguo.
 * @param {DatosSesion} sesion
 * @param {{ estado?: 'abierto' | 'enviado_a_cocina' | 'pagado' | 'anulado', mesaId?: string }} filtros
 */
export function listarPedidos(sesion, filtros) {
  return conNegocio(sesion.tenantId, (tx) =>
    tx.pedido.findMany({
      where: filtros,
      orderBy: { abiertoEn: 'desc' },
      take: 100,
      include: { mesa: { select: { id: true, nombre: true } } },
    }),
  );
}

/**
 * @param {DatosSesion} sesion
 * @param {string} id
 */
export function obtenerPedido(sesion, id) {
  return conNegocio(sesion.tenantId, async (tx) => {
    const pedido = await tx.pedido.findUnique({ where: { id }, include: DETALLE_PEDIDO });
    if (!pedido) throw errorPedidoNoEncontrado();
    return pedido;
  });
}

// ───────────────────────────── Ítems ─────────────────────────────

/**
 * Agrega un ítem a un pedido abierto y recalcula los totales.
 * @param {DatosSesion} sesion
 * @param {string} pedidoId
 * @param {DatosItem} item
 */
export function agregarItem(sesion, pedidoId, item) {
  return conNegocio(sesion.tenantId, async (tx) => {
    await buscarPedidoAbierto(tx, pedidoId);
    await agregarItems(tx, sesion.tenantId, pedidoId, [item]);
    return cargarPedido(tx, pedidoId);
  });
}

/**
 * Quita un ítem que la cocina todavía no ha empezado a preparar.
 * @param {DatosSesion} sesion
 * @param {string} pedidoId
 * @param {string} itemId
 */
export function quitarItem(sesion, pedidoId, itemId) {
  return conNegocio(sesion.tenantId, async (tx) => {
    await buscarPedidoAbierto(tx, pedidoId);
    const item = await buscarItem(tx, pedidoId, itemId);

    if (item.estadoCocina !== 'pendiente') {
      throw new AppError(
        409,
        'ITEM_EN_PREPARACION',
        'La cocina ya empezó a preparar este ítem; no se puede quitar',
      );
    }

    await tx.itemPedido.delete({ where: { id: itemId } });
    await recalcularTotales(tx, pedidoId);
    return cargarPedido(tx, pedidoId);
  });
}

/**
 * Avanza el estado de cocina de un ítem (pendiente → preparando → listo → entregado).
 * @param {DatosSesion} sesion
 * @param {string} pedidoId
 * @param {string} itemId
 * @param {Exclude<EstadoCocina, 'pendiente'>} estadoCocina
 */
export function cambiarEstadoCocina(sesion, pedidoId, itemId, estadoCocina) {
  return conNegocio(sesion.tenantId, async (tx) => {
    const pedido = await tx.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido) throw errorPedidoNoEncontrado();
    if (pedido.estado === 'anulado') {
      throw new AppError(409, 'PEDIDO_ANULADO', 'El pedido está anulado');
    }

    // Un ítem nunca retrocede: lo que ya salió de cocina no vuelve a "pendiente".
    const item = await buscarItem(tx, pedidoId, itemId);
    if (ORDEN_COCINA.indexOf(estadoCocina) <= ORDEN_COCINA.indexOf(item.estadoCocina)) {
      throw new AppError(
        409,
        'CAMBIO_COCINA_INVALIDO',
        `El ítem está "${item.estadoCocina}" y no puede pasar a "${estadoCocina}"`,
      );
    }

    await tx.itemPedido.update({ where: { id: itemId }, data: { estadoCocina } });
    return cargarPedido(tx, pedidoId);
  });
}

/**
 * Envía el pedido a cocina. Repetirlo no es un error (por ejemplo, tras agregar más ítems).
 * @param {DatosSesion} sesion
 * @param {string} pedidoId
 */
export function enviarACocina(sesion, pedidoId) {
  return conNegocio(sesion.tenantId, async (tx) => {
    await buscarPedidoAbierto(tx, pedidoId);

    const cantidadItems = await tx.itemPedido.count({ where: { pedidoId } });
    if (cantidadItems === 0) {
      throw new AppError(409, 'PEDIDO_VACIO', 'Agregue productos antes de enviar a cocina');
    }

    await tx.pedido.update({ where: { id: pedidoId }, data: { estado: 'enviado_a_cocina' } });
    return cargarPedido(tx, pedidoId);
  });
}

// ───────────────────────────── Cobrar y anular ─────────────────────────────

/**
 * Cobra el pedido con uno o varios pagos que deben sumar exactamente el total.
 *
 * El monto de cada pago es lo que se abona a la cuenta. En efectivo se puede enviar
 * `recibido` (el billete del cliente) para calcular el cambio, que no entra a la caja.
 *
 * @param {DatosSesion} sesion
 * @param {string} pedidoId
 * @param {{ pagos: DatosPago[], clienteId?: string }} datos
 * @returns {Promise<{ pedido: object, cambio: string }>}
 */
export function cobrarPedido(sesion, pedidoId, { pagos, clienteId }) {
  return conNegocio(sesion.tenantId, async (tx) => {
    // 1. El pedido debe estar abierto y tener ítems.
    const pedido = await buscarPedidoAbierto(tx, pedidoId);
    if (pedido.total.isZero()) {
      throw new AppError(409, 'PEDIDO_VACIO', 'El pedido no tiene productos para cobrar');
    }

    // 2. Los pagos deben sumar exactamente el total (ni más ni menos).
    const sumaPagos = sumar(pagos.map((pago) => pago.monto));
    if (!sumaPagos.equals(pedido.total)) {
      throw new AppError(
        422,
        'PAGO_NO_CUADRA',
        `Los pagos suman ${sumaPagos.toFixed(2)} y el total es ${pedido.total.toFixed(2)}`,
      );
    }

    // 3. Si se factura a nombre de un cliente, debe ser del negocio.
    if (clienteId) {
      const cliente = await tx.cliente.findUnique({ where: { id: clienteId } });
      if (!cliente) throw new AppError(404, 'CLIENTE_NO_ENCONTRADO', 'El cliente no existe');
    }

    // 4. Marcar como pagado. La condición de estado evita cobrar dos veces si llegan
    //    dos peticiones juntas.
    const actualizados = await tx.pedido.updateMany({
      where: { id: pedidoId, estado: { in: [...ESTADOS_ABIERTOS] } },
      data: { estado: 'pagado', cerradoEn: new Date(), clienteId },
    });
    if (actualizados.count !== 1) throw errorPedidoCerrado();

    // 5. Registrar los pagos.
    await tx.pago.createMany({
      data: pagos.map(({ metodo, monto, referencia }) => ({
        tenantId: sesion.tenantId,
        pedidoId,
        metodo,
        monto,
        referencia,
      })),
    });

    // 6. Liberar la mesa.
    if (pedido.mesaId) await liberarMesa(tx, pedido.mesaId);

    // 7. Cambio a devolver: lo recibido en efectivo menos lo abonado en efectivo.
    const cambio = sumar(
      pagos
        .filter((pago) => pago.recibido !== undefined)
        .map((pago) => aDecimal(/** @type {string} */ (pago.recibido)).minus(pago.monto)),
    );

    return { pedido: await cargarPedido(tx, pedidoId), cambio: cambio.toFixed(2) };
  });
}

/**
 * Anula un pedido. Es una acción sensible: exige motivo y queda en la auditoría.
 * Un pedido cobrado solo se puede anular mientras su turno de caja siga abierto,
 * para no alterar un arqueo ya cerrado.
 * @param {DatosSesion} sesion
 * @param {string} pedidoId
 * @param {{ motivo: string }} datos
 */
export function anularPedido(sesion, pedidoId, { motivo }) {
  return conNegocio(sesion.tenantId, async (tx) => {
    // 1. Buscar el pedido con su turno.
    const pedido = await tx.pedido.findUnique({
      where: { id: pedidoId },
      include: { turno: true },
    });
    if (!pedido) throw errorPedidoNoEncontrado();
    if (pedido.estado === 'anulado') {
      throw new AppError(409, 'PEDIDO_ANULADO', 'El pedido ya está anulado');
    }
    if (pedido.estado === 'pagado' && pedido.turno.cerradoEn) {
      throw new AppError(
        409,
        'TURNO_CERRADO',
        'El pedido se cobró en un turno de caja ya cerrado; no se puede anular',
      );
    }

    // 2. Anular. La condición de estado evita anular dos veces.
    const actualizados = await tx.pedido.updateMany({
      where: { id: pedidoId, estado: { not: 'anulado' } },
      data: { estado: 'anulado', cerradoEn: pedido.cerradoEn ?? new Date() },
    });
    if (actualizados.count !== 1) {
      throw new AppError(409, 'PEDIDO_ANULADO', 'El pedido ya está anulado');
    }

    // 3. Liberar la mesa si el pedido la ocupaba.
    if (pedido.mesaId && pedido.estado !== 'pagado') await liberarMesa(tx, pedido.mesaId);

    // 4. Auditoría.
    await registrarAuditoria(tx, sesion, {
      accion: ACCIONES.ANULAR_VENTA,
      entidad: 'pedidos',
      entidadId: pedidoId,
      detalle: { motivo, estadoAnterior: pedido.estado, total: pedido.total.toFixed(2) },
    });

    return cargarPedido(tx, pedidoId);
  });
}

// ───────────────────────────── Funciones internas ─────────────────────────────

/**
 * Agrega ítems a un pedido: valida cada producto, copia su precio y tasa del momento
 * y al final recalcula los totales.
 * @param {TransaccionPrisma} tx
 * @param {string} tenantId
 * @param {string} pedidoId
 * @param {DatosItem[]} items
 */
async function agregarItems(tx, tenantId, pedidoId, items) {
  if (items.length === 0) return;

  const negocio = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });

  for (const { productoId, cantidad, notas } of items) {
    // 1. El producto debe ser del negocio y estar activo.
    const producto = await tx.producto.findUnique({ where: { id: productoId } });
    if (!producto) {
      throw new AppError(404, 'PRODUCTO_NO_ENCONTRADO', 'El producto no existe');
    }
    if (!producto.activo) {
      throw new AppError(
        422,
        'PRODUCTO_INACTIVO',
        `"${producto.nombre}" no está disponible en el menú`,
      );
    }

    // 2. Copiar precio y tasa: si mañana cambia el menú, esta venta no se altera.
    await tx.itemPedido.create({
      data: {
        tenantId,
        pedidoId,
        productoId,
        cantidad,
        notas,
        precioUnitario: producto.precio,
        tasaImpuesto: obtenerTasaImpuesto(negocio.regimenImpuesto, producto.tipoImpuesto),
      },
    });
  }

  await recalcularTotales(tx, pedidoId);
}

/**
 * Recalcula subtotal, impuestos, ajuste por redondeo y total a partir de los ítems
 * (ver calculoImpuestos.js). La base de datos verifica que los totales cuadren.
 * @param {TransaccionPrisma} tx
 * @param {string} pedidoId
 */
async function recalcularTotales(tx, pedidoId) {
  const items = await tx.itemPedido.findMany({ where: { pedidoId } });
  const totales = calcularTotalesPedido(
    items.map((item) =>
      calcularLinea({
        precioConImpuesto: item.precioUnitario,
        cantidad: item.cantidad,
        tasaImpuesto: item.tasaImpuesto,
      }),
    ),
  );

  await tx.pedido.update({
    where: { id: pedidoId },
    data: {
      subtotal: totales.subtotal,
      impuestos: totales.impuestos,
      ajusteRedondeo: totales.ajusteRedondeo,
      total: totales.total,
    },
  });
}

/**
 * Marca la mesa como ocupada. Una mesa solo puede tener un pedido abierto a la vez.
 * @param {TransaccionPrisma} tx
 * @param {string} mesaId
 */
async function ocuparMesa(tx, mesaId) {
  const mesa = await tx.mesa.findUnique({ where: { id: mesaId } });
  if (!mesa) throw new AppError(404, 'MESA_NO_ENCONTRADA', 'La mesa no existe');

  const pedidoAbierto = await tx.pedido.findFirst({
    where: { mesaId, estado: { in: [...ESTADOS_ABIERTOS] } },
  });
  if (pedidoAbierto) {
    throw new AppError(409, 'MESA_OCUPADA', `La ${mesa.nombre} ya tiene un pedido abierto`);
  }

  await tx.mesa.update({ where: { id: mesaId }, data: { estado: 'ocupada' } });
}

/**
 * Marca la mesa como libre si ya no tiene pedidos abiertos.
 * @param {TransaccionPrisma} tx
 * @param {string} mesaId
 */
async function liberarMesa(tx, mesaId) {
  const pendientes = await tx.pedido.count({
    where: { mesaId, estado: { in: [...ESTADOS_ABIERTOS] } },
  });
  if (pendientes === 0) {
    await tx.mesa.update({ where: { id: mesaId }, data: { estado: 'libre' } });
  }
}

/**
 * Busca un pedido que todavía se pueda modificar o cobrar.
 * @param {TransaccionPrisma} tx
 * @param {string} pedidoId
 */
async function buscarPedidoAbierto(tx, pedidoId) {
  const pedido = await tx.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido) throw errorPedidoNoEncontrado();
  if (!ESTADOS_ABIERTOS.some((estado) => estado === pedido.estado)) throw errorPedidoCerrado();
  return pedido;
}

/**
 * @param {TransaccionPrisma} tx
 * @param {string} pedidoId
 * @param {string} itemId
 */
async function buscarItem(tx, pedidoId, itemId) {
  const item = await tx.itemPedido.findFirst({ where: { id: itemId, pedidoId } });
  if (!item) throw new AppError(404, 'ITEM_NO_ENCONTRADO', 'El ítem no existe en este pedido');
  return item;
}

/**
 * @param {TransaccionPrisma} tx
 * @param {string} pedidoId
 */
function cargarPedido(tx, pedidoId) {
  return tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: DETALLE_PEDIDO });
}

/**
 * @param {TransaccionPrisma} tx
 * @param {string} tenantId
 * @param {string} uuidOffline
 */
function buscarPorUuidOffline(tx, tenantId, uuidOffline) {
  return tx.pedido.findUnique({
    where: { tenantId_uuidOffline: { tenantId, uuidOffline } },
    include: DETALLE_PEDIDO,
  });
}

/** @param {unknown} error */
function esViolacionDeUnicidad(error) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function errorPedidoNoEncontrado() {
  return new AppError(404, 'NO_ENCONTRADO', 'El pedido no existe');
}

function errorPedidoCerrado() {
  return new AppError(409, 'PEDIDO_CERRADO', 'El pedido ya fue cobrado o anulado');
}
