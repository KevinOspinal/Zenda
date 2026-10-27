// @ts-check
// Conexión con el API (backend). Es el único punto por donde pasan las peticiones:
// - agrega el token de acceso de la sesión;
// - si el token venció, lo renueva (una sola vez aunque fallen varias peticiones a la vez)
//   y repite la petición;
// - convierte cualquier error en un ErrorApi con un mensaje amable (ver utils/errores.js).
// Las pantallas no llaman al API directo: usan los stores, y los stores usan useApi.

/** Tiempo máximo de espera de una petición: sin límite, una red caída dejaría la pantalla esperando. */
const ESPERA_MAXIMA_MS = 15_000;

/**
 * @typedef {object} OpcionesPeticion
 * @property {'GET' | 'POST' | 'PATCH' | 'DELETE'} [metodo]
 * @property {unknown} [cuerpo] Datos que se envían como JSON.
 * @property {Record<string, unknown>} [consulta] Parámetros de la URL (?desde=...).
 * @property {string | null} [token] Token de acceso. Sin él, la petición va sin sesión.
 */

/**
 * Petición al API sin manejar la sesión. Es la base de useApi y del store de sesión
 * (ingresar, renovar y salir no llevan token de acceso).
 * @param {string} ruta Ruta del API, por ejemplo "/auth/login".
 * @param {OpcionesPeticion} [opciones]
 * @returns {Promise<any>}
 * @throws {ErrorApi}
 */
export async function peticionAlApi(ruta, { metodo = 'GET', cuerpo, consulta, token } = {}) {
  const { apiUrl } = useRuntimeConfig().public;
  try {
    return await $fetch(ruta, {
      baseURL: apiUrl,
      method: metodo,
      body: /** @type {any} */ (cuerpo),
      query: consulta,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      timeout: ESPERA_MAXIMA_MS,
      // Los reintentos los decide la app (por ejemplo, después de renovar el token).
      retry: 0,
    });
  } catch (error) {
    throw convertirError(error);
  }
}

/**
 * Convierte el error de $fetch en un ErrorApi.
 * @param {any} error
 * @returns {ErrorApi}
 */
function convertirError(error) {
  if (error instanceof ErrorApi) return error;

  // Sin respuesta: no hubo conexión (sin internet, servidor apagado o se agotó el tiempo).
  const respuesta = error?.response;
  if (!respuesta) return crearErrorSinConexion();

  // En un 429, el encabezado Retry-After dice cuántos segundos esperar.
  const segundos = Number(respuesta.headers?.get?.('retry-after'));
  return crearErrorApi({
    status: respuesta.status,
    cuerpo: error.data ?? respuesta._data,
    reintentarEnSegundos: Number.isFinite(segundos) && segundos > 0 ? segundos : undefined,
  });
}

/**
 * Cliente del API con la sesión activa.
 * @example
 * const api = useApi();
 * const mesas = await api.get('/mesas');
 * await api.post('/pedidos', { mesaId, items });
 */
export function useApi() {
  const sesion = useSesionStore();

  /**
   * @param {string} ruta
   * @param {OpcionesPeticion} [opciones]
   * @returns {Promise<any>}
   */
  async function pedir(ruta, opciones = {}) {
    const tokenUsado = sesion.tokenAcceso;
    try {
      return await peticionAlApi(ruta, { ...opciones, token: tokenUsado });
    } catch (error) {
      if (!(error instanceof ErrorApi) || error.codigo !== 'TOKEN_EXPIRADO') throw error;

      // El token venció. Si otra petición ya lo renovó mientras tanto, basta con repetir;
      // si no, se renueva (todas las renovaciones simultáneas comparten una sola).
      if (sesion.tokenAcceso === tokenUsado) await sesion.renovar();
      return peticionAlApi(ruta, { ...opciones, token: sesion.tokenAcceso });
    }
  }

  return {
    /**
     * @param {string} ruta
     * @param {Record<string, unknown>} [consulta]
     */
    get: (ruta, consulta) => pedir(ruta, { consulta }),
    /**
     * @param {string} ruta
     * @param {unknown} [cuerpo]
     */
    post: (ruta, cuerpo) => pedir(ruta, { metodo: 'POST', cuerpo }),
    /**
     * @param {string} ruta
     * @param {unknown} cuerpo
     */
    patch: (ruta, cuerpo) => pedir(ruta, { metodo: 'PATCH', cuerpo }),
    /** @param {string} ruta */
    eliminar: (ruta) => pedir(ruta, { metodo: 'DELETE' }),
  };
}
