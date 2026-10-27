// @ts-check
// Registro de un negocio nuevo con su usuario dueño, y consulta y cambio de su configuración.
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { ACCIONES, registrarAuditoria } from '../../lib/auditoria.js';
import { hashearContrasena } from '../../lib/contrasenas.js';
import { AppError } from '../../lib/errors.js';
import { conNegocio } from '../../lib/negocio.js';
import { crearSesion } from '../auth/auth.service.js';

/** @typedef {import('../../lib/tokens.js').DatosSesion} DatosSesion */

/** Datos del negocio que se entregan al cliente del API. */
const DATOS_NEGOCIO = /** @type {const} */ ({
  id: true,
  nombre: true,
  nit: true,
  ciudad: true,
  regimenImpuesto: true,
  propinaSugerida: true,
});

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
      const creado = await tx.tenant.create({
        data: { id: tenantId, ...negocio },
        select: DATOS_NEGOCIO,
      });
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
      return { negocio: creado, ...sesion };
    });
  } catch (error) {
    // El NIT es único en todo el sistema.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'NIT_YA_REGISTRADO', 'Ya existe un negocio registrado con ese NIT');
    }
    throw error;
  }
}

/**
 * Datos y configuración del negocio de la sesión.
 * @param {DatosSesion} sesion
 */
export function obtenerNegocioActual(sesion) {
  return conNegocio(sesion.tenantId, (tx) =>
    tx.tenant.findUniqueOrThrow({ where: { id: sesion.tenantId }, select: DATOS_NEGOCIO }),
  );
}

/**
 * Cambia el porcentaje de propina sugerida. Queda en la auditoría con el valor anterior.
 * @param {DatosSesion} sesion
 * @param {{ propinaSugerida: string }} datos
 */
export function actualizarNegocioActual(sesion, { propinaSugerida }) {
  return conNegocio(sesion.tenantId, async (tx) => {
    // 1. Leer el valor anterior para la auditoría.
    const anterior = await tx.tenant.findUniqueOrThrow({
      where: { id: sesion.tenantId },
      select: { propinaSugerida: true },
    });

    // 2. Guardar el cambio.
    const negocio = await tx.tenant.update({
      where: { id: sesion.tenantId },
      data: { propinaSugerida },
      select: DATOS_NEGOCIO,
    });

    // 3. Registrar en la auditoría solo si el valor cambió.
    if (!anterior.propinaSugerida.equals(negocio.propinaSugerida)) {
      await registrarAuditoria(tx, sesion, {
        accion: ACCIONES.CAMBIAR_PROPINA_SUGERIDA,
        entidad: 'tenants',
        entidadId: sesion.tenantId,
        detalle: { anterior: anterior.propinaSugerida, nuevo: negocio.propinaSugerida },
      });
    }
    return negocio;
  });
}
