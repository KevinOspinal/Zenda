// @ts-check
// Errores del API traducidos a mensajes amables para el usuario.
//
// El backend responde siempre { "error": { "code": "CODIGO", "message": "..." } }.
// En pantalla nunca se muestra el código ni un mensaje técnico: se usa el mensaje de esta
// tabla. Si un código no está aquí y es un error 4xx, se usa el mensaje del backend (son
// frases en español pensadas para personas). Un error 5xx nunca se muestra tal cual.

/** Mensaje para errores inesperados del servidor. */
export const MENSAJE_ERROR_GENERICO = 'Algo salió mal de nuestro lado. Intenta de nuevo.';

/** Mensaje cuando el dispositivo no logra comunicarse con el API. */
export const MENSAJE_SIN_CONEXION =
  'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.';

const SESION_TERMINADA = 'Tu sesión terminó. Ingresa de nuevo.';
const REVISA_LOS_DATOS = 'Revisa los datos e intenta de nuevo.';

/**
 * Mensaje amable de cada código de error del backend.
 * DIVISION_INVALIDA e IMPUESTO_NO_PERMITIDO no están: su mensaje del backend ya explica
 * el caso concreto (cuántas unidades tiene el ítem, qué impuesto permite el régimen).
 */
export const MENSAJES_DE_ERROR = Object.freeze({
  // Datos enviados
  VALIDATION_ERROR: REVISA_LOS_DATOS,
  INVALID_JSON: REVISA_LOS_DATOS,

  // Sesión
  CREDENCIALES_INVALIDAS: 'NIT, correo o contraseña incorrectos.',
  CUENTA_BLOQUEADA: 'Por seguridad, la cuenta se bloqueó 15 minutos. Intenta más tarde.',
  CONTRASENA_INCORRECTA: 'La contraseña actual no es correcta.',
  CONTRASENA_REPETIDA: 'La nueva contraseña debe ser distinta de la actual.',
  NO_AUTENTICADO: SESION_TERMINADA,
  TOKEN_INVALIDO: SESION_TERMINADA,
  TOKEN_EXPIRADO: SESION_TERMINADA,
  REFRESH_INVALIDO: SESION_TERMINADA,

  // Permisos
  SIN_PERMISO: 'Tu rol no permite esta acción.',
  REGISTRO_DESHABILITADO: 'El registro de negocios no está disponible.',
  DUENO_PROTEGIDO: 'El dueño no se puede modificar desde aquí.',

  // Registros que ya no existen (otro dispositivo pudo cambiarlos)
  NO_ENCONTRADO: 'Ya no existe; puede que alguien lo haya cambiado.',
  CATEGORIA_NO_ENCONTRADA: 'La categoría ya no existe.',
  CLIENTE_NO_ENCONTRADO: 'El cliente ya no existe.',
  ITEM_NO_ENCONTRADO: 'Ese producto ya no está en el pedido.',
  MESA_NO_ENCONTRADA: 'La mesa ya no existe.',
  PRODUCTO_NO_ENCONTRADO: 'El producto ya no existe.',
  // Ruta inexistente en el API: es un error de la app, no del usuario.
  NOT_FOUND: MENSAJE_ERROR_GENERICO,

  // Caja
  SIN_TURNO_ABIERTO: 'No hay caja abierta.',
  CAJA_CERRADA: 'La caja está cerrada: hay que abrirla para tomar pedidos.',
  TURNO_YA_ABIERTO: 'La caja ya está abierta.',
  TURNO_CERRADO: 'Ese turno de caja ya se cerró; el pedido no se puede anular.',
  PEDIDOS_ABIERTOS: 'Hay pedidos sin cobrar. Cóbralos o anúlalos antes de cerrar la caja.',

  // Pedidos y cobro
  MESA_OCUPADA: 'Esta mesa ya tiene un pedido abierto.',
  PEDIDO_CERRADO: 'Este pedido ya se cobró o se anuló.',
  PEDIDO_ANULADO: 'Este pedido ya se cobró o se anuló.',
  PEDIDO_VACIO: 'Agrega al menos un producto.',
  PAGO_NO_CUADRA: 'Los pagos no suman el total por cobrar. Revisa los valores.',
  PROPINA_EXCEDE_TOTAL: 'La propina parece muy alta. Revisa el valor.',
  ITEM_EN_PREPARACION: 'La cocina ya lo está preparando; no se puede quitar.',
  CAMBIO_COCINA_INVALIDO: 'Otro dispositivo ya cambió este plato.',
  PRODUCTO_INACTIVO: 'Este producto ya no está disponible.',

  // Menú, inventario y registros
  PRODUCTO_SIN_INVENTARIO: 'Este producto no controla inventario.',
  YA_EXISTE: 'Ya existe uno con esos datos.',
  NIT_YA_REGISTRADO: 'Ya hay un negocio registrado con ese NIT.',
  EN_USO: 'No se puede eliminar porque está en uso. Puedes desactivarlo.',

  // Servidor y conexión
  INTERNAL_ERROR: MENSAJE_ERROR_GENERICO,
  SIN_CONEXION: MENSAJE_SIN_CONEXION,
});

/** Códigos que significan que la sesión ya no sirve y hay que volver a ingresar. */
const CODIGOS_SIN_SESION = new Set(['NO_AUTENTICADO', 'TOKEN_INVALIDO', 'REFRESH_INVALIDO']);

/**
 * Error de una llamada al API, con el mensaje ya listo para mostrar.
 */
export class ErrorApi extends Error {
  /**
   * @param {object} datos
   * @param {number} datos.status Estado HTTP (0 si no hubo respuesta).
   * @param {string} datos.codigo Código del backend, o SIN_CONEXION.
   * @param {string} datos.mensaje Mensaje amable para el usuario.
   * @param {string} [datos.mensajeTecnico] Mensaje original del backend, para depurar.
   * @param {number} [datos.reintentarEnSegundos] En un 429, cuánto esperar.
   */
  constructor({ status, codigo, mensaje, mensajeTecnico, reintentarEnSegundos }) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.status = status;
    this.codigo = codigo;
    this.mensajeTecnico = mensajeTecnico;
    this.reintentarEnSegundos = reintentarEnSegundos;
  }
}

/**
 * Mensaje amable para un error del API.
 * @param {object} datos
 * @param {number} datos.status
 * @param {string} [datos.codigo]
 * @param {string} [datos.mensajeDelApi] El `message` que envió el backend.
 * @param {number} [datos.reintentarEnSegundos]
 * @returns {string}
 */
export function mensajeDeError({ status, codigo, mensajeDelApi, reintentarEnSegundos }) {
  // 1. Demasiados intentos: decir cuánto esperar, si se sabe.
  if (codigo === 'DEMASIADAS_SOLICITUDES' || status === 429) {
    return reintentarEnSegundos
      ? `Demasiados intentos. Espera ${reintentarEnSegundos} segundos e intenta de nuevo.`
      : 'Demasiados intentos. Espera un momento e intenta de nuevo.';
  }

  // 2. Códigos conocidos: el mensaje de la tabla.
  if (codigo && Object.hasOwn(MENSAJES_DE_ERROR, codigo)) {
    return MENSAJES_DE_ERROR[/** @type {keyof typeof MENSAJES_DE_ERROR} */ (codigo)];
  }

  // 3. Otros errores del cliente (4xx): el mensaje del backend, que está en español.
  if (status >= 400 && status < 500 && mensajeDelApi) return mensajeDelApi;

  // 4. Todo lo demás: un mensaje genérico, sin detalles internos.
  return MENSAJE_ERROR_GENERICO;
}

/**
 * Crea el ErrorApi de una respuesta con error.
 * @param {object} datos
 * @param {number} datos.status Estado HTTP.
 * @param {unknown} [datos.cuerpo] Cuerpo de la respuesta (ya leído como JSON, si lo era).
 * @param {number} [datos.reintentarEnSegundos] Valor del encabezado Retry-After.
 * @returns {ErrorApi}
 */
export function crearErrorApi({ status, cuerpo, reintentarEnSegundos }) {
  const error = /** @type {{ error?: { code?: unknown, message?: unknown } } | undefined} */ (
    cuerpo
  )?.error;
  const codigo = typeof error?.code === 'string' ? error.code : `HTTP_${status}`;
  const mensajeDelApi = typeof error?.message === 'string' ? error.message : undefined;

  return new ErrorApi({
    status,
    codigo,
    mensaje: mensajeDeError({ status, codigo, mensajeDelApi, reintentarEnSegundos }),
    mensajeTecnico: mensajeDelApi,
    reintentarEnSegundos,
  });
}

/**
 * Error para cuando no hubo respuesta del API (sin internet o servidor apagado).
 * @returns {ErrorApi}
 */
export function crearErrorSinConexion() {
  return new ErrorApi({ status: 0, codigo: 'SIN_CONEXION', mensaje: MENSAJE_SIN_CONEXION });
}

/**
 * Indica si el error obliga a volver a iniciar sesión.
 * @param {unknown} error
 */
export function requiereIniciarSesion(error) {
  return error instanceof ErrorApi && CODIGOS_SIN_SESION.has(error.codigo);
}
