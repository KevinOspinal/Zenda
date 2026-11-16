// @ts-check
// La hora actual, puesta al día cada cierto tiempo, para lo que muestra tiempo transcurrido
// ("Mesa 4 · 32 min", "Esperando 12 min") o el reloj de la cocina.
//
// Ojo con useNow de VueUse 15: ya no acepta `interval` (lo ignora sin avisar) y, si no recibe
// un `scheduler`, pone la hora al día en cada cuadro de la pantalla (unas 60 veces por
// segundo). Todo lo que depende de ella se recalcula y se redibuja sin parar: gasta batería y
// procesador y corta las animaciones. Por eso aquí se le da un scheduler con useIntervalFn,
// que además se detiene solo cuando se cierra la pantalla. Usa siempre useAhora, no useNow.

/**
 * Hora actual que cambia cada `cadaMs` milisegundos.
 * @param {number} cadaMs Cada cuánto se pone al día (por ejemplo, 30_000 = 30 segundos).
 * @returns {import('vue').ShallowRef<Date>}
 * @example
 * const ahora = useAhora(30_000);
 * const minutos = computed(() => minutosTranscurridos(pedido.abiertoEn, ahora.value));
 */
export function useAhora(cadaMs) {
  return useNow({ scheduler: (actualizar) => useIntervalFn(actualizar, cadaMs) });
}
