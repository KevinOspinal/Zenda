// @ts-check
// Roles: qué secciones ve cada uno, dónde empieza y qué acciones puede hacer.
//
// Es el único lugar que decide qué se muestra según el rol. Los permisos copian los del
// backend (ver la skill, contrato-api.md). Ocultar un botón mejora la experiencia, pero la
// seguridad la pone el backend: toda pantalla debe manejar el error 403 igual.

/** @typedef {'dueno' | 'administrador' | 'cajero' | 'mesero'} Rol */

/** @type {Readonly<Record<Rol, { etiqueta: string, icono: string }>>} */
export const ROLES = Object.freeze({
  dueno: { etiqueta: 'Dueño', icono: 'i-lucide-crown' },
  administrador: { etiqueta: 'Administrador', icono: 'i-lucide-briefcase' },
  cajero: { etiqueta: 'Cajero', icono: 'i-lucide-calculator' },
  mesero: { etiqueta: 'Mesero', icono: 'i-lucide-hand-platter' },
});

const TODOS = /** @type {Rol[]} */ (['dueno', 'administrador', 'cajero', 'mesero']);
const GERENCIA = /** @type {Rol[]} */ (['dueno', 'administrador']);
const CAJA = /** @type {Rol[]} */ (['dueno', 'administrador', 'cajero']);
const SOLO_DUENO = /** @type {Rol[]} */ (['dueno']);

/**
 * Acciones y los roles que el backend permite para cada una.
 * @type {Readonly<Record<string, Rol[]>>}
 */
export const PERMISOS = Object.freeze({
  tomarPedidos: TODOS,
  cobrar: CAJA,
  anularPedidos: GERENCIA,
  manejarCaja: CAJA, // abrir, ver y cerrar el turno
  verHistorialDeCaja: GERENCIA,
  gestionarClientes: CAJA,
  gestionarMenu: GERENCIA,
  gestionarMesas: GERENCIA,
  verInventario: CAJA,
  registrarInventario: GERENCIA, // compras y ajustes
  verUsuarios: GERENCIA,
  gestionarUsuarios: SOLO_DUENO,
  configurarNegocio: SOLO_DUENO, // propina sugerida
  verAuditoria: SOLO_DUENO,
  verReportes: GERENCIA,
});

/** @typedef {keyof typeof PERMISOS} Accion */

/**
 * @typedef {object} Seccion
 * @property {string} id
 * @property {string} etiqueta Texto en la navegación.
 * @property {string} icono
 * @property {string} ruta
 * @property {Rol[]} roles Quién la ve.
 */

/**
 * Secciones de la app en el orden en que aparecen en la navegación.
 * @type {ReadonlyArray<Seccion>}
 */
export const SECCIONES = Object.freeze([
  {
    id: 'reportes',
    etiqueta: 'Reportes',
    icono: 'i-lucide-chart-column',
    ruta: '/reportes',
    roles: GERENCIA,
  },
  {
    id: 'caja',
    etiqueta: 'Caja',
    icono: 'i-lucide-calculator',
    ruta: '/caja',
    roles: CAJA,
  },
  {
    id: 'mesas',
    etiqueta: 'Mesas',
    icono: 'i-lucide-layout-grid',
    ruta: '/mesas',
    roles: TODOS,
  },
  {
    id: 'pedidos',
    etiqueta: 'Pedidos',
    icono: 'i-lucide-notebook-pen',
    ruta: '/pedidos',
    roles: ['mesero'],
  },
  {
    id: 'avisos',
    etiqueta: 'Avisos',
    icono: 'i-lucide-bell',
    ruta: '/avisos',
    roles: ['mesero'],
  },
  {
    id: 'mostrador',
    etiqueta: 'Mostrador',
    icono: 'i-lucide-shopping-bag',
    // Ruta propia (no /caja/mostrador) para que la navegación no marque Caja también.
    ruta: '/mostrador',
    roles: ['cajero'],
  },
  {
    id: 'clientes',
    etiqueta: 'Clientes',
    icono: 'i-lucide-contact',
    ruta: '/clientes',
    roles: ['cajero'],
  },
  {
    id: 'menu',
    etiqueta: 'Menú',
    icono: 'i-lucide-book-open-text',
    ruta: '/admin/menu',
    roles: GERENCIA,
  },
  {
    id: 'inventario',
    etiqueta: 'Inventario',
    icono: 'i-lucide-package',
    ruta: '/admin/inventario',
    roles: GERENCIA,
  },
  {
    id: 'usuarios',
    etiqueta: 'Usuarios',
    icono: 'i-lucide-users',
    ruta: '/admin/usuarios',
    roles: GERENCIA,
  },
  {
    id: 'turnos',
    etiqueta: 'Turnos',
    icono: 'i-lucide-history',
    ruta: '/admin/turnos',
    roles: GERENCIA,
  },
  {
    id: 'configuracion',
    etiqueta: 'Configuración',
    icono: 'i-lucide-settings',
    ruta: '/admin/configuracion',
    roles: SOLO_DUENO,
  },
  {
    id: 'auditoria',
    etiqueta: 'Auditoría',
    icono: 'i-lucide-shield-check',
    ruta: '/admin/auditoria',
    roles: SOLO_DUENO,
  },
  {
    id: 'perfil',
    etiqueta: 'Perfil',
    icono: 'i-lucide-circle-user',
    ruta: '/perfil',
    roles: TODOS,
  },
]);

/** Pantalla con la que empieza cada rol al ingresar. */
export const INICIO_POR_ROL = Object.freeze({
  dueno: '/reportes',
  administrador: '/reportes',
  cajero: '/caja',
  mesero: '/mesas',
});

/**
 * Indica si un rol puede hacer una acción.
 * @param {Rol | null | undefined} rol
 * @param {Accion} accion
 */
export function puede(rol, accion) {
  return Boolean(rol) && PERMISOS[accion].includes(/** @type {Rol} */ (rol));
}

/**
 * Secciones que ve un rol, en orden.
 * @param {Rol} rol
 * @returns {Seccion[]}
 */
export function seccionesDe(rol) {
  return SECCIONES.filter((seccion) => seccion.roles.includes(rol));
}

/**
 * Ruta de inicio de un rol.
 * @param {Rol} rol
 */
export function inicioDe(rol) {
  return INICIO_POR_ROL[rol];
}

/**
 * Decide si el usuario puede entrar a una página o a dónde hay que llevarlo.
 * La usa el middleware de sesión en cada navegación.
 * @param {object} datos
 * @param {string} datos.ruta Ruta a la que quiere ir, por ejemplo "/caja".
 * @param {boolean} [datos.publica] La página se ve sin sesión (ingreso y registro).
 * @param {string} [datos.seccion] Sección a la que pertenece la página (id de SECCIONES).
 * @param {Rol | null} datos.rol Rol de la sesión activa, o null si no hay sesión.
 * @returns {string | null} Ruta a la que hay que redirigir, o null si puede entrar.
 */
export function redireccionNecesaria({ ruta, publica = false, seccion, rol }) {
  // 1. Sin sesión: solo las páginas públicas.
  if (!rol) return publica ? null : '/ingresar';

  // 2. Con sesión, el ingreso, el registro y la raíz llevan al inicio del rol.
  if (publica || ruta === '/') return inicioDe(rol);

  // 3. Una página de una sección solo la ven los roles de esa sección.
  const datosSeccion = SECCIONES.find((s) => s.id === seccion);
  if (datosSeccion && !datosSeccion.roles.includes(rol)) return inicioDe(rol);

  return null;
}
