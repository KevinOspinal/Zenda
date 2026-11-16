// @ts-check
// Ayudas para las transiciones de las listas de tarjetas con vista rápida al lado (inventario).
// Vue anima con FLIP las tarjetas que se reacomodan, pero la que sale y el panel que se cierra
// siguen ocupando su lugar hasta que terminan de irse, y las demás saltan al final. Estas
// funciones los dejan "flotando" (posición absoluta) en el sitio exacto donde estaban, para que
// lo demás se deslice de una vez a su nuevo lugar. Se usan en @before-leave.

/**
 * La tarjeta que sale se queda donde estaba, con su tamaño, mientras se desvanece.
 * Su contenedor debe tener `position: relative`.
 * @param {Element} elemento
 */
export function fijarAlSalir(elemento) {
  const tarjeta = /** @type {HTMLElement} */ (elemento);
  const { offsetLeft, offsetTop, offsetWidth, offsetHeight } = tarjeta;
  Object.assign(tarjeta.style, {
    left: `${offsetLeft}px`,
    top: `${offsetTop}px`,
    width: `${offsetWidth}px`,
    height: `${offsetHeight}px`,
  });
}

/**
 * El panel que se cierra se queda donde estaba dentro de su fila (que debe tener
 * `position: relative`), aunque sea `sticky` y la página esté desplazada.
 * @param {Element} elemento
 */
export function fijarPanelAlSalir(elemento) {
  const panel = /** @type {HTMLElement} */ (elemento);
  const fila = panel.parentElement;
  if (!fila) return;
  const lugar = panel.getBoundingClientRect();
  const origen = fila.getBoundingClientRect();
  Object.assign(panel.style, {
    top: `${lugar.top - origen.top}px`,
    left: `${lugar.left - origen.left}px`,
    width: `${lugar.width}px`,
    height: `${lugar.height}px`,
  });
}
