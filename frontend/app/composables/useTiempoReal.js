// @ts-check
// Acceso a la conexión en tiempo real para escuchar eventos del backend.
// La conexión la crea y la mantiene el plugin plugins/01.tiempo-real.client.js.

/**
 * Devuelve el socket del tiempo real.
 * Quien registra un oyente debe quitarlo al terminar (por ejemplo, en onBeforeUnmount)
 * para no recibir el mismo evento dos veces.
 * @example
 * const socket = useTiempoReal();
 * const alCambiarMesa = (datos) => { ... };
 * socket.on(EVENTOS_EN_VIVO.MESA_ESTADO, alCambiarMesa);
 * onBeforeUnmount(() => socket.off(EVENTOS_EN_VIVO.MESA_ESTADO, alCambiarMesa));
 * @returns {import('socket.io-client').Socket}
 */
export function useTiempoReal() {
  return /** @type {import('socket.io-client').Socket} */ (useNuxtApp().$socket);
}
