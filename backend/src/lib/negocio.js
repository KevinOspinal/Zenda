// @ts-check
// Ejecuta consultas "como" un negocio: abre una transacción y fija el negocio activo
// para que Row-Level Security solo deje ver y modificar los datos de ese negocio.
import { z } from 'zod';
import { prisma } from './db.js';

/** @typedef {Parameters<Parameters<typeof prisma.$transaction>[0]>[0]} TransaccionPrisma */

const esquemaTenantId = z.uuid();

/**
 * Ejecuta `trabajo` dentro de una transacción con el negocio activo fijado.
 *
 * Todo lo que se consulte con `tx` queda filtrado por PostgreSQL al negocio indicado.
 * El valor se fija con `set_config(..., true)`, que solo dura lo que dura la transacción,
 * así una conexión reutilizada nunca conserva el negocio de otra petición.
 *
 * @template T
 * @param {string} tenantId UUID del negocio activo.
 * @param {(tx: TransaccionPrisma) => Promise<T>} trabajo Consultas a ejecutar con `tx`.
 * @returns {Promise<T>} Lo que devuelva `trabajo`.
 * @throws {Error} Si `tenantId` no es un UUID válido.
 *
 * @example
 * const mesas = await conNegocio(req.tenantId, (tx) => tx.mesa.findMany());
 */
export async function conNegocio(tenantId, trabajo) {
  // 1. Validar el UUID antes de tocar la base: un valor inválido nunca debe llegar a RLS.
  const id = esquemaTenantId.parse(tenantId);

  return prisma.$transaction(async (tx) => {
    // 2. Fijar el negocio activo solo para esta transacción.
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${id}, true)`;

    // 3. Ejecutar las consultas; PostgreSQL filtra todo por el negocio activo.
    return trabajo(tx);
  });
}
