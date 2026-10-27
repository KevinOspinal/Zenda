// @ts-check
// Registro de acciones sensibles en la tabla `auditoria` (solo admite inserciones).
//
// Se registra dentro de la misma transacción que el cambio: si el cambio se deshace,
// el registro de auditoría también, y nunca queda un cambio sin su registro.

/** @typedef {import('./negocio.js').TransaccionPrisma} TransaccionPrisma */
/** @typedef {import('./tokens.js').DatosSesion} DatosSesion */

/**
 * Acciones que se auditan. Usar siempre estas constantes para poder buscarlas después.
 */
export const ACCIONES = Object.freeze({
  CAMBIAR_PRECIO: 'cambiar_precio',
  ANULAR_VENTA: 'anular_venta',
  CERRAR_CAJA: 'cerrar_caja',
  CAMBIAR_CREDENCIALES_FACTURACION: 'cambiar_credenciales_facturacion',
});

/**
 * Guarda un registro de auditoría.
 * @param {TransaccionPrisma} tx Transacción del cambio que se audita.
 * @param {DatosSesion} sesion Usuario que hizo el cambio.
 * @param {object} registro
 * @param {string} registro.accion Una de `ACCIONES`.
 * @param {string} registro.entidad Tabla afectada, por ejemplo "productos".
 * @param {string} [registro.entidadId] Id del registro afectado.
 * @param {Record<string, unknown>} [registro.detalle] Datos útiles, por ejemplo el valor anterior y el nuevo.
 */
export async function registrarAuditoria(tx, sesion, { accion, entidad, entidadId, detalle }) {
  await tx.auditoria.create({
    data: {
      tenantId: sesion.tenantId,
      usuarioId: sesion.usuarioId,
      accion,
      entidad,
      entidadId,
      // Prisma exige un tipo JSON; los Decimal se guardan como texto para no perder precisión.
      detalle: detalle ? JSON.parse(JSON.stringify(detalle)) : undefined,
    },
  });
}
