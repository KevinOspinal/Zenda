// @ts-check
// Recibo de venta: el documento que entrega un negocio que no factura electrónicamente (no
// responsable de IVA ni del impuesto al consumo). Se emite al cobrar, con numeración propia y
// continua, y guarda los datos del negocio con que se emitió para reimprimirlo igual.
//
// ⚠️ PENDIENTE DE VALIDAR CON UN CONTADOR: el contenido y las leyendas del recibo.
import { facturaElectronica } from '../../config/impuestos.js';

/** @typedef {import('../../lib/negocio.js').TransaccionPrisma} TransaccionPrisma */

/**
 * Emite el recibo de un pedido recién cobrado, si el negocio no factura electrónicamente.
 * Un negocio que sí factura no recibe recibo: su documento es la factura electrónica.
 * @param {TransaccionPrisma} tx Transacción del cobro.
 * @param {string} tenantId
 * @param {string} pedidoId
 * @returns {Promise<object | null>} El recibo, o null si el negocio factura electrónicamente.
 */
export async function emitirReciboSiNoFactura(tx, tenantId, pedidoId) {
  const { regimenImpuesto, ...encabezado } = await tx.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: {
      regimenImpuesto: true,
      nombre: true,
      nit: true,
      ciudad: true,
      direccion: true,
      telefono: true,
      pieRecibo: true,
    },
  });
  if (facturaElectronica(regimenImpuesto)) return null;

  // Una sola instrucción incrementa y devuelve el número: dos cajas nunca repiten número.
  /** @type {{ ultimo_recibo: number }[]} */
  const [{ ultimo_recibo: numero }] = await tx.$queryRaw`
    UPDATE tenants SET ultimo_recibo = ultimo_recibo + 1
    WHERE id = ${tenantId}::uuid
    RETURNING ultimo_recibo`;

  return tx.reciboVenta.create({ data: { tenantId, pedidoId, numero, encabezado } });
}
