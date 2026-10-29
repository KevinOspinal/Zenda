// @ts-check
// Últimos recibos de venta del negocio, para reimprimirlos desde la caja. Solo los emiten los
// negocios que no facturan electrónicamente.
//
// - La lista viene de GET /recibos: un resumen de cada recibo, del más reciente al más antiguo.
// - Para reimprimir se trae el pedido completo con GET /pedidos/:id, que trae el recibo con los
//   datos del negocio con que se emitió: la copia sale igual al original.

export const useRecibosStore = defineStore('recibos', () => {
  /** Recibos de la última consulta. */
  const lista = ref(/** @type {any[]} */ ([]));
  /** sin_cargar · cargando · listo · error */
  const estadoCarga = ref('sin_cargar');
  /** Número buscado en la última consulta; null si se trajeron los últimos. */
  const numeroBuscado = ref(/** @type {number | null} */ (null));

  /**
   * Trae los últimos recibos o, con un número, ese recibo.
   * @param {number | null} [numero]
   */
  async function cargar(numero = null) {
    estadoCarga.value = 'cargando';
    numeroBuscado.value = numero;
    try {
      const recibos = await useApi().get('/recibos', numero ? { numero } : undefined);
      // Si mientras tanto se buscó otro número, esta respuesta ya no sirve.
      if (numeroBuscado.value !== numero) return;
      lista.value = recibos;
      estadoCarga.value = 'listo';
    } catch {
      if (numeroBuscado.value === numero) estadoCarga.value = 'error';
    }
  }

  /**
   * Pedido completo de un recibo, listo para imprimir.
   * @param {string} pedidoId
   */
  function traerPedido(pedidoId) {
    return useApi().get(`/pedidos/${pedidoId}`);
  }

  return { lista, estadoCarga, numeroBuscado, cargar, traerPedido };
});
