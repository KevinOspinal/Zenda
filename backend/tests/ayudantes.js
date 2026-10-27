// @ts-check
// Funciones de apoyo para las pruebas: crean negocios con usuarios y entregan sus tokens.
import { prisma } from '../src/lib/db.js';
import { conNegocio } from '../src/lib/negocio.js';
import { firmarTokenAcceso } from '../src/lib/tokens.js';

/** @typedef {'dueno' | 'administrador' | 'cajero' | 'mesero'} Rol */

/**
 * @typedef {object} NegocioDePrueba
 * @property {string} tenantId
 * @property {Record<Rol, string>} encabezados Encabezado `Authorization` listo para cada rol.
 */

/**
 * Crea un negocio con un usuario de cada rol y firma un token de acceso para cada uno.
 * Los tokens se firman directamente (sin pasar por el login) para que las pruebas sean rápidas.
 *
 * @param {string} nit NIT único para la prueba (los archivos de prueba comparten la base).
 * @param {{ regimenImpuesto?: 'responsable_inc' | 'franquicia_iva' | 'no_responsable' }} [opciones]
 * @returns {Promise<NegocioDePrueba>}
 */
export async function crearNegocioDePrueba(nit, { regimenImpuesto } = {}) {
  const negocio = await prisma.tenant.create({
    data: { nombre: `Negocio ${nit}`, nit, regimenImpuesto },
  });

  /** @type {Rol[]} */
  const roles = ['dueno', 'administrador', 'cajero', 'mesero'];
  /** @type {Partial<Record<Rol, string>>} */
  const encabezados = {};

  for (const rol of roles) {
    const usuario = await conNegocio(negocio.id, (tx) =>
      tx.usuario.create({
        data: {
          tenantId: negocio.id,
          nombre: `${rol} ${nit}`,
          email: `${rol}@${nit}.test`,
          // Las pruebas de este archivo no inician sesión con contraseña.
          passwordHash: 'sin-contrasena',
          rol,
        },
      }),
    );
    const token = firmarTokenAcceso({ usuarioId: usuario.id, tenantId: negocio.id, rol });
    encabezados[rol] = `Bearer ${token}`;
  }

  return { tenantId: negocio.id, encabezados: /** @type {Record<Rol, string>} */ (encabezados) };
}
