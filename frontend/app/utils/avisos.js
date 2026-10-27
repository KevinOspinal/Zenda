// @ts-check
// Avisos de platos listos sin saturar: los de una misma mesa se juntan en uno solo, y el
// sonido y la vibración suenan como máximo una vez cada pocos segundos.

/** Tiempo que el aviso de una mesa sigue en pantalla y suma los platos que van saliendo. */
export const VENTANA_AVISO_MS = 8000;

/** Tiempo mínimo entre dos sonidos (y vibraciones) de platos listos. */
export const INTERVALO_SONIDO_MS = 4000;

/**
 * Lleva la cuenta de los platos listos avisados por pedido, para juntar en un solo aviso los
 * de una misma mesa, y decide cuándo puede volver a sonar.
 * @param {{ ventanaMs?: number, intervaloSonidoMs?: number }} [opciones]
 */
export function crearAgrupadorDeAvisos({
  ventanaMs = VENTANA_AVISO_MS,
  intervaloSonidoMs = INTERVALO_SONIDO_MS,
} = {}) {
  /** @type {Map<string, { cantidad: number, hasta: number }>} */
  const porPedido = new Map();
  let ultimoSonido = -Infinity;

  return {
    /**
     * Registra platos que acaban de quedar listos en un pedido.
     * @param {string} pedidoId
     * @param {number} cantidad
     * @param {number} [ahora]
     * @returns {{ cantidad: number, sonar: boolean }} Cuántos platos lleva el aviso de ese
     *   pedido (si sigue en pantalla, se suman) y si toca sonar y vibrar.
     */
    registrar(pedidoId, cantidad, ahora = Date.now()) {
      const previo = porPedido.get(pedidoId);
      const acumulado = (previo && previo.hasta > ahora ? previo.cantidad : 0) + cantidad;
      porPedido.set(pedidoId, { cantidad: acumulado, hasta: ahora + ventanaMs });
      const sonar = ahora - ultimoSonido >= intervaloSonidoMs;
      if (sonar) ultimoSonido = ahora;
      return { cantidad: acumulado, sonar };
    },

    /**
     * Olvida un pedido: sus platos ya se entregaron.
     * @param {string} pedidoId
     */
    olvidar(pedidoId) {
      porPedido.delete(pedidoId);
    },
  };
}

/**
 * Texto del aviso: el plato si es uno solo, o cuántos son.
 * Por ejemplo: "Mesa 4 · IND Classic" o "Mesa 4 · 3 platos listos".
 * @param {string} nombrePedido
 * @param {number} cantidad
 * @param {string} producto El último plato que quedó listo.
 */
export function textoDeAvisoListo(nombrePedido, cantidad, producto) {
  return cantidad === 1
    ? `${nombrePedido} · ${producto}`
    : `${nombrePedido} · ${cantidad} platos listos`;
}
