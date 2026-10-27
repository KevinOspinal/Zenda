// @ts-check
// Reportes de ventas: resumen del periodo, ventas por producto y por método de pago.
//
// Reglas:
// - Una venta cuenta en el día y la hora en que se cobró (`cerrado_en`), en hora de Colombia.
// - Solo cuentan los pedidos pagados. Los anulados se muestran aparte en el resumen.
// - Las sumas se hacen en PostgreSQL dentro de `conNegocio`: RLS también aplica a estas
//   consultas. El filtro explícito por tenant_id además aprovecha el índice (tenant_id, cerrado_en).
import { Decimal, aDecimal, redondearMonto, sumar } from '../../lib/dinero.js';
import { ZONA_HORARIA, rangoDeDias } from '../../lib/fechas.js';
import { conNegocio } from '../../lib/negocio.js';

/** @typedef {import('../../lib/tokens.js').DatosSesion} DatosSesion */
/** @typedef {import('../../lib/dinero.js').ValorNumerico} ValorNumerico */
/** @typedef {{ desde: string, hasta: string }} Rango */

/** Métodos de pago, en el orden en que se muestran. */
const METODOS_PAGO = /** @type {const} */ (['efectivo', 'tarjeta', 'transferencia', 'otro']);

/** Tipos y orígenes de pedido, en el orden en que se muestran. */
const TIPOS_PEDIDO = /** @type {const} */ (['mesa', 'mostrador', 'domicilio']);
const ORIGENES_PEDIDO = /** @type {const} */ (['local', 'whatsapp', 'telefono', 'otro']);

/**
 * Completa una agrupación con todos los valores posibles, en su orden y con cero los que no
 * tuvieron ventas, para que la pantalla siempre muestre la misma lista.
 * @param {ReadonlyArray<string>} valores
 * @param {{ clave: string, ventas: number, total: ValorNumerico }[]} filas
 */
function completarGrupos(valores, filas) {
  return valores.map((valor) => {
    const fila = filas.find((f) => f.clave === valor);
    return {
      clave: valor,
      ventas: fila?.ventas ?? 0,
      total: aDecimal(fila?.total ?? 0).toFixed(2),
    };
  });
}

/**
 * Resumen del periodo: totales, ticket promedio, anulaciones, ventas por hora y por día, y por
 * tipo de pedido (mesa, mostrador, domicilio) y por origen (local, WhatsApp, teléfono, otro).
 * @param {DatosSesion} sesion
 * @param {Rango} rango
 */
export function obtenerResumen(sesion, rango) {
  const { inicio, fin } = rangoDeDias(rango.desde, rango.hasta);
  const { tenantId } = sesion;

  return conNegocio(tenantId, async (tx) => {
    // 1. Totales de las ventas pagadas.
    /** @type {{ ventas: number, total: ValorNumerico, subtotal: ValorNumerico,
     *   impuestos: ValorNumerico, ajuste: ValorNumerico, propinas: ValorNumerico }[]} */
    const [totales] = await tx.$queryRaw`
      SELECT count(*)::int                      AS ventas,
             coalesce(sum(total), 0)           AS total,
             coalesce(sum(subtotal), 0)        AS subtotal,
             coalesce(sum(impuestos), 0)       AS impuestos,
             coalesce(sum(ajuste_redondeo), 0) AS ajuste,
             coalesce(sum(propina), 0)         AS propinas
      FROM pedidos
      WHERE tenant_id = ${tenantId}::uuid AND estado = 'pagado'
        AND cerrado_en >= ${inicio} AND cerrado_en < ${fin}`;

    // 2. Anulaciones del periodo (no suman a las ventas).
    /** @type {{ cantidad: number, total: ValorNumerico }[]} */
    const [anulaciones] = await tx.$queryRaw`
      SELECT count(*)::int AS cantidad, coalesce(sum(total), 0) AS total
      FROM pedidos
      WHERE tenant_id = ${tenantId}::uuid AND estado = 'anulado'
        AND cerrado_en >= ${inicio} AND cerrado_en < ${fin}`;

    // 3. Ventas por hora del día (0 a 23, hora de Colombia): muestra la hora pico.
    /** @type {{ hora: number, ventas: number, total: ValorNumerico }[]} */
    const porHora = await tx.$queryRaw`
      SELECT extract(hour FROM cerrado_en AT TIME ZONE ${ZONA_HORARIA})::int AS hora,
             count(*)::int AS ventas, sum(total) AS total
      FROM pedidos
      WHERE tenant_id = ${tenantId}::uuid AND estado = 'pagado'
        AND cerrado_en >= ${inicio} AND cerrado_en < ${fin}
      GROUP BY 1 ORDER BY 1`;

    // 4. Ventas por día (útil cuando el rango tiene varios días).
    /** @type {{ fecha: string, ventas: number, total: ValorNumerico }[]} */
    const porDia = await tx.$queryRaw`
      SELECT to_char(cerrado_en AT TIME ZONE ${ZONA_HORARIA}, 'YYYY-MM-DD') AS fecha,
             count(*)::int AS ventas, sum(total) AS total
      FROM pedidos
      WHERE tenant_id = ${tenantId}::uuid AND estado = 'pagado'
        AND cerrado_en >= ${inicio} AND cerrado_en < ${fin}
      GROUP BY 1 ORDER BY 1`;

    // 5. Ventas por tipo de pedido y por origen: cuánto vende cada canal.
    /** @type {{ clave: string, ventas: number, total: ValorNumerico }[]} */
    const porTipo = await tx.$queryRaw`
      SELECT tipo::text AS clave, count(*)::int AS ventas, sum(total) AS total
      FROM pedidos
      WHERE tenant_id = ${tenantId}::uuid AND estado = 'pagado'
        AND cerrado_en >= ${inicio} AND cerrado_en < ${fin}
      GROUP BY 1`;
    /** @type {{ clave: string, ventas: number, total: ValorNumerico }[]} */
    const porOrigen = await tx.$queryRaw`
      SELECT origen::text AS clave, count(*)::int AS ventas, sum(total) AS total
      FROM pedidos
      WHERE tenant_id = ${tenantId}::uuid AND estado = 'pagado'
        AND cerrado_en >= ${inicio} AND cerrado_en < ${fin}
      GROUP BY 1`;

    // 6. Ticket promedio: lo que gasta en promedio cada venta.
    const total = aDecimal(totales.total);
    const ticketPromedio =
      totales.ventas > 0 ? redondearMonto(total.dividedBy(totales.ventas)) : new Decimal(0);

    return {
      rango,
      ventas: totales.ventas,
      total: total.toFixed(2),
      subtotal: aDecimal(totales.subtotal).toFixed(2),
      impuestos: aDecimal(totales.impuestos).toFixed(2),
      ajusteRedondeo: aDecimal(totales.ajuste).toFixed(2),
      // Las propinas no son ventas del negocio: van aparte y no suman al total.
      propinas: aDecimal(totales.propinas).toFixed(2),
      ticketPromedio: ticketPromedio.toFixed(2),
      anulaciones: {
        cantidad: anulaciones.cantidad,
        total: aDecimal(anulaciones.total).toFixed(2),
      },
      porHora: porHora.map((fila) => ({ ...fila, total: aDecimal(fila.total).toFixed(2) })),
      porDia: porDia.map((fila) => ({ ...fila, total: aDecimal(fila.total).toFixed(2) })),
      porTipo: completarGrupos(TIPOS_PEDIDO, porTipo).map(({ clave, ...fila }) => ({
        tipo: clave,
        ...fila,
      })),
      porOrigen: completarGrupos(ORIGENES_PEDIDO, porOrigen).map(({ clave, ...fila }) => ({
        origen: clave,
        ...fila,
      })),
    };
  });
}

/**
 * Ranking de productos vendidos en el periodo, del que más vendió al que menos.
 * @param {DatosSesion} sesion
 * @param {Rango} rango
 */
export function obtenerVentasPorProducto(sesion, rango) {
  const { inicio, fin } = rangoDeDias(rango.desde, rango.hasta);
  const { tenantId } = sesion;

  return conNegocio(tenantId, async (tx) => {
    // El valor de cada línea es precio × cantidad con el precio del momento de la venta.
    /** @type {{ productoId: string, producto: string, categoria: string,
     *   cantidad: ValorNumerico, total: ValorNumerico }[]} */
    const filas = await tx.$queryRaw`
      SELECT pr.id AS "productoId", pr.nombre AS producto, ca.nombre AS categoria,
             sum(it.cantidad) AS cantidad,
             sum(it.precio_unitario * it.cantidad) AS total
      FROM items_pedido it
      JOIN pedidos pe    ON pe.id = it.pedido_id
      JOIN productos pr  ON pr.id = it.producto_id
      JOIN categorias ca ON ca.id = pr.categoria_id
      WHERE pe.tenant_id = ${tenantId}::uuid AND pe.estado = 'pagado'
        AND pe.cerrado_en >= ${inicio} AND pe.cerrado_en < ${fin}
      GROUP BY pr.id, pr.nombre, ca.nombre
      ORDER BY total DESC, pr.nombre`;

    const totalGeneral = sumar(filas.map((fila) => fila.total));

    return {
      rango,
      total: redondearMonto(totalGeneral).toFixed(2),
      productos: filas.map((fila) => ({
        productoId: fila.productoId,
        producto: fila.producto,
        categoria: fila.categoria,
        cantidad: aDecimal(fila.cantidad).toString(),
        total: redondearMonto(fila.total).toFixed(2),
        participacion: porcentaje(fila.total, totalGeneral),
      })),
    };
  });
}

/**
 * Lo cobrado con cada método de pago en el periodo. Siempre trae los 4 métodos.
 * Incluye las propinas, porque el cliente las paga junto con la cuenta.
 * @param {DatosSesion} sesion
 * @param {Rango} rango
 */
export function obtenerVentasPorMetodoPago(sesion, rango) {
  const { inicio, fin } = rangoDeDias(rango.desde, rango.hasta);
  const { tenantId } = sesion;

  return conNegocio(tenantId, async (tx) => {
    /** @type {{ metodo: string, pagos: number, total: ValorNumerico }[]} */
    const filas = await tx.$queryRaw`
      SELECT pa.metodo::text AS metodo, count(*)::int AS pagos, sum(pa.monto) AS total
      FROM pagos pa
      JOIN pedidos pe ON pe.id = pa.pedido_id
      WHERE pe.tenant_id = ${tenantId}::uuid AND pe.estado = 'pagado'
        AND pe.cerrado_en >= ${inicio} AND pe.cerrado_en < ${fin}
      GROUP BY 1`;

    const totalGeneral = sumar(filas.map((fila) => fila.total));

    return {
      rango,
      total: totalGeneral.toFixed(2),
      metodos: METODOS_PAGO.map((metodo) => {
        const fila = filas.find((f) => f.metodo === metodo);
        const total = fila ? aDecimal(fila.total) : new Decimal(0);
        return {
          metodo,
          pagos: fila?.pagos ?? 0,
          total: total.toFixed(2),
          participacion: porcentaje(total, totalGeneral),
        };
      }),
    };
  });
}

/**
 * Porcentaje que representa una parte del total, con 2 decimales. "0.00" si el total es cero.
 * @param {ValorNumerico} parte
 * @param {ValorNumerico} total
 */
function porcentaje(parte, total) {
  const base = aDecimal(total);
  if (base.isZero()) return '0.00';
  return redondearMonto(aDecimal(parte).dividedBy(base).times(100)).toFixed(2);
}
