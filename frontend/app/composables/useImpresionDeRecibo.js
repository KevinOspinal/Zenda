// @ts-check
// Imprimir el recibo de venta de un pedido sin salir de la pantalla: se dibuja en una zona que
// solo existe en el papel (ReciboParaImprimir, en app.vue) y se abre el diálogo de impresión del
// navegador, que trae su vista previa: impresora térmica o "Guardar como PDF".
// No se abre en otra pestaña: esa pestaña tendría que renovar la sesión y podría cerrar la de
// la caja.

export function useImpresionDeRecibo() {
  /** Pedido (con su recibo) que se va a imprimir. */
  const pedido = useState('recibo-para-imprimir', () => /** @type {any} */ (null));

  /**
   * @param {any} pedidoConRecibo Pedido completo con su `recibo` (forma del API).
   */
  async function imprimir(pedidoConRecibo) {
    pedido.value = pedidoConRecibo;
    // Se espera a que el recibo esté dibujado antes de abrir el diálogo.
    await nextTick();
    window.print();
  }

  return { pedido, imprimir };
}
