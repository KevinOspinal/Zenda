// @ts-check
// Esquemas Zod de los recibos de venta.
import { z } from 'zod';

/** GET /recibos?numero=7 */
export const esquemaFiltrosRecibos = z.object({
  // Busca un recibo por su número, por ejemplo el de un cliente que vuelve otro día.
  numero: z
    .string()
    .regex(/^[1-9]\d{0,8}$/, 'debe ser un número de recibo')
    .transform(Number)
    .optional(),
});
