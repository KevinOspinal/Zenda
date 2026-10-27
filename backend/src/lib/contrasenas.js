// @ts-check
// Hash y verificación de contraseñas con argon2id.
//
// Nunca se guarda una contraseña en claro: solo su hash. argon2id es lento a propósito,
// así que adivinar contraseñas a partir de un hash robado es muy costoso.
import argon2 from 'argon2';

/**
 * Genera el hash de una contraseña para guardarlo en `usuarios.password_hash`.
 * @param {string} contrasena Contraseña en claro.
 * @returns {Promise<string>} Hash argon2id (incluye la sal y los parámetros usados).
 */
export function hashearContrasena(contrasena) {
  return argon2.hash(contrasena, { type: argon2.argon2id });
}

/**
 * Comprueba si una contraseña coincide con un hash guardado.
 * @param {string} hash Hash guardado en la base.
 * @param {string} contrasena Contraseña que escribió el usuario.
 * @returns {Promise<boolean>}
 */
export async function verificarContrasena(hash, contrasena) {
  try {
    return await argon2.verify(hash, contrasena);
  } catch {
    // Un hash dañado o con formato inválido se trata como contraseña incorrecta.
    return false;
  }
}

/**
 * Hash de una contraseña que nadie conoce. Se usa cuando el usuario no existe para
 * que la respuesta tarde lo mismo: así no se puede adivinar qué correos están registrados.
 */
export const HASH_FICTICIO = await hashearContrasena('contrasena-que-nunca-coincide');
