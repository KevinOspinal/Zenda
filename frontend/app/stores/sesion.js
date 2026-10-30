// @ts-check
// Sesión del usuario: ingresar, mantener la sesión viva, recuperarla al abrir la app y salir.
//
// Dónde se guarda cada cosa:
// - Token de acceso (dura 15 min): solo en memoria, nunca en el almacenamiento del navegador.
// - Refresh token (30 días, cambia en cada uso): en localStorage, para que la sesión
//   sobreviva a recargar la página o cerrar la app.
// - NIT y nombre del negocio: en localStorage, para no pedirlos en cada ingreso.
//
// Regla clave: un refresh token se usa UNA sola vez. Si dos renovaciones lo usaran a la vez,
// el backend lo tomaría como robado y cerraría todas las sesiones del usuario. Por eso todas
// las renovaciones simultáneas comparten una misma promesa.

/** @typedef {import('~/utils/roles.js').Rol} Rol */
/** @typedef {{ id: string, nombre: string, email: string, rol: Rol }} Usuario */
/**
 * @typedef {{ id: string, nombre: string, nit: string, ciudad?: string | null,
 *   regimenImpuesto?: string }} Negocio
 */
/**
 * Respuesta del login, del refresh, del registro y del cambio de contraseña.
 * @typedef {{ tokenAcceso: string, refreshToken: string, expiraEnSegundos: number,
 *   usuario: Usuario, negocio?: Negocio }} RespuestaSesion
 */

/** Segundos antes del vencimiento del token en que se renueva solo. */
const RENOVAR_ANTES_SEGUNDOS = 60;

export const useSesionStore = defineStore('sesion', () => {
  const tokenAcceso = ref(/** @type {string | null} */ (null));
  /** Momento (milisegundos) en que vence el token de acceso. */
  const venceEn = ref(0);
  const usuario = ref(/** @type {Usuario | null} */ (null));
  const negocio = ref(/** @type {Negocio | null} */ (null));
  /** nueva: aún no se intentó recuperar · activa · cerrada. */
  const estado = ref(/** @type {'nueva' | 'activa' | 'cerrada'} */ ('nueva'));
  /** Por qué terminó la sesión sin que el usuario saliera, para avisarle en el ingreso. */
  const motivoCierre = ref('');

  const refreshToken = useLocalStorage('zenda:refresh-token', /** @type {string | null} */ (null));
  const nitRecordado = useLocalStorage('zenda:nit', '');
  const negocioRecordado = useLocalStorage('zenda:negocio', '');

  const activa = computed(
    () => estado.value === 'activa' && Boolean(tokenAcceso.value) && Boolean(usuario.value),
  );
  const rol = computed(() => usuario.value?.rol ?? null);

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let temporizadorRenovacion;
  /** @type {Promise<void> | null} */
  let renovacionEnCurso = null;

  // ───────────────────────────── Funciones internas ─────────────────────────────

  /**
   * Guarda una sesión que entregó el API y programa su renovación.
   * @param {RespuestaSesion} respuesta
   */
  function guardar(respuesta) {
    tokenAcceso.value = respuesta.tokenAcceso;
    refreshToken.value = respuesta.refreshToken;
    venceEn.value = Date.now() + respuesta.expiraEnSegundos * 1000;
    usuario.value = respuesta.usuario;
    programarRenovacion(respuesta.expiraEnSegundos);
  }

  /**
   * Renueva el token un minuto antes de que venza, para que el usuario nunca vea un corte.
   * @param {number} expiraEnSegundos
   */
  function programarRenovacion(expiraEnSegundos) {
    clearTimeout(temporizadorRenovacion);
    const espera = Math.max(expiraEnSegundos - RENOVAR_ANTES_SEGUNDOS, 5) * 1000;
    // Si falla, renovar() ya cerró la sesión o la próxima petición lo intentará de nuevo.
    temporizadorRenovacion = setTimeout(() => renovar().catch(() => {}), espera);
  }

  /**
   * Guarda el negocio y lo recuerda en el dispositivo para el próximo ingreso.
   * @param {Negocio} datos
   */
  function recordarNegocio(datos) {
    negocio.value = datos;
    nitRecordado.value = datos.nit;
    negocioRecordado.value = datos.nombre;
  }

  /** Trae el usuario y el negocio de la sesión. */
  async function cargarPerfil() {
    const perfil = await peticionAlApi('/auth/yo', { token: tokenAcceso.value });
    usuario.value = perfil.usuario;
    recordarNegocio(perfil.negocio);
  }

  /**
   * Borra la sesión del dispositivo. El NIT y el negocio recordados se conservan.
   * @param {string} [motivo] Mensaje para el ingreso si la sesión terminó sola.
   */
  function limpiar(motivo = '') {
    clearTimeout(temporizadorRenovacion);
    tokenAcceso.value = null;
    venceEn.value = 0;
    usuario.value = null;
    negocio.value = null;
    refreshToken.value = null;
    estado.value = 'cerrada';
    motivoCierre.value = motivo;
  }

  // ───────────────────────────── Acciones ─────────────────────────────

  /**
   * Ingresa con el NIT del negocio, el correo y la contraseña.
   * @param {{ nit: string, email: string, password: string }} credenciales
   * @throws {ErrorApi}
   */
  async function ingresar({ nit, email, password }) {
    const respuesta = await peticionAlApi('/auth/login', {
      metodo: 'POST',
      cuerpo: { nit, email, password },
    });
    guardar(respuesta);
    await cargarPerfil();
    estado.value = 'activa';
    motivoCierre.value = '';
  }

  /**
   * Activa la sesión que entrega el registro de un negocio nuevo (el dueño queda adentro).
   * @param {RespuestaSesion & { negocio: Negocio }} respuesta
   */
  function iniciarConRegistro(respuesta) {
    guardar(respuesta);
    recordarNegocio(respuesta.negocio);
    estado.value = 'activa';
    motivoCierre.value = '';
  }

  /**
   * Renueva el token de acceso con el refresh token.
   * Si ya hay una renovación en curso, devuelve esa misma: nunca se usa dos veces el
   * mismo refresh token.
   * @returns {Promise<void>}
   * @throws {ErrorApi}
   */
  function renovar() {
    if (renovacionEnCurso) return renovacionEnCurso;

    renovacionEnCurso = (async () => {
      try {
        if (!refreshToken.value) {
          throw new ErrorApi({
            status: 401,
            codigo: 'REFRESH_INVALIDO',
            mensaje: MENSAJES_DE_ERROR.REFRESH_INVALIDO,
          });
        }
        guardar(
          await peticionAlApi('/auth/refresh', {
            metodo: 'POST',
            cuerpo: { refreshToken: refreshToken.value },
          }),
        );
      } catch (error) {
        // El backend rechazó el refresh token (4xx, menos "demasiados intentos"): la sesión
        // terminó. Sin conexión o con un error del servidor, la sesión se conserva.
        if (error instanceof ErrorApi && error.status >= 400 && error.status < 500) {
          if (error.status !== 429) limpiar(MENSAJES_DE_ERROR.REFRESH_INVALIDO);
        }
        throw error;
      } finally {
        renovacionEnCurso = null;
      }
    })();
    return renovacionEnCurso;
  }

  /**
   * Recupera la sesión guardada al abrir la app. Se ejecuta una sola vez, salvo que se pida
   * `reintentar` (por ejemplo, después de un error de conexión).
   * @param {{ reintentar?: boolean }} [opciones]
   * @returns {Promise<boolean>} true si quedó una sesión activa.
   */
  async function restaurar({ reintentar = false } = {}) {
    if (estado.value !== 'nueva' && !reintentar) return activa.value;
    if (!refreshToken.value) {
      estado.value = 'cerrada';
      return false;
    }
    try {
      await renovar();
      await cargarPerfil();
      estado.value = 'activa';
      motivoCierre.value = '';
      return true;
    } catch (error) {
      // Sin conexión no se puede comprobar la sesión, pero se conserva para reintentar.
      estado.value = 'cerrada';
      if (error instanceof ErrorApi && error.codigo === 'SIN_CONEXION') {
        motivoCierre.value = MENSAJE_SIN_CONEXION;
      }
      return false;
    }
  }

  /**
   * Cambia la contraseña. El backend entrega una sesión nueva y cierra las demás.
   * @param {{ contrasenaActual: string, contrasenaNueva: string }} datos
   * @throws {ErrorApi}
   */
  async function cambiarContrasena(datos) {
    guardar(await useApi().post('/auth/cambiar-contrasena', datos));
  }

  /**
   * Cierra la sesión. La pantalla responde de inmediato; el aviso al backend va después
   * y, si falla (por ejemplo, sin conexión), la sesión igual queda cerrada en el dispositivo.
   */
  async function salir() {
    const token = refreshToken.value;
    limpiar();
    if (token) {
      await peticionAlApi('/auth/logout', {
        metodo: 'POST',
        cuerpo: { refreshToken: token },
      }).catch(() => {});
    }
  }

  return {
    tokenAcceso,
    venceEn,
    usuario,
    negocio,
    estado,
    motivoCierre,
    nitRecordado,
    negocioRecordado,
    activa,
    rol,
    ingresar,
    iniciarConRegistro,
    renovar,
    restaurar,
    cambiarContrasena,
    salir,
  };
});
