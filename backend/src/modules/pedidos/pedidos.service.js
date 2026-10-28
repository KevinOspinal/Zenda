// @ts-check
// Lógica de los pedidos: crear, agregar y quitar ítems, enviar a cocina, cobrar y anular.
// También los domicilios: corregir sus datos, despacharlos con un domiciliario y entregarlos.
//
// Tipos de pedido: de mesa, de mostrador (comer ahí o recoger) y a domicilio. Cada pedido
// lleva un número del día (#1, #2...) que identifica los que no tienen mesa.
//
// Ciclo de un pedido:
//   abierto → enviado_a_cocina → pagado
//      └──────────┴──────────────→ anulado
// Se puede cobrar desde "abierto" (comidas rápidas: el cliente paga antes de que cocinen).
// El estado de cocina de cada ítem avanza por separado: pendiente → preparando → listo → entregado.
// Cada paso lo marca quien lo ve: la cocina sabe cuándo un plato está listo y el mesero, cuándo
// llegó a la mesa (ver revisarPermisoCocina).
//
// Seguridad: PostgreSQL revisa las llaves foráneas sin aplicar RLS, así que toda mesa,
// producto o cliente que llega en la petición se busca primero dentro del negocio activo.
import { Prisma } from '@prisma/client';
import { ACCIONES, registrarAuditoria } from '../../lib/auditoria.js';
import { aDecimal, sumar } from '../../lib/dinero.js';
import { AppError } from '../../lib/errors.js';
import { ZONA_HORARIA } from '../../lib/fechas.js';
import { conNegocio } from '../../lib/negocio.js';
import {
  descontarInventarioPorVenta,
  devolverInventarioPorAnulacion,
} from '../inventario/movimientos.js';
import { calcularLinea, calcularTotalesPedido, obtenerTasaImpuesto } from './calculoImpuestos.js';
import { calcularPropinaSugerida } from './propina.js';
import { emitirReciboSiNoFactura } from './recibos.js';

/** @typedef {import('../../lib/tokens.js').DatosSesion} DatosSesion */
/** @typedef {import('../../lib/negocio.js').TransaccionPrisma} TransaccionPrisma */
/** @typedef {{ productoId: string, cantidad: string, notas?: string }} DatosItem */
/** @typedef {'efectivo' | 'tarjeta' | 'transferencia' | 'otro'} MetodoPago */
/** @typedef {{ metodo: MetodoPago, monto: string, referencia?: string, recibido?: string }} DatosPago */
/** @typedef {'pendiente' | 'preparando' | 'listo' | 'entregado'} EstadoCocina */
/** @typedef {'mesa' | 'mostrador' | 'domicilio'} TipoPedido */
/**
 * @typedef {object} DatosEntrega
 * @property {string} telefono
 * @property {string} direccion
 * @property {string} [indicaciones]
 * @property {string} [pagaCon] Con cuánto paga el cliente en efectivo.
 */
/**
 * @typedef {object} DatosNuevoPedido
 * @property {TipoPedido} tipo
 * @property {string} [mesaId] Solo pedidos de mesa.
 * @property {'local' | 'whatsapp' | 'telefono' | 'otro'} origen
 * @property {string} [nombreCliente]
 * @property {DatosEntrega} [entrega] Solo domicilios.
 * @property {string} [valorDomicilio] Solo domicilios; si no llega, el del negocio.
 * @property {string} [uuidOffline]
 * @property {DatosItem[]} items
 */

/** Estados en los que el pedido todavía se puede modificar o cobrar. */
const ESTADOS_ABIERTOS = /** @type {const} */ (['abierto', 'enviado_a_cocina']);

/** Orden de los estados de cocina: un ítem solo puede avanzar, nunca retroceder. */
const ORDEN_COCINA = /** @type {const} */ (['pendiente', 'preparando', 'listo', 'entregado']);

/** Roles que marcan un plato como "preparando" o "listo". El mesero no: eso lo sabe la cocina. */
const PREPARAN = /** @type {const} */ (['cocina', 'cajero', 'administrador', 'dueno']);

/** Horas que la cocina sigue viendo un pedido cobrado que aún tiene platos por entregar. */
const HORAS_COBRADO_EN_COCINA = 12;

/**
 * Roles que registran domicilios y ven sus datos de entrega. Son datos personales (Ley 1581):
 * el mesero y la cocina no los necesitan.
 */
const MANEJAN_DOMICILIOS = /** @type {const} */ (['cajero', 'administrador', 'dueno']);

/** Horas que un domicilio sin entregar sigue en la lista de la caja. */
const HORAS_DOMICILIO_EN_CURSO = 24;

/** La entrega de un domicilio con el domiciliario que la lleva. */
const DETALLE_ENTREGA = /** @type {const} */ ({
  include: { domiciliario: { select: { id: true, nombre: true, telefono: true } } },
});

/**
 * Lo que se devuelve de un pedido: sus ítems con el nombre del producto, sus pagos y la mesa.
 * El porcentaje de propina del negocio se usa para calcular la propina sugerida (ver `presentarPedido`).
 */
const DETALLE_PEDIDO = /** @type {const} */ ({
  items: {
    // En el orden en que se agregaron.
    orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }],
    include: { producto: { select: { nombre: true } } },
  },
  pagos: { orderBy: { creadoEn: 'asc' } },
  mesa: { select: { id: true, nombre: true, estado: true } },
  cliente: { select: { id: true, nombre: true, tipoDocumento: true, numeroDocumento: true } },
  entrega: DETALLE_ENTREGA,
  // Solo en negocios que no facturan electrónicamente (ver recibos.js).
  recibo: { select: { numero: true, emitidoEn: true, encabezado: true } },
  tenant: { select: { propinaSugerida: true } },
});

// ───────────────────────────── Crear y consultar ─────────────────────────────

/**
 * Crea un pedido de mesa, de mostrador o a domicilio, opcionalmente con sus primeros ítems.
 * Un domicilio lo registra la caja (maneja datos personales) y suma su valor al total.
 *
 * Si llega un `uuidOffline` que ya existe, devuelve el pedido existente sin crear otro:
 * así una venta hecha sin internet no se duplica cuando la app la reenvía.
 *
 * @param {DatosSesion} sesion
 * @param {DatosNuevoPedido} datos
 * @returns {Promise<{ pedido: object, creado: boolean }>} `creado` es false si ya existía.
 * @throws {AppError} 403 si quien registra un domicilio no es de la caja.
 */
export async function crearPedido(sesion, datos) {
  const { tipo, mesaId, origen, nombreCliente, entrega, valorDomicilio, uuidOffline, items } =
    datos;
  if (tipo === 'domicilio') exigirQueManejeDomicilios(sesion.rol);

  try {
    return await conNegocio(sesion.tenantId, async (tx) => {
      // 1. Idempotencia: si el pedido ya llegó antes, se devuelve tal cual.
      if (uuidOffline) {
        const existente = await buscarPorUuidOffline(tx, sesion.tenantId, uuidOffline, sesion.rol);
        if (existente) return { pedido: existente, creado: false };
      }

      // 2. Debe haber caja abierta: todo pedido pertenece a un turno.
      const turno = await tx.turnoCaja.findFirst({ where: { cerradoEn: null } });
      if (!turno) {
        throw new AppError(409, 'CAJA_CERRADA', 'Abra la caja antes de tomar pedidos');
      }

      // 3. La mesa debe ser del negocio y no tener otro pedido abierto.
      if (mesaId) await ocuparMesa(tx, mesaId);

      // 4. Número del día y, en domicilios, su valor (el del negocio si no llega otro).
      const numero = await siguienteNumeroDelDia(tx, sesion.tenantId);
      const valor =
        tipo === 'domicilio'
          ? (valorDomicilio ?? (await valorDomicilioDelNegocio(tx, sesion.tenantId)))
          : '0';

      // 5. Crear el pedido (con sus datos de entrega si es domicilio) y agregar sus ítems.
      const pedido = await tx.pedido.create({
        data: {
          tenantId: sesion.tenantId,
          turnoId: turno.id,
          meseroId: sesion.usuarioId,
          mesaId,
          uuidOffline,
          tipo,
          origen,
          numero,
          nombreCliente,
          valorDomicilio: valor,
          ...(entrega ? { entrega: { create: { tenantId: sesion.tenantId, ...entrega } } } : {}),
        },
      });
      await agregarItems(tx, sesion.tenantId, pedido.id, items);
      // El domicilio suma al total aunque todavía no haya productos.
      if (tipo === 'domicilio') await recalcularTotales(tx, pedido.id);

      return { pedido: await cargarPedido(tx, pedido.id, sesion.rol), creado: true };
    });
  } catch (error) {
    // Dos envíos simultáneos del mismo pedido offline: el índice único frena al segundo.
    if (uuidOffline && esViolacionDeUnicidad(error)) {
      const existente = await conNegocio(sesion.tenantId, (tx) =>
        buscarPorUuidOffline(tx, sesion.tenantId, uuidOffline, sesion.rol),
      );
      if (existente) return { pedido: existente, creado: false };
    }
    throw error;
  }
}

/**
 * Lista pedidos, del más reciente al más antiguo (máximo 100).
 * - `activos`: solo los que aún no se cobran ni se anulan (abiertos y en cocina).
 * - `cocina`: las comandas del tablero de cocina (ver filtroComandasDeCocina).
 * - `domicilios`: los domicilios en curso, sin entregar, con sus ítems (solo la caja).
 * - `incluirItems`: agrega los ítems de cada pedido, para que el mapa de mesas y la cocina
 *   no tengan que pedir el detalle de cada uno.
 * @param {DatosSesion} sesion
 * @param {{ estado?: 'abierto' | 'enviado_a_cocina' | 'pagado' | 'anulado', mesaId?: string,
 *   activos?: boolean, cocina?: boolean, domicilios?: boolean, incluirItems?: boolean }} filtros
 * @throws {AppError} 403 si pide los domicilios alguien que no es de la caja.
 */
export function listarPedidos(
  sesion,
  { estado, mesaId, activos = false, cocina = false, domicilios = false, incluirItems = false },
) {
  if (domicilios) exigirQueManejeDomicilios(sesion.rol);
  let filtroDeEstado;
  if (domicilios) filtroDeEstado = filtroDomiciliosEnCurso();
  else if (cocina) filtroDeEstado = filtroComandasDeCocina();
  else filtroDeEstado = { estado: activos ? { in: [...ESTADOS_ABIERTOS] } : estado };
  const veEntregas = MANEJAN_DOMICILIOS.some((rol) => rol === sesion.rol);
  return conNegocio(sesion.tenantId, (tx) =>
    tx.pedido.findMany({
      where: { mesaId, ...filtroDeEstado },
      orderBy: { abiertoEn: 'desc' },
      take: 100,
      include: {
        mesa: { select: { id: true, nombre: true } },
        ...(incluirItems || domicilios ? { items: DETALLE_PEDIDO.items } : {}),
        // Los datos de entrega, solo para la caja (ver MANEJAN_DOMICILIOS).
        ...(veEntregas ? { entrega: DETALLE_ENTREGA } : {}),
      },
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
    return presentarPedido(pedido, sesion.rol);
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
    return cargarPedido(tx, pedidoId, sesion.rol);
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
    return cargarPedido(tx, pedidoId, sesion.rol);
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
    revisarPermisoCocina(sesion.rol, estadoCocina, pedido);
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
    return cargarPedido(tx, pedidoId, sesion.rol);
  });
}

/** Estados desde los que cada plato avanza cuando se cambian todos a la vez. */
const AVANZAN_A = Object.freeze({
  listo: /** @type {const} */ (['pendiente', 'preparando']),
  entregado: /** @type {const} */ (['listo']),
});

/**
 * Avanza de una vez todos los platos de un pedido que pueden pasar a ese estado:
 * - "listo": los pendientes y los que se preparan ("Todo listo" de la cocina).
 * - "entregado": los que ya están listos ("Entregar todo" del mesero, "Ya salió" en
 *   mostrador). Lo que sigue en preparación se queda: se entrega cuando esté listo.
 * Aplica las mismas reglas de quién marca cada paso (revisarPermisoCocina). Así un solo
 * cambio genera un solo aviso, en lugar de uno por plato.
 * @param {DatosSesion} sesion
 * @param {string} pedidoId
 * @param {'listo' | 'entregado'} estadoCocina
 * @returns {Promise<{ pedido: any, cambiados: string[] }>} El pedido y los platos que cambiaron.
 * @throws {AppError} 409 NADA_QUE_AVANZAR si ningún plato puede pasar a ese estado.
 */
export function cambiarEstadoCocinaDelPedido(sesion, pedidoId, estadoCocina) {
  return conNegocio(sesion.tenantId, async (tx) => {
    // 1. El pedido existe, quien lo pide puede marcar ese paso y no está anulado.
    const pedido = await tx.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido) throw errorPedidoNoEncontrado();
    revisarPermisoCocina(sesion.rol, estadoCocina, pedido);
    if (pedido.estado === 'anulado') {
      throw new AppError(409, 'PEDIDO_ANULADO', 'El pedido está anulado');
    }

    // 2. Los platos que pueden avanzar a ese estado.
    const platos = await tx.itemPedido.findMany({
      where: { pedidoId, estadoCocina: { in: [...AVANZAN_A[estadoCocina]] } },
      select: { id: true },
    });
    if (platos.length === 0) {
      throw new AppError(
        409,
        'NADA_QUE_AVANZAR',
        estadoCocina === 'listo'
          ? 'Este pedido no tiene platos por terminar'
          : 'Este pedido no tiene platos listos para entregar',
      );
    }

    // 3. Avanzarlos todos en una sola instrucción.
    const cambiados = platos.map((plato) => plato.id);
    await tx.itemPedido.updateMany({ where: { id: { in: cambiados } }, data: { estadoCocina } });
    return { pedido: await cargarPedido(tx, pedidoId, sesion.rol), cambiados };
  });
}

/**
 * Envía el pedido a cocina. Repetirlo no es un error (por ejemplo, tras agregar más ítems).
 * @param {DatosSesion} sesion
 * @param {string} pedidoId
 */
export function enviarACocina(sesion, pedidoId) {
  return conNegocio(sesion.tenantId, async (tx) => {
    // 1. Cualquier pedido sin anular. También uno ya cobrado: por ejemplo, un domicilio que
    //    se pagó por transferencia antes de mandarlo a cocina. Ese sigue "pagado".
    const pedido = await tx.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido) throw errorPedidoNoEncontrado();
    if (pedido.estado === 'anulado') {
      throw new AppError(409, 'PEDIDO_ANULADO', 'El pedido está anulado');
    }

    const cantidadItems = await tx.itemPedido.count({ where: { pedidoId } });
    if (cantidadItems === 0) {
      throw new AppError(409, 'PEDIDO_VACIO', 'Agregue productos antes de enviar a cocina');
    }

    // 2. Se guarda la hora del primer envío; reenviar (tras agregar ítems) no la cambia.
    await tx.pedido.update({
      where: { id: pedidoId },
      data: {
        ...(pedido.estado === 'pagado'
          ? {}
          : { estado: /** @type {const} */ ('enviado_a_cocina') }),
        enviadoACocinaEn: pedido.enviadoACocinaEn ?? new Date(),
      },
    });
    return cargarPedido(tx, pedidoId, sesion.rol);
  });
}

/**
 * Divide la cuenta: pasa ítems (completos o parte de sus unidades) a un pedido nuevo en la
 * misma mesa. Cada cuenta se cobra por separado, y así cada persona puede tener su factura.
 *
 * Los ítems conservan su precio, impuesto, notas y estado de cocina. Los totales de ambos
 * pedidos se recalculan. La mesa sigue ocupada hasta que se cobren todas sus cuentas.
 *
 * @param {DatosSesion} sesion
 * @param {string} pedidoId
 * @param {{ items: { itemId: string, cantidad: string }[] }} datos
 * @returns {Promise<{ original: object, nuevo: object }>}
 * @throws {AppError} 409 si el pedido ya se cobró o anuló; 404 si un ítem no es del pedido;
 *   422 si se piden más unidades de las que hay o si se intenta pasar toda la cuenta.
 */
export function dividirPedido(sesion, pedidoId, { items }) {
  return conNegocio(sesion.tenantId, async (tx) => {
    // 1. El pedido debe estar abierto. Un domicilio no se divide: tiene una sola entrega.
    const original = await buscarPedidoAbierto(tx, pedidoId);
    if (original.tipo === 'domicilio') {
      throw new AppError(409, 'DOMICILIO_NO_SE_DIVIDE', 'Un domicilio se cobra completo');
    }
    const itemsDelPedido = await tx.itemPedido.findMany({ where: { pedidoId } });

    // 2. Validar cada ítem y las unidades que se mueven.
    const movimientos = items.map(({ itemId, cantidad }) => {
      const item = itemsDelPedido.find((i) => i.id === itemId);
      if (!item) {
        throw new AppError(404, 'ITEM_NO_ENCONTRADO', 'El ítem no existe en este pedido');
      }
      if (aDecimal(cantidad).greaterThan(item.cantidad)) {
        throw new AppError(
          422,
          'DIVISION_INVALIDA',
          `El ítem tiene ${item.cantidad} unidad(es); no se pueden pasar ${cantidad}`,
        );
      }
      return { item, cantidad: aDecimal(cantidad) };
    });

    // 3. La cuenta original no puede quedar vacía: eso no es dividir, es cambiar de cuenta.
    const quedaAlgo = itemsDelPedido.some((item) => {
      const movimiento = movimientos.find((m) => m.item.id === item.id);
      return !movimiento || movimiento.cantidad.lessThan(item.cantidad);
    });
    if (!quedaAlgo) {
      throw new AppError(
        422,
        'DIVISION_INVALIDA',
        'La cuenta original debe conservar al menos un producto',
      );
    }

    // 4. Crear la cuenta nueva en la misma mesa, turno y estado.
    const nuevo = await tx.pedido.create({
      data: {
        tenantId: sesion.tenantId,
        turnoId: original.turnoId,
        meseroId: original.meseroId,
        mesaId: original.mesaId,
        estado: original.estado,
        tipo: original.tipo,
        origen: original.origen,
        nombreCliente: original.nombreCliente,
        // Los platos que pasan ya estaban en la cocina: la cuenta nueva también se ve allá.
        enviadoACocinaEn: original.enviadoACocinaEn,
        numero: await siguienteNumeroDelDia(tx, sesion.tenantId),
      },
    });

    // 5. Mover los ítems: completos se reasignan; parciales se reparten en dos.
    for (const { item, cantidad } of movimientos) {
      if (cantidad.equals(item.cantidad)) {
        await tx.itemPedido.update({ where: { id: item.id }, data: { pedidoId: nuevo.id } });
      } else {
        await tx.itemPedido.update({
          where: { id: item.id },
          data: { cantidad: aDecimal(item.cantidad).minus(cantidad) },
        });
        await tx.itemPedido.create({
          data: {
            tenantId: sesion.tenantId,
            pedidoId: nuevo.id,
            productoId: item.productoId,
            cantidad,
            precioUnitario: item.precioUnitario,
            tasaImpuesto: item.tasaImpuesto,
            estadoCocina: item.estadoCocina,
            notas: item.notas,
          },
        });
      }
    }

    // 6. Recalcular los totales de ambas cuentas.
    await recalcularTotales(tx, pedidoId);
    await recalcularTotales(tx, nuevo.id);

    return {
      original: await cargarPedido(tx, pedidoId, sesion.rol),
      nuevo: await cargarPedido(tx, nuevo.id, sesion.rol),
    };
  });
}

// ───────────────────────────── Cobrar y anular ─────────────────────────────

/**
 * Cobra el pedido con uno o varios pagos que deben sumar exactamente el total más la
 * propina voluntaria (si el cliente decidió darla).
 *
 * El monto de cada pago es lo que se abona a la cuenta. En efectivo se puede enviar
 * `recibido` (el billete del cliente) para calcular el cambio, que no entra a la caja.
 *
 * @param {DatosSesion} sesion
 * @param {string} pedidoId
 * @param {{ pagos: DatosPago[], propina?: string, clienteId?: string }} datos
 * @returns {Promise<{ pedido: object, cambio: string,
 *   advertencias: import('../inventario/movimientos.js').AdvertenciaStock[] }>}
 */
export function cobrarPedido(sesion, pedidoId, { pagos, propina = '0', clienteId }) {
  return conNegocio(sesion.tenantId, async (tx) => {
    // 1. El pedido debe estar abierto y tener ítems.
    const pedido = await buscarPedidoAbierto(tx, pedidoId);
    if (pedido.total.isZero()) {
      throw new AppError(409, 'PEDIDO_VACIO', 'El pedido no tiene productos para cobrar');
    }

    // 2. La propina no puede ser mayor que el total: protege de errores de digitación
    //    (por ejemplo un cero de más).
    if (aDecimal(propina).greaterThan(pedido.total)) {
      throw new AppError(
        422,
        'PROPINA_EXCEDE_TOTAL',
        `La propina (${aDecimal(propina).toFixed(2)}) no puede ser mayor que el total del pedido (${pedido.total.toFixed(2)})`,
      );
    }

    // 3. Los pagos deben sumar exactamente el total más la propina (ni más ni menos).
    const aPagar = pedido.total.plus(propina);
    const sumaPagos = sumar(pagos.map((pago) => pago.monto));
    if (!sumaPagos.equals(aPagar)) {
      throw new AppError(
        422,
        'PAGO_NO_CUADRA',
        `Los pagos suman ${sumaPagos.toFixed(2)} y deben sumar ${aPagar.toFixed(2)} ` +
          `(total ${pedido.total.toFixed(2)} + propina ${aDecimal(propina).toFixed(2)})`,
      );
    }

    // 4. Si se factura a nombre de un cliente, debe ser del negocio.
    if (clienteId) {
      const cliente = await tx.cliente.findUnique({ where: { id: clienteId } });
      if (!cliente) throw new AppError(404, 'CLIENTE_NO_ENCONTRADO', 'El cliente no existe');
    }

    // 5. Marcar como pagado. La condición de estado evita cobrar dos veces si llegan
    //    dos peticiones juntas.
    const actualizados = await tx.pedido.updateMany({
      where: { id: pedidoId, estado: { in: [...ESTADOS_ABIERTOS] } },
      data: { estado: 'pagado', cerradoEn: new Date(), clienteId, propina },
    });
    if (actualizados.count !== 1) throw errorPedidoCerrado();

    // 6. Registrar los pagos, con lo que entregó el cliente en efectivo (para el recibo).
    await tx.pago.createMany({
      data: pagos.map(({ metodo, monto, referencia, recibido }) => ({
        tenantId: sesion.tenantId,
        pedidoId,
        metodo,
        monto,
        referencia,
        recibido,
      })),
    });

    // 7. Descontar del inventario los productos que lo controlan.
    const advertencias = await descontarInventarioPorVenta(tx, sesion.tenantId, pedidoId);

    // 8. Liberar la mesa.
    if (pedido.mesaId) await liberarMesa(tx, pedido.mesaId);

    // 9. Si el negocio no factura electrónicamente, su recibo de venta con número consecutivo.
    await emitirReciboSiNoFactura(tx, sesion.tenantId, pedidoId);

    // 10. Cambio a devolver: lo recibido en efectivo menos lo abonado en efectivo.
    const cambio = sumar(
      pagos
        .filter((pago) => pago.recibido !== undefined)
        .map((pago) => aDecimal(/** @type {string} */ (pago.recibido)).minus(pago.monto)),
    );

    return {
      pedido: await cargarPedido(tx, pedidoId, sesion.rol),
      cambio: cambio.toFixed(2),
      advertencias,
    };
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

    // 4. Si estaba cobrado, devolver al inventario lo que se descontó.
    if (pedido.estado === 'pagado') {
      await devolverInventarioPorAnulacion(tx, sesion.tenantId, pedidoId);
    }

    // 5. Auditoría.
    await registrarAuditoria(tx, sesion, {
      accion: ACCIONES.ANULAR_VENTA,
      entidad: 'pedidos',
      entidadId: pedidoId,
      detalle: { motivo, estadoAnterior: pedido.estado, total: pedido.total.toFixed(2) },
    });

    return cargarPedido(tx, pedidoId, sesion.rol);
  });
}

// ───────────────────────────── Domicilios ─────────────────────────────

/**
 * @typedef {object} DatosActualizarDomicilio
 * @property {string} [nombreCliente]
 * @property {string} [telefono]
 * @property {string} [direccion]
 * @property {string | null} [indicaciones] null lo borra.
 * @property {string | null} [pagaCon] null lo borra.
 * @property {string} [valorDomicilio]
 */

/**
 * Corrige los datos de un domicilio: a quién y a dónde se lleva, con cuánto paga y su valor
 * (se ajusta si es lejos). El valor cambia el total, por eso solo se puede mientras el pedido
 * no se haya cobrado.
 * @param {DatosSesion} sesion
 * @param {string} pedidoId
 * @param {DatosActualizarDomicilio} datos
 * @throws {AppError} 409 si no es domicilio, si ya se entregó o si se cambia el valor de uno cobrado.
 */
export function actualizarDomicilio(
  sesion,
  pedidoId,
  { nombreCliente, valorDomicilio, ...entrega },
) {
  return conNegocio(sesion.tenantId, async (tx) => {
    const pedido = await buscarDomicilioPendiente(tx, pedidoId);

    // 1. El valor del domicilio cambia el total: solo antes de cobrar.
    if (valorDomicilio !== undefined) {
      if (!ESTADOS_ABIERTOS.some((estado) => estado === pedido.estado)) throw errorPedidoCerrado();
      await tx.pedido.update({ where: { id: pedidoId }, data: { valorDomicilio } });
      await recalcularTotales(tx, pedidoId);
    }

    // 2. El nombre y los datos de entrega se pueden corregir hasta que se entregue.
    if (nombreCliente !== undefined) {
      await tx.pedido.update({ where: { id: pedidoId }, data: { nombreCliente } });
    }
    if (Object.keys(entrega).length > 0) {
      await tx.entregaDomicilio.update({ where: { pedidoId }, data: entrega });
    }

    return cargarPedido(tx, pedidoId, sesion.rol);
  });
}

/**
 * Despacha un domicilio: sale del local con un domiciliario. Solo cuando la cocina lo tiene
 * listo: enviado a cocina y sin platos pendientes ni en preparación. Al salir, sus platos
 * quedan "entregado" y la comanda sale del tablero.
 * @param {DatosSesion} sesion
 * @param {string} pedidoId
 * @param {{ domiciliarioId: string }} datos
 * @throws {AppError} 404 si el domiciliario no existe; 409 si ya salió, si no tiene productos,
 *   si no se ha enviado a cocina, si la cocina no lo tiene listo o si el domiciliario está
 *   inactivo.
 */
export function despacharDomicilio(sesion, pedidoId, { domiciliarioId }) {
  return conNegocio(sesion.tenantId, async (tx) => {
    // 1. Un domicilio sin entregar, que no haya salido y con algo para llevar.
    const pedido = await buscarDomicilioPendiente(tx, pedidoId);
    if (pedido.entrega?.despachadoEn) {
      throw new AppError(409, 'DOMICILIO_DESPACHADO', 'Este domicilio ya salió');
    }
    const platos = await tx.itemPedido.findMany({
      where: { pedidoId },
      select: { estadoCocina: true },
    });
    if (platos.length === 0) {
      throw new AppError(409, 'PEDIDO_VACIO', 'El domicilio no tiene productos');
    }

    // 2. Solo sale cuando la cocina lo tiene listo.
    if (!pedido.enviadoACocinaEn) {
      throw new AppError(
        409,
        'DOMICILIO_SIN_ENVIAR',
        'Envíe el domicilio a cocina antes de despacharlo',
      );
    }
    const enPreparacion = platos.some(
      (plato) => plato.estadoCocina === 'pendiente' || plato.estadoCocina === 'preparando',
    );
    if (enPreparacion) {
      throw new AppError(
        409,
        'DOMICILIO_EN_PREPARACION',
        'La cocina todavía no tiene listo este domicilio',
      );
    }

    // 3. El domiciliario debe ser del negocio (RLS) y estar activo.
    const domiciliario = await tx.domiciliario.findUnique({ where: { id: domiciliarioId } });
    if (!domiciliario) {
      throw new AppError(404, 'DOMICILIARIO_NO_ENCONTRADO', 'El domiciliario no existe');
    }
    if (!domiciliario.activo) {
      throw new AppError(409, 'DOMICILIARIO_INACTIVO', 'El domiciliario está inactivo');
    }

    // 4. Sale de la cocina y queda registrado quién lo lleva y a qué hora salió.
    await tx.itemPedido.updateMany({
      where: { pedidoId, estadoCocina: { not: 'entregado' } },
      data: { estadoCocina: 'entregado' },
    });
    await tx.entregaDomicilio.update({
      where: { pedidoId },
      data: { domiciliarioId, despachadoEn: new Date() },
    });

    return cargarPedido(tx, pedidoId, sesion.rol);
  });
}

/**
 * Marca como entregado un pedido sin mesa:
 * - Domicilio: el cliente lo recibió (debe haber salido antes con un domiciliario).
 * - Mostrador: el cliente lo recogió; lo que quedara en la cocina sale con él.
 * En una mesa no aplica: ahí el mesero marca cada plato como entregado.
 * @param {DatosSesion} sesion
 * @param {string} pedidoId
 * @throws {AppError} 409 si es de mesa, si está anulado o si el domicilio no ha salido.
 */
export function entregarPedido(sesion, pedidoId) {
  return conNegocio(sesion.tenantId, async (tx) => {
    const pedido = await tx.pedido.findUnique({
      where: { id: pedidoId },
      include: { entrega: true },
    });
    if (!pedido) throw errorPedidoNoEncontrado();
    if (pedido.estado === 'anulado') {
      throw new AppError(409, 'PEDIDO_ANULADO', 'El pedido está anulado');
    }

    if (pedido.tipo === 'mesa') {
      throw new AppError(
        409,
        'ENTREGA_EN_MESA',
        'En una mesa, el mesero marca cada plato como entregado',
      );
    }

    if (pedido.tipo === 'domicilio') {
      if (pedido.entrega?.entregadoEn) {
        throw new AppError(409, 'DOMICILIO_ENTREGADO', 'Este domicilio ya se entregó');
      }
      if (!pedido.entrega?.despachadoEn) {
        throw new AppError(
          409,
          'DOMICILIO_SIN_DESPACHAR',
          'Despache el domicilio antes de marcarlo como entregado',
        );
      }
      await tx.entregaDomicilio.update({ where: { pedidoId }, data: { entregadoEn: new Date() } });
    } else {
      await tx.itemPedido.updateMany({
        where: { pedidoId, estadoCocina: { not: 'entregado' } },
        data: { estadoCocina: 'entregado' },
      });
    }

    return cargarPedido(tx, pedidoId, sesion.rol);
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
  const { valorDomicilio } = await tx.pedido.findUniqueOrThrow({
    where: { id: pedidoId },
    select: { valorDomicilio: true },
  });
  const lineas = items.map((item) =>
    calcularLinea({
      precioConImpuesto: item.precioUnitario,
      cantidad: item.cantidad,
      tasaImpuesto: item.tasaImpuesto,
    }),
  );
  // El domicilio suma como una línea más, por ahora sin impuesto: el contador debe confirmar
  // cuál lleva. Así subtotal + impuestos + ajuste sigue dando el total.
  if (valorDomicilio.greaterThan(0)) {
    lineas.push(calcularLinea({ precioConImpuesto: valorDomicilio, cantidad: 1, tasaImpuesto: 0 }));
  }
  const totales = calcularTotalesPedido(lineas);

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
 * Filtro de las comandas que ve la cocina: pedidos enviados a cocina con algún plato por
 * entregar, sin cobrar o cobrados hace menos de HORAS_COBRADO_EN_COCINA. Un cliente puede
 * pagar antes de que salgan sus platos (comidas rápidas, o pedir la cuenta antes del postre),
 * y la cocina no debe perder esa comanda. El límite de horas evita que se acumulen los platos
 * que nadie marcó como entregados.
 */
function filtroComandasDeCocina() {
  const cobradoDesde = new Date(Date.now() - HORAS_COBRADO_EN_COCINA * 60 * 60 * 1000);
  return {
    enviadoACocinaEn: { not: null },
    items: { some: { estadoCocina: { not: /** @type {const} */ ('entregado') } } },
    OR: [
      { estado: /** @type {const} */ ('enviado_a_cocina') },
      { estado: /** @type {const} */ ('pagado'), cerradoEn: { gte: cobradoDesde } },
    ],
  };
}

/**
 * Revisa que el rol pueda marcar ese paso de la cocina.
 * - Preparando y listo: la cocina, el cajero (en cafeterías el cajero también prepara), el
 *   administrador y el dueño. El mesero no.
 * - Entregado: todos, menos la cocina fuera del mostrador. En una mesa el mesero confirma que
 *   el plato llegó; un domicilio sale cuando la caja lo despacha. En mostrador la cocina sí
 *   puede ("Ya salió"), porque lo entrega ella misma.
 * @param {DatosSesion['rol']} rol
 * @param {Exclude<EstadoCocina, 'pendiente'>} estadoCocina
 * @param {{ tipo: TipoPedido }} pedido
 * @throws {AppError} 403 SIN_PERMISO
 */
function revisarPermisoCocina(rol, estadoCocina, pedido) {
  if (estadoCocina === 'entregado') {
    if (rol === 'cocina' && pedido.tipo !== 'mostrador') {
      throw new AppError(
        403,
        'SIN_PERMISO',
        pedido.tipo === 'mesa'
          ? 'En las mesas, el mesero marca el plato como entregado'
          : 'Los domicilios salen cuando la caja los despacha',
      );
    }
    return;
  }
  if (!PREPARAN.some((permitido) => permitido === rol)) {
    throw new AppError(
      403,
      'SIN_PERMISO',
      'Solo la cocina marca los platos como preparando o listos',
    );
  }
}

/**
 * Da el siguiente número de pedido del día (hora de Colombia) del negocio, desde 1. Una sola
 * instrucción lo incrementa y lo devuelve, así dos cajas al tiempo nunca reciben el mismo.
 * @param {TransaccionPrisma} tx
 * @param {string} tenantId
 * @returns {Promise<number>}
 */
async function siguienteNumeroDelDia(tx, tenantId) {
  /** @type {{ ultimo: number }[]} */
  const [contador] = await tx.$queryRaw`
    INSERT INTO contadores_pedidos (tenant_id, fecha, ultimo)
    VALUES (${tenantId}::uuid, (now() AT TIME ZONE ${ZONA_HORARIA})::date, 1)
    ON CONFLICT (tenant_id, fecha) DO UPDATE SET ultimo = contadores_pedidos.ultimo + 1
    RETURNING ultimo`;
  return contador.ultimo;
}

/**
 * Valor del domicilio que el negocio propone por defecto.
 * @param {TransaccionPrisma} tx
 * @param {string} tenantId
 */
async function valorDomicilioDelNegocio(tx, tenantId) {
  const negocio = await tx.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { valorDomicilio: true },
  });
  return negocio.valorDomicilio;
}

/**
 * Los domicilios los registra y los ve la caja: tienen datos personales y dinero en la calle.
 * @param {DatosSesion['rol']} rol
 * @throws {AppError} 403 SIN_PERMISO
 */
function exigirQueManejeDomicilios(rol) {
  if (!MANEJAN_DOMICILIOS.some((permitido) => permitido === rol)) {
    throw new AppError(403, 'SIN_PERMISO', 'Los domicilios los maneja la caja');
  }
}

/**
 * Filtro de los domicilios en curso: sin entregar ni anular, abiertos en las últimas
 * HORAS_DOMICILIO_EN_CURSO (para que no se acumulen los que nadie marcó como entregados).
 */
function filtroDomiciliosEnCurso() {
  const abiertoDesde = new Date(Date.now() - HORAS_DOMICILIO_EN_CURSO * 60 * 60 * 1000);
  return {
    tipo: /** @type {const} */ ('domicilio'),
    estado: { not: /** @type {const} */ ('anulado') },
    abiertoEn: { gte: abiertoDesde },
    entrega: { is: { entregadoEn: null } },
  };
}

/**
 * Busca un domicilio que todavía se pueda despachar o corregir: no anulado ni entregado.
 * @param {TransaccionPrisma} tx
 * @param {string} pedidoId
 */
async function buscarDomicilioPendiente(tx, pedidoId) {
  const pedido = await tx.pedido.findUnique({
    where: { id: pedidoId },
    include: { entrega: true },
  });
  if (!pedido) throw errorPedidoNoEncontrado();
  if (pedido.tipo !== 'domicilio') {
    throw new AppError(409, 'NO_ES_DOMICILIO', 'Este pedido no es un domicilio');
  }
  if (pedido.estado === 'anulado') {
    throw new AppError(409, 'PEDIDO_ANULADO', 'El pedido está anulado');
  }
  if (pedido.entrega?.entregadoEn) {
    throw new AppError(409, 'DOMICILIO_ENTREGADO', 'Este domicilio ya se entregó');
  }
  return pedido;
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
 * @param {DatosSesion['rol']} rol Decide si se incluyen los datos de entrega.
 */
async function cargarPedido(tx, pedidoId, rol) {
  const pedido = await tx.pedido.findUniqueOrThrow({
    where: { id: pedidoId },
    include: DETALLE_PEDIDO,
  });
  return presentarPedido(pedido, rol);
}

/**
 * @param {TransaccionPrisma} tx
 * @param {string} tenantId
 * @param {string} uuidOffline
 * @param {DatosSesion['rol']} rol
 */
async function buscarPorUuidOffline(tx, tenantId, uuidOffline, rol) {
  const pedido = await tx.pedido.findUnique({
    where: { tenantId_uuidOffline: { tenantId, uuidOffline } },
    include: DETALLE_PEDIDO,
  });
  return pedido && presentarPedido(pedido, rol);
}

/**
 * Da forma al pedido que se entrega:
 * - Quita los datos internos del negocio.
 * - Agrega la propina que se le sugiere al cliente. Solo en mesa: es por el servicio a la
 *   mesa; en mostrador y domicilio el cliente igual puede dar una, pero no se le sugiere.
 * - Deja los datos de entrega solo a quienes manejan los domicilios (ver MANEJAN_DOMICILIOS).
 * @template {{ tipo: TipoPedido, subtotal: Prisma.Decimal, entrega?: unknown,
 *   tenant: { propinaSugerida: Prisma.Decimal } }} T
 * @param {T} pedido
 * @param {DatosSesion['rol']} rol
 */
function presentarPedido({ tenant, entrega, ...pedido }, rol) {
  const propinaSugerida =
    pedido.tipo === 'mesa'
      ? calcularPropinaSugerida(pedido.subtotal, tenant.propinaSugerida)
      : new Prisma.Decimal(0);
  return {
    ...pedido,
    ...(MANEJAN_DOMICILIOS.some((permitido) => permitido === rol) ? { entrega } : {}),
    propinaSugerida: propinaSugerida.toFixed(2),
  };
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
