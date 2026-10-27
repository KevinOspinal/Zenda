// @ts-check
// Registro de un negocio nuevo con su usuario dueño.
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { hashearContrasena } from '../../lib/contrasenas.js';
import { AppError } from '../../lib/errors.js';
import { conNegocio } from '../../lib/negocio.js';
import { crearSesion } from '../auth/auth.service.js';

/**
 * Indica si el registro público está abierto. Si la variable REGISTRO_HABILITADO no se
 * definió, está abierto en desarrollo y en pruebas, y cerrado en producción.
 * @param {{ REGISTRO_HABILITADO?: boolean, NODE_ENV: string }} configuracion
 */
export function registroHabilitado(configuracion = env) {
  return configuracion.REGISTRO_HABILITADO ?? configuracion.NODE_ENV !== 'production';
}

/**
 * Crea el negocio y su dueño en una sola transacción (si algo falla, no queda nada a
 * medias) y entrega la sesión iniciada del dueño.
 *
 * @param {{
 *   negocio: { nombre: string, nit: string, ciudad?: string,
 *     regimenImpuesto: 'responsable_inc' | 'franquicia_iva' | 'no_responsable' },
 *   dueno: { nombre: string, email: string, contrasena: string },
 * }} datos
 * @throws {AppError} 403 si el registro está cerrado; 409 si el NIT ya está registrado.
 */
export async function registrarNegocio({ negocio, dueno }) {
  if (!registroHabilitado()) {
    throw new AppError(
      403,
      'REGISTRO_DESHABILITADO',
      'El registro de negocios nuevos no está disponible',
    );
  }

  // 1. El hash va fuera de la transacción: argon2 es lento a propósito.
  const passwordHash = await hashearContrasena(dueno.contrasena);

  // 2. El id se genera aquí porque hay que fijar el negocio activo antes de crearlo (RLS).
  const tenantId = randomUUID();

  try {
    return await conNegocio(tenantId, async (tx) => {
      const creado = await tx.tenant.create({ data: { id: tenantId, ...negocio } });
      const usuario = await tx.usuario.create({
        data: {
          tenantId,
          nombre: dueno.nombre,
          email: dueno.email,
          passwordHash,
          rol: 'dueno',
        },
      });

      // 3. El dueño queda con la sesión iniciada para empezar a configurar su negocio.
      const sesion = await crearSesion(tx, usuario);
      return {
        negocio: {
          id: creado.id,
          nombre: creado.nombre,
          nit: creado.nit,
          ciudad: creado.ciudad,
          regimenImpuesto: creado.regimenImpuesto,
        },
        ...sesion,
      };
    });
  } catch (error) {
    // El NIT es único en todo el sistema.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'NIT_YA_REGISTRADO', 'Ya existe un negocio registrado con ese NIT');
    }
    throw error;
  }
}
