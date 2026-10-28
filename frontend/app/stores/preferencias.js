// @ts-check
// Preferencias de este dispositivo: sonidos y vibración de los avisos, y el ancho del papel de
// la impresora de recibos.
// Se guardan en el dispositivo (no en el servidor): la tablet de la cocina puede tener los
// sonidos encendidos y el celular de un mesero, apagados.
export const usePreferenciasStore = defineStore('preferencias', () => {
  /** Suena cuando llega una comanda o un plato está listo. */
  const sonidos = useLocalStorage('zenda:sonidos', true);
  /** Vibra al agregar productos y con los avisos (solo celulares que lo permiten). */
  const vibracion = useLocalStorage('zenda:vibracion', true);
  /** Ancho del papel de la impresora térmica de recibos: "80" o "58" milímetros. */
  const anchoRecibo = useLocalStorage('zenda:ancho-recibo', '80');

  return { sonidos, vibracion, anchoRecibo };
});
