// @ts-check
// Tiempo real con Socket.IO: nombres de los eventos y manejo de la conexión.
//
// El backend une cada dispositivo a la sala de su negocio y le envía los cambios en vivo.
// Reglas de la conexión (ver backend/src/sockets/servidor.js):
// - Se autentica con el token de acceso vigente (auth.token).
// - Cuando el token vence, el servidor avisa (sesion:expirada) y desconecta: hay que
//   volver a conectar con un token nuevo. Socket.IO no lo hace solo en ese caso.
// - Si rechaza la conexión por el token (TOKEN_EXPIRADO, TOKEN_INVALIDO, NO_AUTENTICADO),
//   tampoco reintenta solo.
// - Si se cae la red, Socket.IO reintenta solo.

/** Eventos que envía el backend. Usar siempre estas constantes, nunca texto suelto. */
export const EVENTOS_EN_VIVO = Object.freeze({
  PEDIDO_CREADO: 'pedido:creado',
  PEDIDO_ACTUALIZADO: 'pedido:actualizado',
  PEDIDO_ENVIADO_A_COCINA: 'pedido:enviado_a_cocina',
  PEDIDO_PAGADO: 'pedido:pagado',
  PEDIDO_ANULADO: 'pedido:anulado',
  ITEM_ESTADO_COCINA: 'item:estado_cocina',
  // Varios platos de un pedido cambiaron a la vez ("Todo listo", "Entregar todo").
  PEDIDO_ESTADO_COCINA: 'pedido:estado_cocina',
  MESA_ESTADO: 'mesa:estado',
  CAJA_ABIERTA: 'caja:abierta',
  CAJA_CERRADA: 'caja:cerrada',
  SESION_EXPIRADA: 'sesion:expirada',
});

/** Si al token le quedan menos de estos milisegundos, se renueva antes de reconectar. */
const MARGEN_TOKEN_MS = 30_000;

/**
 * @typedef {object} SesionParaConexion
 * @property {boolean} activa
 * @property {number} venceEn Momento (ms) en que vence el token de acceso.
 * @property {() => Promise<void>} renovar
 */

/**
 * @typedef {object} EstadoConexion
 * @property {boolean} socketConectado
 * @property {boolean} reconectando
 */

/**
 * Estado del indicador de conexión de la barra superior.
 * @param {{ enLinea: boolean, socketConectado: boolean, reconectando: boolean }} datos
 * @returns {'en_vivo' | 'reconectando' | 'sin_conexion'}
 */
export function estadoDeConexion({ enLinea, socketConectado, reconectando }) {
  if (!enLinea) return 'sin_conexion';
  if (socketConectado) return 'en_vivo';
  return reconectando ? 'reconectando' : 'sin_conexion';
}

/**
 * Registra en el socket todo el manejo de la conexión: estado del indicador, reconexión
 * con token nuevo y reintentos. Recibe el socket ya creado para poder probarlo con uno
 * simulado.
 * @param {import('socket.io-client').Socket} socket
 * @param {{ sesion: SesionParaConexion, conexion: EstadoConexion }} estado
 */
export function manejarConexion(socket, { sesion, conexion }) {
  /** Vuelve a conectar con un token vigente (lo renueva si está por vencer). */
  async function reconectarConTokenNuevo() {
    if (!sesion.activa) return;
    conexion.reconectando = true;
    try {
      if (sesion.venceEn - Date.now() < MARGEN_TOKEN_MS) await sesion.renovar();
      if (sesion.activa) socket.connect();
    } catch {
      // Si el refresh token ya no sirve, renovar() cerró la sesión y la app vuelve al ingreso.
      // Sin conexión, se reintenta cuando vuelva la red.
      conexion.reconectando = false;
    }
  }

  socket.on('connect', () => {
    conexion.socketConectado = true;
    conexion.reconectando = false;
  });

  socket.on('disconnect', (motivo) => {
    conexion.socketConectado = false;
    // El servidor la cerró (por ejemplo, venció el token): hay que reconectar a mano.
    if (motivo === 'io server disconnect') {
      reconectarConTokenNuevo();
      return;
    }
    // La cerró la app (al salir): no se reintenta. Cualquier otro motivo: Socket.IO reintenta.
    conexion.reconectando = motivo !== 'io client disconnect';
  });

  socket.on('connect_error', () => {
    conexion.socketConectado = false;
    // Si el socket ya no está activo, el servidor rechazó el token: renovar y reconectar.
    // Si sigue activo, es un problema de red y Socket.IO reintenta solo.
    if (socket.active) conexion.reconectando = true;
    else reconectarConTokenNuevo();
  });

  socket.io.on('reconnect_attempt', () => {
    conexion.reconectando = true;
  });
}
