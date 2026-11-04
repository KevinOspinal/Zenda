// @ts-check
// Imprimir el recibo de venta de un pedido (ver useImpresion).
//
// El original se imprime al cobrar. Cualquier impresión posterior sale marcada como COPIA, para
// que nadie la presente como otra venta.

export function useImpresionDeRecibo() {
  const { documento, imprimir: imprimirDocumento } = useImpresion();

  /** Pedido (con su recibo) que se imprime; null si lo que se imprime no es un recibo. */
  const pedido = computed(() =>
    documento.value?.tipo === 'recibo' ? documento.value.pedido : null,
  );
  /** Si lo que se imprime es una copia (una reimpresión). */
  const copia = computed(() => documento.value?.tipo === 'recibo' && documento.value.copia);

  /**
   * @param {any} pedidoConRecibo Pedido completo con su `recibo` (forma del API).
   * @param {{ copia?: boolean }} [opciones] `copia: true` en las reimpresiones.
   */
  function imprimir(pedidoConRecibo, opciones = {}) {
    return imprimirDocumento({
      tipo: 'recibo',
      pedido: pedidoConRecibo,
      copia: opciones.copia ?? false,
    });
  }

  return { pedido, copia, imprimir };
}
