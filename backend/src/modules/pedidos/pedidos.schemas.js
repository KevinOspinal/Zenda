// @ts-check
// Esquemas Zod de pedidos, ítems y pagos.
import { z } from 'zod';
import { aDecimal } from '../../lib/dinero.js';
import {
  esquemaBooleanoEnUrl,
  esquemaId,
  esquemaMonto,
  textoObligatorio,
} from '../../lib/esquemas.js';

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

/** POST /pedidos */
export const esquemaCrearPedido = z.object({
  // Sin mesa es una venta de mostrador.
  mesaId: esquemaId.optional(),
  // Lo genera la app cuando vende sin internet: si el pedido llega dos veces, no se duplica.
  uuidOffline: z.uuid('uuidOffline debe ser un UUID').optional(),
  items: z.array(esquemaItem).max(100).default([]),
});

/** GET /pedidos?estado=abierto&mesaId=...&activos=true&incluirItems=true */
export const esquemaFiltrosPedidos = z
  .object({
    estado: z.enum(['abierto', 'enviado_a_cocina', 'pagado', 'anulado']).optional(),
    mesaId: esquemaId.optional(),
    // Solo los que aún no se cobran ni se anulan (abiertos y en cocina): mapa de mesas y cocina.
    activos: esquemaBooleanoEnUrl.optional(),
    // Incluye los ítems de cada pedido: evita pedir el detalle de cada uno por separado.
    incluirItems: esquemaBooleanoEnUrl.optional(),
  })
  .refine((filtros) => !(filtros.activos && filtros.estado), {
    message: 'use estado o activos, no ambos',
    path: ['activos'],
  });

/** Rutas /pedidos/:id/items/:itemId */
export const esquemaParamsItem = z.object({ id: esquemaId, itemId: esquemaId });

/** PATCH /pedidos/:id/items/:itemId/cocina */
export const esquemaEstadoCocina = z.object({
  estadoCocina: z.enum(['preparando', 'listo', 'entregado']),
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
