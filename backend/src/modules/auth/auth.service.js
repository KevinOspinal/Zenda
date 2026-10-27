// @ts-check
// Lógica de autenticación: iniciar sesión, renovar el token de acceso y cerrar sesión.
import { env } from '../../config/env.js';
import { HASH_FICTICIO, hashearContrasena, verificarContrasena } from '../../lib/contrasenas.js';
import { prisma } from '../../lib/db.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { conNegocio } from '../../lib/negocio.js';
import {
  firmarTokenAcceso,
  generarRefreshToken,
  hashearRefreshToken,
  negocioDelRefreshToken,
} from '../../lib/tokens.js';

/** @typedef {import('../../lib/negocio.js').TransaccionPrisma} TransaccionPrisma */
/** @typedef {import('../../lib/tokens.js').Rol} Rol */

/** Intentos fallidos seguidos antes de bloquear la cuenta. */
export const MAXIMO_INTENTOS_FALLIDOS = 5;

/** Minutos que dura el bloqueo temporal. */
export const MINUTOS_DE_BLOQUEO = 15;

/**
 * @typedef {object} SesionIniciada
 * @property {string} tokenAcceso JWT de vida corta para enviar en cada petición.
 * @property {string} refreshToken Token de vida larga para pedir un nuevo token de acceso.
 * @property {number} expiraEnSegundos Vida del token de acceso.
 * @property {{ id: string, nombre: string, email: string, rol: Rol }} usuario
 */

/**
 * Inicia sesión con el NIT del negocio, el correo y la contraseña.
 *
 * Todos los errores de credenciales devuelven el mismo mensaje, sin decir si falló el NIT,
 * el correo o la contraseña, para no dar pistas a quien intente adivinar.
 *
 * @param {{ nit: string, email: string, password: string }} credenciales
 * @returns {Promise<SesionIniciada>}
 * @throws {AppError} 401 si las credenciales no son válidas; 423 si la cuenta está bloqueada.
 */
export async function iniciarSesion({ nit, email, password }) {
  // 1. Buscar el negocio. La tabla tenants no tiene RLS: aún no sabemos cuál es el negocio activo.
  const negocio = await prisma.tenant.findUnique({ where: { nit } });
  if (!negocio) {
    // Se verifica igual contra un hash ficticio para que la respuesta tarde lo mismo.
    await verificarContrasena(HASH_FICTICIO, password);
    throw errorCredenciales();
  }

  // 2. El resto ocurre dentro del negocio. La transacción devuelve el error en lugar de
  //    lanzarlo: así se guarda el intento fallido (lanzar dentro desharía ese cambio).
  const resultado = await conNegocio(negocio.id, async (tx) => {
    const usuario = await tx.usuario.findUnique({
      where: { tenantId_email: { tenantId: negocio.id, email } },
    });

    if (!usuario || !usuario.activo) {
      await verificarContrasena(HASH_FICTICIO, password);
      return { error: errorCredenciales() };
    }

    // 3. Una cuenta bloqueada no puede entrar, ni siquiera con la contraseña correcta.
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      return { error: errorCuentaBloqueada() };
    }

    // 4. Contraseña incorrecta: sumar el intento y bloquear si llegó al máximo.
    if (!(await verificarContrasena(usuario.passwordHash, password))) {
      await registrarIntentoFallido(tx, usuario.id);
      return { error: errorCredenciales() };
    }

    // 5. Contraseña correcta: reiniciar el contador y crear la sesión.
    await tx.usuario.update({
      where: { id: usuario.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null },
    });
    return { sesion: await crearSesion(tx, usuario) };
  });

  if (resultado.error) throw resultado.error;
  return resultado.sesion;
}

/**
 * Entrega un token de acceso nuevo a cambio de un refresh token válido.
 *
 * Cada refresh token se usa una sola vez: al renovarse se revoca y se entrega otro
 * (rotación). Si alguien presenta un token ya revocado, probablemente fue robado:
 * se cierran todas las sesiones del usuario por seguridad.
 *
 * @param {string} refreshToken
 * @returns {Promise<SesionIniciada>}
 * @throws {AppError} 401 si el token no es válido, venció o fue revocado.
 */
export async function renovarSesion(refreshToken) {
  // 1. El negocio va dentro del token; sin él no se puede buscar la sesión (RLS).
  const tenantId = negocioDelRefreshToken(refreshToken);
  if (!tenantId) throw errorRefreshInvalido();

  const resultado = await conNegocio(tenantId, async (tx) => {
    const ahora = new Date();
    const sesion = await tx.sesionUsuario.findUnique({
      where: { tenantId_tokenHash: { tenantId, tokenHash: hashearRefreshToken(refreshToken) } },
      include: { usuario: true },
    });

    if (!sesion) return { error: errorRefreshInvalido() };

    // 2. Token ya usado para renovar (rotado) que vuelve a llegar: probablemente lo robaron.
    //    Se cierran todas las sesiones abiertas del usuario.
    if (sesion.revocadaEn && sesion.rotada) {
      await tx.sesionUsuario.updateMany({
        where: { usuarioId: sesion.usuarioId, revocadaEn: null },
        data: { revocadaEn: ahora },
      });
      logger.warn(
        { tenantId, usuarioId: sesion.usuarioId },
        'Refresh token reutilizado: se cerraron todas las sesiones del usuario',
      );
      return { error: errorRefreshInvalido() };
    }

    // 3. Token cerrado (logout, cambio de contraseña...), vencido o usuario desactivado.
    if (sesion.revocadaEn || sesion.expiraEn <= ahora || !sesion.usuario.activo) {
      return { error: errorRefreshInvalido() };
    }

    // 4. Revocar el token usado. La condición `revocadaEn: null` evita que dos peticiones
    //    simultáneas con el mismo token obtengan cada una una sesión nueva.
    const revocadas = await tx.sesionUsuario.updateMany({
      where: { id: sesion.id, revocadaEn: null },
      data: { revocadaEn: ahora, rotada: true },
    });
    if (revocadas.count !== 1) return { error: errorRefreshInvalido() };

    // 5. Entregar una sesión nueva.
    return { sesion: await crearSesion(tx, sesion.usuario) };
  });

  if (resultado.error) throw resultado.error;
  return resultado.sesion;
}

/**
 * Cierra la sesión revocando el refresh token. Si el token no existe no hace nada:
 * cerrar sesión dos veces no es un error.
 * @param {string} refreshToken
 * @returns {Promise<void>}
 */
export async function cerrarSesion(refreshToken) {
  const tenantId = negocioDelRefreshToken(refreshToken);
  if (!tenantId) return;

  await conNegocio(tenantId, (tx) =>
    tx.sesionUsuario.updateMany({
      where: { tenantId, tokenHash: hashearRefreshToken(refreshToken), revocadaEn: null },
      data: { revocadaEn: new Date() },
    }),
  );
}

/**
 * Devuelve los datos del usuario autenticado y de su negocio.
 * @param {import('../../lib/tokens.js').DatosSesion} datosSesion
 */
export async function obtenerPerfil({ usuarioId, tenantId }) {
  const perfil = await conNegocio(tenantId, async (tx) => {
    const usuario = await tx.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, nombre: true, email: true, rol: true, activo: true },
    });
    const negocio = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, nombre: true, nit: true, regimenImpuesto: true },
    });
    return { usuario, negocio };
  });

  // Si el usuario fue desactivado, su token deja de servir para ver el perfil.
  if (!perfil.usuario || !perfil.usuario.activo || !perfil.negocio) {
    throw new AppError(401, 'NO_AUTENTICADO', 'Debe iniciar sesión');
  }

  // Se devuelven solo los datos públicos del usuario.
  const { id, nombre, email, rol } = perfil.usuario;
  return { usuario: { id, nombre, email, rol }, negocio: perfil.negocio };
}

/**
 * El usuario cambia su propia contraseña dando la actual.
 *
 * Por seguridad se cierran todas sus sesiones (por ejemplo, la de un celular perdido)
 * y se entrega una sesión nueva para que siga trabajando sin volver a iniciar sesión.
 *
 * @param {import('../../lib/tokens.js').DatosSesion} datosSesion
 * @param {{ contrasenaActual: string, contrasenaNueva: string }} datos
 * @returns {Promise<SesionIniciada>}
 * @throws {AppError} 401 si la contraseña actual no es correcta; 422 si la nueva es igual.
 */
export async function cambiarContrasenaPropia(
  { usuarioId, tenantId },
  { contrasenaActual, contrasenaNueva },
) {
  // 1. Verificar la contraseña actual.
  const usuario = await conNegocio(tenantId, (tx) =>
    tx.usuario.findUnique({ where: { id: usuarioId } }),
  );
  if (!usuario || !usuario.activo) {
    throw new AppError(401, 'NO_AUTENTICADO', 'Debe iniciar sesión');
  }
  if (!(await verificarContrasena(usuario.passwordHash, contrasenaActual))) {
    throw new AppError(401, 'CONTRASENA_INCORRECTA', 'La contraseña actual no es correcta');
  }
  if (contrasenaActual === contrasenaNueva) {
    throw new AppError(
      422,
      'CONTRASENA_REPETIDA',
      'La contraseña nueva debe ser distinta a la actual',
    );
  }

  // 2. Guardar la nueva (el hash va fuera de la transacción porque argon2 es lento).
  const passwordHash = await hashearContrasena(contrasenaNueva);

  // 3. Cerrar todas las sesiones y abrir una nueva.
  return conNegocio(tenantId, async (tx) => {
    await tx.usuario.update({ where: { id: usuarioId }, data: { passwordHash } });
    await revocarSesionesDeUsuario(tx, usuarioId);
    return crearSesion(tx, usuario);
  });
}

/**
 * Cierra todas las sesiones abiertas de un usuario: sus refresh tokens dejan de servir.
 * El token de acceso que tenga en uso vence en máximo 15 minutos.
 * @param {TransaccionPrisma} tx
 * @param {string} usuarioId
 */
export async function revocarSesionesDeUsuario(tx, usuarioId) {
  await tx.sesionUsuario.updateMany({
    where: { usuarioId, revocadaEn: null },
    data: { revocadaEn: new Date() },
  });
}

// ───────────────────────────── Funciones internas ─────────────────────────────

/**
 * Crea una sesión: guarda el hash del refresh token y firma el token de acceso.
 * @param {TransaccionPrisma} tx
 * @param {{ id: string, tenantId: string, nombre: string, email: string, rol: Rol }} usuario
 * @returns {Promise<SesionIniciada>}
 */
async function crearSesion(tx, usuario) {
  const { token, tokenHash } = generarRefreshToken(usuario.tenantId);
  const expiraEn = new Date(Date.now() + env.REFRESH_TOKEN_DIAS * 24 * 60 * 60 * 1000);

  await tx.sesionUsuario.create({
    data: { tenantId: usuario.tenantId, usuarioId: usuario.id, tokenHash, expiraEn },
  });

  return {
    tokenAcceso: firmarTokenAcceso({
      usuarioId: usuario.id,
      tenantId: usuario.tenantId,
      rol: usuario.rol,
    }),
    refreshToken: token,
    expiraEnSegundos: env.JWT_MINUTOS * 60,
    usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
  };
}

/**
 * Suma un intento fallido y, si llegó al máximo, bloquea la cuenta temporalmente.
 * @param {TransaccionPrisma} tx
 * @param {string} usuarioId
 */
async function registrarIntentoFallido(tx, usuarioId) {
  // `increment` suma en la base, así dos intentos simultáneos no se pisan.
  const usuario = await tx.usuario.update({
    where: { id: usuarioId },
    data: { intentosFallidos: { increment: 1 } },
  });

  if (usuario.intentosFallidos >= MAXIMO_INTENTOS_FALLIDOS) {
    await tx.usuario.update({
      where: { id: usuarioId },
      data: {
        intentosFallidos: 0,
        bloqueadoHasta: new Date(Date.now() + MINUTOS_DE_BLOQUEO * 60 * 1000),
      },
    });
    logger.warn(
      { tenantId: usuario.tenantId, usuarioId },
      'Cuenta bloqueada por intentos fallidos',
    );
  }
}

function errorCredenciales() {
  return new AppError(401, 'CREDENCIALES_INVALIDAS', 'NIT, correo o contraseña incorrectos');
}

function errorCuentaBloqueada() {
  return new AppError(
    423,
    'CUENTA_BLOQUEADA',
    `Demasiados intentos fallidos. Intente de nuevo en ${MINUTOS_DE_BLOQUEO} minutos`,
  );
}

function errorRefreshInvalido() {
  return new AppError(401, 'REFRESH_INVALIDO', 'La sesión no es válida; inicie sesión de nuevo');
}
