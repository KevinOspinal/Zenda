// @ts-check
// Esquemas Zod del inventario.
import { z } from 'zod';
import { aDecimal } from '../../lib/dinero.js';
import { esquemaId } from '../../lib/esquemas.js';

/** Cantidad con signo y máximo 3 decimales, entregada como texto para convertirla a Decimal. */
const esquemaCantidadConSigno = z
  .union([z.string().trim(), z.number()])
  .transform(String)
  .pipe(z.string().regex(/^-?\d{1,9}(\.\d{1,3})?$/, 'debe ser un número con máximo 3 decimales'))
  .refine((valor) => !aDecimal(valor).isZero(), 'no puede ser cero');

/**
 * POST /inventario/movimientos
 * - compra: entrada de mercancía, siempre positiva.
 * - ajuste: corrección por conteo físico, rotura o pérdida; positiva o negativa y con motivo.
 * Las ventas no se registran aquí: las genera el cobro de los pedidos.
 */
export const esquemaRegistrarMovimiento = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('compra'),
    productoId: esquemaId,
    cantidad: esquemaCantidadConSigno.refine(
      (valor) => aDecimal(valor).greaterThan(0),
      'una compra debe ser positiva',
    ),
  }),
  z.object({
    tipo: z.literal('ajuste'),
    productoId: esquemaId,
    cantidad: esquemaCantidadConSigno,
    // Obligatorio: un ajuste puede ocultar un faltante, por eso queda en la auditoría.
    motivo: z.string().trim().min(3, 'explique el motivo del ajuste').max(300),
  }),
]);

/** GET /inventario/:productoId/movimientos */
export const esquemaParamsProducto = z.object({ productoId: esquemaId });
