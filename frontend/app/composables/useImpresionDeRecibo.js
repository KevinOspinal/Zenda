// @ts-check
// Imprimir el recibo de venta de un pedido sin salir de la pantalla: se dibuja en una zona que
// solo existe en el papel (ReciboParaImprimir, en app.vue) y se abre el diálogo de impresión del
// navegador, que trae su vista previa: impresora térmica o "Guardar como PDF".
// No se abre en otra pestaña: esa pestaña tendría que renovar la sesión y podría cerrar la de
// la caja.
//
// El original se imprime al cobrar. Cualquier impresión posterior sale marcada como COPIA, para
// que nadie la presente como otra venta.

export function useImpresionDeRecibo() {
  /** Pedido (con su recibo) que se va a imprimir. */
  const pedido = useState('recibo-para-imprimir', () => /** @type {any} */ (null));
  /** Si lo que se imprime es una copia (una reimpresión). */
  const copia = useState('recibo-es-copia', () => false);

  /**
   * @param {any} pedidoConRecibo Pedido completo con su `recibo` (forma del API).
   * @param {{ copia?: boolean }} [opciones] `copia: true` en las reimpresiones.
   */
  async function imprimir(pedidoConRecibo, opciones = {}) {
    pedido.value = pedidoConRecibo;
    copia.value = opciones.copia ?? false;
    // Se espera a que el recibo esté dibujado antes de abrir el diálogo.
    await nextTick();
    window.print();
  }

  return { pedido, copia, imprimir };
}
