// @ts-check
// Esquemas Zod de pedidos, ítems y pagos.
import { z } from 'zod';
import { aDecimal } from '../../lib/dinero.js';
import {
  alMenosUnCampo,
  esquemaBooleanoEnUrl,
  esquemaId,
  esquemaMonto,
  esquemaTelefono,
  textoObligatorio,
} from '../../lib/esquemas.js';

/** Dónde se entrega el pedido: en una mesa, en el mostrador (comer ahí o recoger) o a domicilio. */
export const TIPOS_PEDIDO = /** @type {const} */ (['mesa', 'mostrador', 'domicilio']);

/** Por dónde llegó el pedido. */
export const ORIGENES_PEDIDO = /** @type {const} */ (['local', 'whatsapp', 'telefono', 'otro']);

/** Nombre con el que se llama o se busca al cliente (no es el de la factura). */
const esquemaNombreCliente = textoObligatorio(80);

/** Datos para llevar un pedido a domicilio: solo los necesarios para entregarlo (Ley 1581). */
const camposEntrega = {
  telefono: esquemaTelefono,
  direccion: textoObligatorio(200),
  // Por ejemplo: "Apto 302, timbre dañado".
  indicaciones: z.string().trim().max(300, 'máximo 300 caracteres'),
  // Con cuánto paga el cliente en efectivo, para que el domiciliario lleve el cambio.
  pagaCon: esquemaMonto,
};

/**
 * Cantidad de un ítem: mayor que cero y con máximo 3 decimales (por ejemplo 0.5 porción).
 * Acepta número o texto y la entrega como texto para convertirla a Decimal.
 */
const esquemaCantidad = z
  .union([z.string().trim(), z.number()])
  .transform(String)
  .pipe(
    z
      .string()
      .regex(/^\d{1,6}(\.\d{1,3})?$/, 'debe ser un número con máximo 3 decimales')
      .refine((valor) => aDecimal(valor).greaterThan(0), 'debe ser mayor que cero'),
  );

/** Un ítem que se agrega al pedido. */
export const esquemaItem = z.object({
  productoId: esquemaId,
  cantidad: esquemaCantidad,
  // Indicaciones para la cocina, por ejemplo "sin cebolla".
  notas: z.string().trim().max(200).optional(),
});

/**
 * POST /pedidos
 * Sin `tipo`, el pedido es de mesa si llega una mesa y de mostrador si no.
 */
export const esquemaCrearPedido = z
  .object({
    tipo: z.enum(TIPOS_PEDIDO).optional(),
    // Solo los pedidos de mesa.
    mesaId: esquemaId.optional(),
    origen: z.enum(ORIGENES_PEDIDO).default('local'),
    nombreCliente: esquemaNombreCliente.optional(),
    // Solo domicilios: a dónde se lleva.
    entrega: z
      .object({
        ...camposEntrega,
        indicaciones: camposEntrega.indicaciones.optional(),
        pagaCon: camposEntrega.pagaCon.optional(),
      })
      .optional(),
    // Solo domicilios. Si no llega, se usa el valor por defecto del negocio.
    valorDomicilio: esquemaMonto.optional(),
    // Lo genera la app cuando vende sin internet: si el pedido llega dos veces, no se duplica.
    uuidOffline: z.uuid('uuidOffline debe ser un UUID').optional(),
    items: z.array(esquemaItem).max(100).default([]),
  })
  .transform((datos) => ({
    ...datos,
    tipo: datos.tipo ?? /** @type {const} */ (datos.mesaId ? 'mesa' : 'mostrador'),
  }))
  .superRefine((datos, contexto) => {
    /** @param {string} campo @param {string} mensaje */
    const error = (campo, mensaje) =>
      contexto.addIssue({ code: 'custom', path: [campo], message: mensaje });

    // 1. Solo los pedidos de mesa tienen mesa, y todos la tienen.
    if (datos.tipo === 'mesa' && !datos.mesaId)
      error('mesaId', 'un pedido de mesa necesita la mesa');
    if (datos.tipo !== 'mesa' && datos.mesaId)
      error('mesaId', 'solo los pedidos de mesa llevan mesa');

    // 2. Un domicilio necesita a quién y a dónde llevarlo; los demás no llevan esos datos.
    if (datos.tipo === 'domicilio') {
      if (!datos.nombreCliente)
        error('nombreCliente', 'un domicilio necesita el nombre del cliente');
      if (!datos.entrega) error('entrega', 'un domicilio necesita el teléfono y la dirección');
    } else {
      if (datos.entrega) error('entrega', 'solo los domicilios llevan datos de entrega');
      if (datos.valorDomicilio !== undefined) {
        error('valorDomicilio', 'solo los domicilios cobran domicilio');
      }
    }
  });

/** PATCH /pedidos/:id/domicilio: los datos que se pueden corregir de un domicilio. */
export const esquemaActualizarDomicilio = alMenosUnCampo(
  z
    .object({
      nombreCliente: esquemaNombreCliente,
      ...camposEntrega,
      // null borra el dato.
      indicaciones: camposEntrega.indicaciones.nullable(),
      pagaCon: camposEntrega.pagaCon.nullable(),
      // Se ajusta si es lejos. Solo mientras el pedido no se haya cobrado.
      valorDomicilio: esquemaMonto,
    })
    .partial(),
);

/** POST /pedidos/:id/despachar */
export const esquemaDespachar = z.object({ domiciliarioId: esquemaId });

/** GET /pedidos?estado=abierto&mesaId=...&activos=true&incluirItems=true */
export const esquemaFiltrosPedidos = z
  .object({
    estado: z.enum(['abierto', 'enviado_a_cocina', 'pagado', 'anulado']).optional(),
    mesaId: esquemaId.optional(),
    // Solo los que aún no se cobran ni se anulan (abiertos y en cocina): mapa de mesas y cocina.
    activos: esquemaBooleanoEnUrl.optional(),
    // Las comandas del tablero de cocina: enviadas a cocina y con platos por entregar, aunque
    // ya se hayan cobrado (ver filtroComandasDeCocina en el servicio).
    cocina: esquemaBooleanoEnUrl.optional(),
    // Los domicilios en curso (sin entregar), con sus datos de entrega. Solo la caja.
    domicilios: esquemaBooleanoEnUrl.optional(),
    // Incluye los ítems de cada pedido: evita pedir el detalle de cada uno por separado.
    incluirItems: esquemaBooleanoEnUrl.optional(),
  })
  .refine(
    (filtros) =>
      [filtros.estado, filtros.activos, filtros.cocina, filtros.domicilios].filter(Boolean)
        .length <= 1,
    { message: 'use solo uno de estos filtros: estado, activos, cocina o domicilios' },
  );

/** Rutas /pedidos/:id/items/:itemId */
export const esquemaParamsItem = z.object({ id: esquemaId, itemId: esquemaId });

/** PATCH /pedidos/:id/items/:itemId/cocina */
export const esquemaEstadoCocina = z.object({
  estadoCocina: z.enum(['preparando', 'listo', 'entregado']),
});

/**
 * PATCH /pedidos/:id/cocina: todos los platos del pedido a la vez.
 * "listo" termina lo pendiente y lo que se prepara; "entregado" entrega lo que está listo.
 */
export const esquemaEstadoCocinaPedido = z.object({
  estadoCocina: z.enum(['listo', 'entregado']),
});

/** Un pago dentro del cobro. */
const esquemaPago = z
  .object({
    metodo: z.enum(['efectivo', 'tarjeta', 'transferencia', 'otro']),
    // Lo que se abona a la cuenta con este pago.
    monto: esquemaMonto.refine(
      (valor) => aDecimal(valor).greaterThan(0),
      'debe ser mayor que cero',
    ),
    // Número de aprobación del datáfono o de la transferencia.
    referencia: z.string().trim().max(100).optional(),
    // Solo en efectivo: billete que entrega el cliente, para calcular el cambio.
    recibido: esquemaMonto.optional(),
  })
  .refine((pago) => pago.recibido === undefined || pago.metodo === 'efectivo', {
    message: 'el valor recibido solo aplica a pagos en efectivo',
    path: ['recibido'],
  })
  .refine(
    (pago) =>
      pago.recibido === undefined || aDecimal(pago.recibido).greaterThanOrEqualTo(pago.monto),
    { message: 'lo recibido no puede ser menor que el monto', path: ['recibido'] },
  );

/** POST /pedidos/:id/cobrar */
export const esquemaCobrar = z.object({
  pagos: z.array(esquemaPago).min(1, 'envíe al menos un pago').max(10),
  // Propina voluntaria (Ley 1935 de 2018): la decide el cliente. Si no la da, se omite.
  // Los pagos deben sumar el total más esta propina.
  propina: esquemaMonto.optional(),
  // Cliente a cuyo nombre se factura. Sin cliente, la factura va a "consumidor final".
  clienteId: esquemaId.optional(),
});

/** POST /pedidos/:id/anular */
export const esquemaAnular = z.object({
  motivo: textoObligatorio(300),
});

/**
 * POST /pedidos/:id/dividir
 * Ítems (y cuántas unidades de cada uno) que pasan a una cuenta nueva.
 */
export const esquemaDividir = z.object({
  items: z
    .array(
      z.object({
        itemId: esquemaId,
        // Unidades que se pasan a la cuenta nueva: todas las del ítem o solo una parte.
        cantidad: esquemaCantidad,
      }),
    )
    .min(1, 'indique al menos un ítem')
    .max(100)
    .refine(
      (items) => new Set(items.map((item) => item.itemId)).size === items.length,
      'cada ítem puede aparecer una sola vez',
    ),
});
