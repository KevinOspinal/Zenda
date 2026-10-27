// @ts-check
// Piezas compartidas por las pruebas que simulan el backend.

export const USUARIO = Object.freeze({
  id: 'u1',
  nombre: 'Laura Mesa',
  email: 'laura@laindustria.test',
  rol: 'mesero',
});

export const NEGOCIO = Object.freeze({ id: 'n1', nombre: 'La Industria', nit: '900111222' });

/**
 * Sesión como la entrega el API (login, refresh, registro).
 * @param {string} numero Para distinguir un token de otro: "1", "2"...
 * @param {object} [usuario]
 */
export const sesionDelApi = (numero, usuario = USUARIO) => ({
  tokenAcceso: `acceso-${numero}`,
  refreshToken: `n1.refresh-${numero}`,
  expiraEnSegundos: 900,
  usuario,
});

/**
 * Error como lo lanza $fetch cuando el API responde con un código de error.
 * @param {number} status
 * @param {string} code
 * @param {Record<string, string>} [encabezados]
 */
export function errorDelApi(status, code, encabezados = {}) {
  const cuerpo = { error: { code, message: `mensaje técnico de ${code}` } };
  return Object.assign(new Error(code), {
    data: cuerpo,
    response: { status, _data: cuerpo, headers: new Headers(encabezados) },
  });
}

/** Error como lo lanza $fetch cuando no hay conexión (sin respuesta). */
export const errorDeRed = () => Object.assign(new Error('fetch failed'), { response: undefined });

/**
 * Programa un $fetch simulado: cada ruta responde con una función.
 * @param {import('vitest').Mock} fetchFalso El mock que reemplaza a $fetch (mockNuxtImport).
 * @param {Record<string, (opciones: any) => any>} rutas Claves como "POST /auth/login".
 */
export function simularBackend(fetchFalso, rutas) {
  fetchFalso.mockImplementation(async (ruta, opciones = {}) => {
    const responder = rutas[`${opciones.method ?? 'GET'} ${ruta}`];
    if (!responder) throw new Error(`Ruta no simulada: ${ruta}`);
    return responder(opciones);
  });
  return fetchFalso;
}
