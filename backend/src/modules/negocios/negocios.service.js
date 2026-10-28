// @ts-check
// Registro de un negocio nuevo con su usuario dueño, y consulta y cambio de su configuración.
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { IMPUESTO_POR_REGIMEN, facturaElectronica } from '../../config/impuestos.js';
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
  valorDomicilio: true,
  direccion: true,
  telefono: true,
  pieRecibo: true,
});

/** @typedef {import('../../config/impuestos.js').RegimenImpuesto} RegimenImpuesto */

/**
 * Datos del negocio para el cliente del API, con si factura electrónicamente: uno no
 * responsable de IVA ni del impuesto al consumo no lo hace y entrega recibo de venta.
 * @template {{ regimenImpuesto: RegimenImpuesto }} T
 * @param {T} negocio
 */
function presentarNegocio(negocio) {
  return { ...negocio, facturaElectronica: facturaElectronica(negocio.regimenImpuesto) };
}

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
  return conNegocio(sesion.tenantId, async (tx) =>
    presentarNegocio(
      await tx.tenant.findUniqueOrThrow({ where: { id: sesion.tenantId }, select: DATOS_NEGOCIO }),
    ),
  );
}

/** Cada valor configurable y la acción con la que su cambio queda en la auditoría. */
const CAMBIOS_AUDITADOS = /** @type {const} */ ([
  ['propinaSugerida', ACCIONES.CAMBIAR_PROPINA_SUGERIDA],
  ['valorDomicilio', ACCIONES.CAMBIAR_VALOR_DOMICILIO],
]);

/**
 * Cambia la configuración del negocio: propina sugerida, valor del domicilio, régimen de
 * impuestos y datos del recibo. La propina, el domicilio y el régimen quedan en la auditoría
 * con el valor anterior. Un régimen nuevo cambia el impuesto de los productos (ver
 * ajustarImpuestosDeProductos); las ventas pasadas y lo que ya se pidió no cambian.
 * @param {DatosSesion} sesion
 * @param {{ propinaSugerida?: string, valorDomicilio?: string,
 *   regimenImpuesto?: RegimenImpuesto, direccion?: string | null, telefono?: string | null,
 *   pieRecibo?: string | null }} datos
 */
export function actualizarNegocioActual(sesion, datos) {
  return conNegocio(sesion.tenantId, async (tx) => {
    // 1. Leer los valores anteriores para la auditoría.
    const anterior = await tx.tenant.findUniqueOrThrow({
      where: { id: sesion.tenantId },
      select: { propinaSugerida: true, valorDomicilio: true, regimenImpuesto: true },
    });

    // 2. Guardar el cambio.
    const negocio = await tx.tenant.update({
      where: { id: sesion.tenantId },
      data: datos,
      select: DATOS_NEGOCIO,
    });

    // 3. Registrar en la auditoría los valores que cambiaron.
    for (const [campo, accion] of CAMBIOS_AUDITADOS) {
      if (anterior[campo].equals(negocio[campo])) continue;
      await registrarAuditoria(tx, sesion, {
        accion,
        entidad: 'tenants',
        entidadId: sesion.tenantId,
        detalle: { anterior: anterior[campo], nuevo: negocio[campo] },
      });
    }

    // 4. Un régimen nuevo cambia el impuesto de los productos.
    if (anterior.regimenImpuesto !== negocio.regimenImpuesto) {
      const productosActualizados = await ajustarImpuestosDeProductos(
        tx,
        anterior.regimenImpuesto,
        negocio.regimenImpuesto,
      );
      await registrarAuditoria(tx, sesion, {
        accion: ACCIONES.CAMBIAR_REGIMEN_IMPUESTO,
        entidad: 'tenants',
        entidadId: sesion.tenantId,
        detalle: {
          anterior: anterior.regimenImpuesto,
          nuevo: negocio.regimenImpuesto,
          productosActualizados,
        },
      });
    }
    return presentarNegocio(negocio);
  });
}

/**
 * Ajusta el impuesto de los productos al régimen nuevo.
 * ⚠️ Regla para validar con un contador.
 * - No responsable: ningún producto lleva impuesto.
 * - De no responsable a INC o IVA: todos llevan el impuesto del régimen; el dueño revisa
 *   después los que no lo causan (por ejemplo, alimentos que se venden sin preparación).
 * - Entre INC e IVA: los que llevaban el impuesto anterior pasan al nuevo; los exentos siguen.
 * @param {import('../../lib/negocio.js').TransaccionPrisma} tx
 * @param {RegimenImpuesto} anterior
 * @param {RegimenImpuesto} nuevo
 * @returns {Promise<number>} Cuántos productos cambiaron.
 */
async function ajustarImpuestosDeProductos(tx, anterior, nuevo) {
  const impuestoNuevo = IMPUESTO_POR_REGIMEN[nuevo];
  if (!impuestoNuevo) {
    const { count } = await tx.producto.updateMany({
      where: { tipoImpuesto: { not: 'exento' } },
      data: { tipoImpuesto: 'exento' },
    });
    return count;
  }
  const impuestoAnterior = IMPUESTO_POR_REGIMEN[anterior];
  const { count } = await tx.producto.updateMany({
    where: impuestoAnterior ? { tipoImpuesto: impuestoAnterior } : {},
    data: { tipoImpuesto: impuestoNuevo },
  });
  return count;
}
