// @ts-check
// Lógica de la pantalla de usuarios que no depende de la pantalla:
// - El estado de cada cuenta (activa, bloqueada por intentos fallidos o inactiva) y los
//   contadores, que también filtran.
// - El orden por rol, la búsqueda por nombre o correo, y qué hace y a qué entra cada rol.
// - Qué se puede hacer con cada cuenta desde aquí (las reglas copian las del backend).
// Son funciones puras, sin Vue ni el API, para probarlas fácil (tests/unit/usuarios.test.js).
import { coincideBusqueda } from './busqueda.js';
import { ROLES, SECCIONES } from './roles.js';

/** @typedef {import('./roles.js').Rol} Rol */
/** @typedef {import('./estados.js').Apariencia} Apariencia */
/**
 * Cuenta tal como la envía el API (GET /usuarios). `bloqueado` lo calcula el backend al
 * responder; `bloqueadoHasta` dice hasta cuándo.
 * @typedef {object} Cuenta
 * @property {string} id
 * @property {string} nombre
 * @property {string} email
 * @property {Rol} rol
 * @property {boolean} activo
 * @property {boolean} bloqueado
 * @property {string | null} [bloqueadoHasta]
 * @property {string} [creadoEn]
 */
/** @typedef {'activo' | 'bloqueado' | 'inactivo'} EstadoCuenta */

/**
 * Apariencia de cada estado de una cuenta, en el orden de los contadores.
 * @type {Readonly<Record<EstadoCuenta, Apariencia & { plural: string }>>}
 */
export const ESTADOS_CUENTA = Object.freeze({
  activo: {
    etiqueta: 'Activo',
    plural: 'Activos',
    color: 'success',
    icono: 'i-lucide-circle-check',
  },
  bloqueado: {
    etiqueta: 'Bloqueado',
    plural: 'Bloqueados',
    color: 'warning',
    icono: 'i-lucide-lock',
  },
  inactivo: {
    etiqueta: 'Inactivo',
    plural: 'Inactivos',
    color: 'neutral',
    icono: 'i-lucide-user-x',
  },
});

/** Los roles que el administrador de Zenda asigna aquí, en el orden del formulario. */
export const ROLES_ASIGNABLES = /** @type {const} */ ([
  'dueno',
  'administrador',
  'cajero',
  'mesero',
  'cocina',
]);

/** Qué hace cada rol, en palabras del negocio. */
export const DESCRIPCION_DE_ROL = Object.freeze(
  /** @type {Record<Rol, string>} */ ({
    administrador_zenda: 'El equipo de Zenda: las cuentas, los domiciliarios y la facturación',
    dueno: 'Todo el negocio: menú, caja, reportes, configuración y auditoría',
    administrador: 'Menú, inventario, reportes y caja',
    cajero: 'Cobrar, abrir y cerrar la caja',
    mesero: 'Tomar pedidos y enviarlos a la cocina',
    cocina: 'La tableta de la cocina: ve las comandas y marca los platos listos',
    domiciliario: 'Ve sus domicilios y los marca como entregados',
  }),
);

/**
 * Tono de cada rol para su avatar y su grupo (decorativos, distintos de los colores con
 * significado). Las clases van completas para que Tailwind las encuentre.
 * @type {Readonly<Record<Rol, { fondo: string, texto: string }>>}
 */
export const TONOS_DE_ROL = Object.freeze({
  administrador_zenda: {
    fondo: 'bg-indigo-100 dark:bg-indigo-500/20',
    texto: 'text-indigo-700 dark:text-indigo-300',
  },
  dueno: {
    fondo: 'bg-violet-100 dark:bg-violet-500/20',
    texto: 'text-violet-700 dark:text-violet-300',
  },
  administrador: {
    fondo: 'bg-cyan-100 dark:bg-cyan-500/20',
    texto: 'text-cyan-700 dark:text-cyan-300',
  },
  cajero: {
    fondo: 'bg-teal-100 dark:bg-teal-500/20',
    texto: 'text-teal-700 dark:text-teal-300',
  },
  mesero: {
    fondo: 'bg-pink-100 dark:bg-pink-500/20',
    texto: 'text-pink-700 dark:text-pink-300',
  },
  cocina: {
    fondo: 'bg-orange-100 dark:bg-orange-500/20',
    texto: 'text-orange-700 dark:text-orange-300',
  },
  domiciliario: {
    fondo: 'bg-lime-100 dark:bg-lime-500/20',
    texto: 'text-lime-700 dark:text-lime-300',
  },
});

/** Orden de los roles en la lista y en los chips: el de ROLES. */
const ORDEN_DE_ROLES = /** @type {Rol[]} */ (Object.keys(ROLES));

/**
 * Hasta cuándo sigue bloqueada una cuenta por intentos fallidos, o null si no lo está.
 * El backend dice si estaba bloqueada al responder; el bloqueo se vence solo con el tiempo.
 * @param {Cuenta} cuenta
 * @param {Date} [ahora]
 * @returns {Date | null}
 */
export function finDelBloqueo(cuenta, ahora = new Date()) {
  if (!cuenta.bloqueado || !cuenta.bloqueadoHasta) return null;
  const fin = new Date(cuenta.bloqueadoHasta);
  return fin > ahora ? fin : null;
}

/**
 * @param {Cuenta} cuenta
 * @param {Date} [ahora]
 * @returns {EstadoCuenta}
 */
export function estadoDeCuenta(cuenta, ahora = new Date()) {
  if (!cuenta.activo) return 'inactivo';
  if (!cuenta.bloqueado) return 'activo';
  // Sin la hora del fin, se cree lo que dijo el backend.
  if (!cuenta.bloqueadoHasta) return 'bloqueado';
  return finDelBloqueo(cuenta, ahora) ? 'bloqueado' : 'activo';
}

/**
 * Cuántas cuentas hay en cada estado.
 * @param {Cuenta[]} cuentas
 * @param {Date} [ahora]
 * @returns {Record<EstadoCuenta, number>}
 */
export function conteoDeCuentas(cuentas, ahora = new Date()) {
  const conteo = { activo: 0, bloqueado: 0, inactivo: 0 };
  for (const cuenta of cuentas) conteo[estadoDeCuenta(cuenta, ahora)] += 1;
  return conteo;
}

/**
 * Cuántas cuentas hay de cada rol (solo los roles que tienen alguna), en el orden de ROLES.
 * @param {Cuenta[]} cuentas
 * @returns {{ rol: Rol, cantidad: number }[]}
 */
export function conteoPorRol(cuentas) {
  return ORDEN_DE_ROLES.map((rol) => ({
    rol,
    cantidad: cuentas.filter((cuenta) => cuenta.rol === rol).length,
  })).filter(({ cantidad }) => cantidad > 0);
}

/**
 * La búsqueda encuentra la cuenta por su nombre o su correo.
 * @param {Cuenta} cuenta
 * @param {string} busqueda
 */
export function coincideCuenta(cuenta, busqueda) {
  return coincideBusqueda(`${cuenta.nombre} ${cuenta.email}`, busqueda);
}

/**
 * Orden de la lista: por rol (de quien maneja más a quien maneja menos, como en ROLES); dentro
 * de cada rol, primero los que pueden ingresar y, entre ellos, por nombre.
 * @param {Cuenta} a
 * @param {Cuenta} b
 */
export function compararCuentas(a, b) {
  const porRol = ORDEN_DE_ROLES.indexOf(a.rol) - ORDEN_DE_ROLES.indexOf(b.rol);
  if (porRol !== 0) return porRol;
  if (a.activo !== b.activo) return a.activo ? -1 : 1;
  return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
}

/**
 * Las pantallas a las que entra un rol (sin Perfil, que lo tienen todos), con las que se abren
 * por otro camino, como la pantalla de la cocina.
 * @param {Rol} rol
 * @returns {{ id: string, etiqueta: string, icono: string }[]}
 */
export function pantallasDeRol(rol) {
  return SECCIONES.filter((seccion) => seccion.roles.includes(rol) && seccion.id !== 'perfil').map(
    ({ id, etiqueta, icono }) => ({ id, etiqueta, icono }),
  );
}

/**
 * Por qué no se puede quitar o dar el acceso de una cuenta desde aquí:
 * - propia: la cuenta de la sesión se maneja en Perfil.
 * - domiciliario: su acceso se maneja en Domiciliarios.
 * - zenda: la cuenta de un administrador de Zenda no se desactiva.
 * - unico_dueno: el único dueño activo no pierde el acceso (crea primero al nuevo).
 * @typedef {'propia' | 'domiciliario' | 'zenda' | 'unico_dueno'} MotivoSinAcceso
 */

/**
 * Qué puede hacer el administrador de Zenda con una cuenta desde esta pantalla.
 * El backend aplica las mismas reglas; aquí solo se ocultan o se explican los botones.
 * @param {Cuenta} cuenta
 * @param {object} contexto
 * @param {string | null | undefined} contexto.idPropia Id de la cuenta de la sesión.
 * @param {number} contexto.duenosActivos Cuántos dueños activos tiene el negocio.
 * @returns {{ editar: boolean, restablecer: boolean, cambiarAcceso: boolean, motivo: MotivoSinAcceso | null }}
 */
export function permisosSobreCuenta(cuenta, { idPropia, duenosActivos }) {
  if (cuenta.id === idPropia) {
    return { editar: false, restablecer: false, cambiarAcceso: false, motivo: 'propia' };
  }
  if (cuenta.rol === 'domiciliario') {
    return { editar: false, restablecer: true, cambiarAcceso: false, motivo: 'domiciliario' };
  }
  if (cuenta.rol === 'administrador_zenda') {
    return { editar: true, restablecer: true, cambiarAcceso: false, motivo: 'zenda' };
  }
  if (cuenta.rol === 'dueno' && cuenta.activo && duenosActivos <= 1) {
    return { editar: true, restablecer: true, cambiarAcceso: false, motivo: 'unico_dueno' };
  }
  return { editar: true, restablecer: true, cambiarAcceso: true, motivo: null };
}
