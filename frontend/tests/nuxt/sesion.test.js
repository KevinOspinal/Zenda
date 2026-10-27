// @ts-check
// Pruebas de la sesión y del cliente del API, con un backend simulado.
// Lo más delicado: varias peticiones con el token vencido deben hacer UNA sola renovación;
// usar dos veces el mismo refresh token haría que el backend cerrara todas las sesiones.
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApi } from '~/composables/useApi.js';
import { useSesionStore } from '~/stores/sesion.js';
import {
  NEGOCIO,
  USUARIO,
  errorDeRed,
  errorDelApi,
  sesionDelApi,
  simularBackend as simularBackendCon,
} from './ayudantes.js';

// En Nuxt, $fetch es una importación automática: se reemplaza por un backend simulado.
const { fetchFalso } = vi.hoisted(() => ({ fetchFalso: vi.fn() }));
mockNuxtImport('$fetch', () => fetchFalso);

/** @param {Record<string, (opciones: any) => any>} rutas */
const simularBackend = (rutas) => simularBackendCon(fetchFalso, rutas);

/**
 * Llamadas que recibió el backend simulado para una ruta.
 * @param {ReturnType<typeof vi.fn>} fetchFalso
 * @param {string} ruta
 */
const llamadasA = (fetchFalso, ruta) => fetchFalso.mock.calls.filter(([r]) => r === ruta);

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  fetchFalso.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ingresar', () => {
  it('guarda el token en memoria y recuerda el refresh token y el negocio', async () => {
    simularBackend({
      'POST /auth/login': () => sesionDelApi('1'),
      'GET /auth/yo': () => ({ usuario: USUARIO, negocio: NEGOCIO }),
    });
    const sesion = useSesionStore();

    await sesion.ingresar({ nit: '900111222', email: USUARIO.email, password: 'secreta' });

    expect(sesion.activa).toBe(true);
    expect(sesion.rol).toBe('mesero');
    expect(sesion.tokenAcceso).toBe('acceso-1');
    expect(sesion.negocio?.nombre).toBe('La Industria');
    // El token de acceso nunca se guarda en el navegador; el refresh token y el NIT sí.
    expect(JSON.stringify(localStorage)).not.toContain('acceso-1');
    expect(localStorage.getItem('zenda:refresh-token')).toBe('n1.refresh-1');
    expect(localStorage.getItem('zenda:nit')).toBe('900111222');
  });

  it('con credenciales incorrectas lanza un error con mensaje amable', async () => {
    simularBackend({
      'POST /auth/login': () => {
        throw errorDelApi(401, 'CREDENCIALES_INVALIDAS');
      },
    });
    const sesion = useSesionStore();

    await expect(
      sesion.ingresar({ nit: '900111222', email: 'x@x.test', password: 'mala' }),
    ).rejects.toMatchObject({
      codigo: 'CREDENCIALES_INVALIDAS',
      message: 'NIT, correo o contraseña incorrectos.',
    });
    expect(sesion.activa).toBe(false);
  });
});

describe('useApi', () => {
  /** Deja una sesión activa con el token "acceso-1". */
  async function conSesionActiva(rutas) {
    const fetchFalso = simularBackend({
      'POST /auth/login': () => sesionDelApi('1'),
      'GET /auth/yo': () => ({ usuario: USUARIO, negocio: NEGOCIO }),
      ...rutas,
    });
    await useSesionStore().ingresar({ nit: '900111222', email: USUARIO.email, password: 'x' });
    return fetchFalso;
  }

  it('envía el token de acceso en cada petición', async () => {
    const fetchFalso = await conSesionActiva({ 'GET /mesas': () => [] });

    await useApi().get('/mesas');

    const [, opciones] = llamadasA(fetchFalso, '/mesas')[0];
    expect(opciones.headers).toEqual({ Authorization: 'Bearer acceso-1' });
  });

  it('si el token venció, lo renueva y repite la petición con el nuevo', async () => {
    const fetchFalso = await conSesionActiva({
      'POST /auth/refresh': () => sesionDelApi('2'),
      'GET /mesas': (opciones) => {
        if (opciones.headers.Authorization === 'Bearer acceso-1') {
          throw errorDelApi(401, 'TOKEN_EXPIRADO');
        }
        return [{ id: 'm1' }];
      },
    });

    const mesas = await useApi().get('/mesas');

    expect(mesas).toEqual([{ id: 'm1' }]);
    expect(llamadasA(fetchFalso, '/auth/refresh')).toHaveLength(1);
    expect(useSesionStore().tokenAcceso).toBe('acceso-2');
  });

  it('varias peticiones con el token vencido hacen UNA sola renovación', async () => {
    const fetchFalso = await conSesionActiva({
      'POST /auth/refresh': async () => {
        await new Promise((resolver) => setTimeout(resolver, 20));
        return sesionDelApi('2');
      },
      'GET /mesas': (opciones) => {
        if (opciones.headers.Authorization === 'Bearer acceso-1') {
          throw errorDelApi(401, 'TOKEN_EXPIRADO');
        }
        return [];
      },
    });
    const api = useApi();

    await Promise.all([api.get('/mesas'), api.get('/mesas'), api.get('/mesas')]);

    expect(llamadasA(fetchFalso, '/auth/refresh')).toHaveLength(1);
  });

  it('si la sesión ya no sirve, la cierra y deja el motivo para el ingreso', async () => {
    await conSesionActiva({
      'POST /auth/refresh': () => {
        throw errorDelApi(401, 'REFRESH_INVALIDO');
      },
      'GET /mesas': () => {
        throw errorDelApi(401, 'TOKEN_EXPIRADO');
      },
    });
    const sesion = useSesionStore();

    await expect(useApi().get('/mesas')).rejects.toMatchObject({ codigo: 'REFRESH_INVALIDO' });

    expect(sesion.activa).toBe(false);
    expect(sesion.motivoCierre).toBe('Tu sesión terminó. Ingresa de nuevo.');
    expect(localStorage.getItem('zenda:refresh-token')).toBeNull();
  });

  it('sin conexión, el error dice que no hay conexión', async () => {
    await conSesionActiva({
      'GET /mesas': () => {
        throw errorDeRed();
      },
    });

    await expect(useApi().get('/mesas')).rejects.toMatchObject({
      codigo: 'SIN_CONEXION',
      status: 0,
    });
  });

  it('con demasiados intentos, el error dice cuántos segundos esperar', async () => {
    simularBackend({
      'POST /auth/login': () => {
        throw errorDelApi(429, 'DEMASIADAS_SOLICITUDES', { 'Retry-After': '45' });
      },
    });

    await expect(
      useSesionStore().ingresar({ nit: '900111222', email: 'x@x.test', password: 'x' }),
    ).rejects.toMatchObject({ reintentarEnSegundos: 45 });
  });
});

describe('recuperar la sesión al abrir la app', () => {
  it('con un refresh token guardado, recupera la sesión', async () => {
    localStorage.setItem('zenda:refresh-token', 'n1.refresh-1');
    simularBackend({
      'POST /auth/refresh': () => sesionDelApi('2'),
      'GET /auth/yo': () => ({ usuario: USUARIO, negocio: NEGOCIO }),
    });
    const sesion = useSesionStore();

    expect(await sesion.restaurar()).toBe(true);
    expect(sesion.activa).toBe(true);
    expect(sesion.negocio?.nit).toBe('900111222');
  });

  it('sin refresh token guardado, no hay sesión y no llama al API', async () => {
    const fetchFalso = simularBackend({});
    const sesion = useSesionStore();

    expect(await sesion.restaurar()).toBe(false);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('sin conexión, conserva el refresh token para reintentar', async () => {
    localStorage.setItem('zenda:refresh-token', 'n1.refresh-1');
    simularBackend({
      'POST /auth/refresh': () => {
        throw errorDeRed();
      },
    });
    const sesion = useSesionStore();

    expect(await sesion.restaurar()).toBe(false);
    expect(sesion.motivoCierre).toContain('No hay conexión');
    expect(localStorage.getItem('zenda:refresh-token')).toBe('n1.refresh-1');
  });
});

describe('mantener y cerrar la sesión', () => {
  it('renueva el token sola un minuto antes de que venza', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const fetchFalso = simularBackend({
      'POST /auth/login': () => sesionDelApi('1'),
      'GET /auth/yo': () => ({ usuario: USUARIO, negocio: NEGOCIO }),
      'POST /auth/refresh': () => sesionDelApi('2'),
    });
    const sesion = useSesionStore();
    await sesion.ingresar({ nit: '900111222', email: USUARIO.email, password: 'x' });

    // El token dura 900 s: a los 839 s todavía no renueva; a los 840 s, sí.
    await vi.advanceTimersByTimeAsync(839_000);
    expect(llamadasA(fetchFalso, '/auth/refresh')).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(llamadasA(fetchFalso, '/auth/refresh')).toHaveLength(1);
    expect(sesion.tokenAcceso).toBe('acceso-2');
  });

  it('salir avisa al backend y limpia el dispositivo, aunque el backend no responda', async () => {
    const fetchFalso = simularBackend({
      'POST /auth/login': () => sesionDelApi('1'),
      'GET /auth/yo': () => ({ usuario: USUARIO, negocio: NEGOCIO }),
      'POST /auth/logout': () => {
        throw errorDeRed();
      },
    });
    const sesion = useSesionStore();
    await sesion.ingresar({ nit: '900111222', email: USUARIO.email, password: 'x' });

    await sesion.salir();

    expect(llamadasA(fetchFalso, '/auth/logout')[0][1].body).toEqual({
      refreshToken: 'n1.refresh-1',
    });
    expect(sesion.activa).toBe(false);
    expect(localStorage.getItem('zenda:refresh-token')).toBeNull();
    // El NIT se recuerda para el próximo ingreso.
    expect(sesion.nitRecordado).toBe('900111222');
  });
});
