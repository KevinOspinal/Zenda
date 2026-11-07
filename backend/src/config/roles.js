// @ts-check
// Roles de los usuarios de un negocio, de mayor a menor alcance. Es la lista de la que salen
// los demás lugares que los nombran (el token de acceso, la documentación). Los permisos de
// cada ruta se dan con permitirRoles (middlewares/auth.js).
//
// - administrador_zenda: el equipo de Zenda, que vende y atiende el software. Puede todo lo
//   del dueño y además lo que el dueño no: los usuarios, los domiciliarios y la facturación.
//   Nadie lo asigna desde la app: lo crea el registro del negocio (en producción el registro
//   está cerrado y solo se abre para registrar un cliente) o scripts/crear-administrador-zenda.js.
// - dueno: el dueño del restaurante. Maneja la operación, el menú y su configuración.
// - administrador: el encargado del restaurante, por debajo del dueño.
// - cajero, mesero, cocina y domiciliario: ver la skill (seguridad-y-roles.md).

export const ROLES = /** @type {const} */ ([
  'administrador_zenda',
  'dueno',
  'administrador',
  'cajero',
  'mesero',
  'cocina',
  'domiciliario',
]);

/** @typedef {typeof ROLES[number]} Rol */
