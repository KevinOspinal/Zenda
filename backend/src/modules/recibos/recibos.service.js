// @ts-check
// Consulta de los recibos de venta, para reimprimirlos desde la caja. Se emiten al cobrar
// (ver pedidos/recibos.js); para reimprimir uno se trae su pedido completo con GET /pedidos/:id.
import { conNegocio } from '../../lib/negocio.js';

/** @typedef {import('../../lib/tokens.js').DatosSesion} DatosSesion */

/** Cuántos recibos muestra la caja: los del día o poco más. Los viejos se buscan por número. */
const ULTIMOS = 20;

/**
 * Lista los últimos recibos del negocio, del más reciente al más antiguo, con un resumen de
 * su pedido para reconocerlo en la caja. Con `numero`, trae solo ese recibo.
 * @param {DatosSesion} sesion
 * @param {{ numero?: number }} filtros
 */
export function listarRecibos(sesion, { numero }) {
  return conNegocio(sesion.tenantId, (tx) =>
    tx.reciboVenta.findMany({
      where: numero === undefined ? {} : { numero },
      orderBy: { numero: 'desc' },
      take: ULTIMOS,
      select: {
        id: true,
        pedidoId: true,
        numero: true,
        emitidoEn: true,
        pedido: {
          select: {
            tipo: true,
            numero: true,
            nombreCliente: true,
            total: true,
            mesa: { select: { nombre: true } },
            pagos: { select: { metodo: true } },
          },
        },
      },
    }),
  );
}
