// @ts-check
// Preferencias de este dispositivo: sonidos (de los avisos y al tocar), vibración y el ancho
// del papel de la impresora de recibos.
// Se guardan en el dispositivo (no en el servidor): la tablet de la cocina puede tener los
// sonidos encendidos y el celular de un mesero, apagados.
export const usePreferenciasStore = defineStore('preferencias', () => {
  /** Avisos que llegan solos: una comanda nueva o con cambios, un plato listo, un domicilio. */
  const sonidos = useLocalStorage('zenda:sonidos', true);
  /** Respuesta a lo que se hace: agregar un producto, enviar a la cocina, cobrar, un error. */
  const sonidosAlTocar = useLocalStorage('zenda:sonidos-al-tocar', true);
  /** Vibra al agregar productos y con los avisos (solo celulares que lo permiten). */
  const vibracion = useLocalStorage('zenda:vibracion', true);
  /** Ancho del papel de la impresora térmica de recibos: "80" o "58" milímetros. */
  const anchoRecibo = useLocalStorage('zenda:ancho-recibo', '80');

  return { sonidos, sonidosAlTocar, vibracion, anchoRecibo };
});
