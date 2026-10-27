// @ts-check
// Preferencias de este dispositivo: sonidos y vibración de los avisos.
// Se guardan en el dispositivo (no en el servidor): la tablet de la cocina puede tener los
// sonidos encendidos y el celular de un mesero, apagados.
export const usePreferenciasStore = defineStore('preferencias', () => {
  /** Suena cuando llega una comanda o un plato está listo. */
  const sonidos = useLocalStorage('zenda:sonidos', true);
  /** Vibra al agregar productos y con los avisos (solo celulares que lo permiten). */
  const vibracion = useLocalStorage('zenda:vibracion', true);

  return { sonidos, vibracion };
});
