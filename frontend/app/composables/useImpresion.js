// @ts-check
// Imprimir un documento sin salir de la pantalla: se dibuja en una zona que solo existe en el
// papel (DocumentoParaImprimir, en app.vue) y se abre el diálogo de impresión del navegador,
// que trae su vista previa: impresora térmica o "Guardar como PDF".
// No se abre en otra pestaña: esa pestaña tendría que renovar la sesión y podría cerrar la de
// la caja.
//
// Hay dos documentos: el recibo de venta (ver useImpresionDeRecibo) y la precuenta (ver
// useImpresionDePrecuenta). Solo uno se imprime a la vez.

/**
 * @typedef {{ tipo: 'recibo', pedido: any, copia: boolean }
 *   | { tipo: 'precuenta', pedido: any, negocio: any, fecha: string }} DocumentoParaImprimir
 * `fecha` de la precuenta: cuándo se imprimió.
 */

export function useImpresion() {
  /** Documento que se está imprimiendo (o el último que se imprimió). */
  const documento = useState(
    'documento-para-imprimir',
    () => /** @type {DocumentoParaImprimir | null} */ (null),
  );

  /**
   * Dibuja el documento en la zona de impresión y abre el diálogo de impresión.
   * @param {DocumentoParaImprimir} nuevo
   */
  async function imprimir(nuevo) {
    documento.value = nuevo;
    // Se espera a que el documento esté dibujado antes de abrir el diálogo.
    await nextTick();
    window.print();
  }

  return { documento, imprimir };
}
