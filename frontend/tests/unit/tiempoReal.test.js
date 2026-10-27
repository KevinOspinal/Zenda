// @ts-check
// Pruebas del manejo de la conexión en tiempo real, con un socket simulado.
import { describe, expect, it, vi } from 'vitest';
import { estadoDeConexion, manejarConexion } from '../../app/utils/tiempoReal.js';

/**
 * Socket simulado: guarda los oyentes y deja disparar eventos como si vinieran del servidor.
 * @param {{ activo?: boolean }} [opciones]
 */
function crearSocketFalso({ activo = true } = {}) {
  /** @type {Record<string, Function[]>} */
  const oyentes = {};
  /** @type {Record<string, Function[]>} */
  const oyentesDelGestor = {};
  return {
    active: activo,
    connect: vi.fn(),
    /** @param {string} evento @param {Function} oyente */
    on: (evento, oyente) => (oyentes[evento] ??= []).push(oyente),
    io: {
      /** @param {string} evento @param {Function} oyente */
      on: (evento, oyente) => (oyentesDelGestor[evento] ??= []).push(oyente),
    },
    /** @param {string} evento @param {unknown[]} datos */
    disparar: async (evento, ...datos) => {
      for (const oyente of oyentes[evento] ?? []) await oyente(...datos);
    },
    /** @param {string} evento */
    dispararEnGestor: async (evento) => {
      for (const oyente of oyentesDelGestor[evento] ?? []) await oyente();
    },
  };
}

/**
 * Sesión simulada.
 * @param {{ venceEnMs?: number, activa?: boolean }} [opciones] Milisegundos para que venza el token.
 */
function crearSesionFalsa({ venceEnMs = 10 * 60_000, activa = true } = {}) {
  const sesion = {
    activa,
    venceEn: Date.now() + venceEnMs,
    renovar: vi.fn(async () => {
      sesion.venceEn = Date.now() + 15 * 60_000;
    }),
  };
  return sesion;
}

/** Prepara un socket simulado con el manejo de la conexión. */
function preparar({ activo = true, venceEnMs = 10 * 60_000, sesionActiva = true } = {}) {
  const socket = crearSocketFalso({ activo });
  const sesion = crearSesionFalsa({ venceEnMs, activa: sesionActiva });
  const conexion = { socketConectado: false, reconectando: true };
  manejarConexion(/** @type {any} */ (socket), { sesion, conexion });
  return { socket, sesion, conexion };
}

describe('estadoDeConexion (indicador de la barra)', () => {
  it('sin red: sin conexión, aunque el socket diga otra cosa', () => {
    expect(estadoDeConexion({ enLinea: false, socketConectado: true, reconectando: false })).toBe(
      'sin_conexion',
    );
  });

  it('con red: en vivo si el socket está conectado, si no, reconectando', () => {
    expect(estadoDeConexion({ enLinea: true, socketConectado: true, reconectando: false })).toBe(
      'en_vivo',
    );
    expect(estadoDeConexion({ enLinea: true, socketConectado: false, reconectando: true })).toBe(
      'reconectando',
    );
  });
});

describe('manejarConexion', () => {
  it('al conectar queda en vivo', async () => {
    const { socket, conexion } = preparar();

    await socket.disparar('connect');

    expect(conexion).toEqual({ socketConectado: true, reconectando: false });
  });

  it('si se cae la red, queda reconectando y Socket.IO reintenta solo', async () => {
    const { socket, conexion } = preparar();
    await socket.disparar('connect');

    await socket.disparar('disconnect', 'transport close');

    expect(conexion).toEqual({ socketConectado: false, reconectando: true });
    expect(socket.connect).not.toHaveBeenCalled();
  });

  it('si el servidor la cierra porque venció el token, reconecta (sin renovar si ya hay uno nuevo)', async () => {
    const { socket, sesion } = preparar({ venceEnMs: 14 * 60_000 });

    await socket.disparar('disconnect', 'io server disconnect');

    expect(sesion.renovar).not.toHaveBeenCalled();
    expect(socket.connect).toHaveBeenCalledOnce();
  });

  it('si el token está por vencer, lo renueva antes de reconectar', async () => {
    const { socket, sesion } = preparar({ venceEnMs: 5_000 });

    await socket.disparar('disconnect', 'io server disconnect');

    expect(sesion.renovar).toHaveBeenCalledOnce();
    expect(socket.connect).toHaveBeenCalledOnce();
  });

  it('si el servidor rechaza el token, renueva y vuelve a conectar', async () => {
    const { socket, sesion } = preparar({ activo: false, venceEnMs: -1_000 });

    await socket.disparar('connect_error', new Error('TOKEN_EXPIRADO'));

    expect(sesion.renovar).toHaveBeenCalledOnce();
    expect(socket.connect).toHaveBeenCalledOnce();
  });

  it('un error de red con el socket activo solo marca reconectando', async () => {
    const { socket, sesion, conexion } = preparar({ activo: true });

    await socket.disparar('connect_error', new Error('xhr poll error'));

    expect(conexion.reconectando).toBe(true);
    expect(sesion.renovar).not.toHaveBeenCalled();
    expect(socket.connect).not.toHaveBeenCalled();
  });

  it('al salir de la sesión no intenta reconectar', async () => {
    const { socket, conexion } = preparar({ sesionActiva: false });

    await socket.disparar('disconnect', 'io client disconnect');
    await socket.disparar('disconnect', 'io server disconnect');

    expect(socket.connect).not.toHaveBeenCalled();
    expect(conexion.reconectando).toBe(false);
  });

  it('si la renovación falla, deja de marcar reconectando', async () => {
    const { socket, sesion, conexion } = preparar({ venceEnMs: 1_000 });
    sesion.renovar.mockRejectedValueOnce(new Error('REFRESH_INVALIDO'));

    await socket.disparar('disconnect', 'io server disconnect');

    expect(socket.connect).not.toHaveBeenCalled();
    expect(conexion.reconectando).toBe(false);
  });

  it('cada reintento automático marca reconectando', async () => {
    const { socket, conexion } = preparar();
    conexion.reconectando = false;

    await socket.dispararEnGestor('reconnect_attempt');

    expect(conexion.reconectando).toBe(true);
  });
});
