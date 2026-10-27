// @ts-check
// Consulta de la auditoría: quién cambió precios, anuló ventas, cerró la caja o ajustó
// el inventario, y cuándo. Solo la ve el dueño. Los registros nunca se editan ni se borran.
//
// Módulo pequeño: la ruta, la validación y la consulta están juntas en este archivo.
import { Router } from 'express';
import { z } from 'zod';
import { ACCIONES } from '../../lib/auditoria.js';
import { conNegocio } from '../../lib/negocio.js';
import { autenticar, obtenerSesion, permitirRoles } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/validar.js';

/** GET /auditoria?accion=anular_venta&desde=2026-10-01&hasta=2026-10-31 */
const esquemaFiltrosAuditoria = z.object({
  accion: z.enum(/** @type {[string, ...string[]]} */ (Object.values(ACCIONES))).optional(),
  // Fechas en formato AAAA-MM-DD; "hasta" incluye todo ese día.
  desde: z.iso.date('use el formato AAAA-MM-DD').optional(),
  hasta: z.iso.date('use el formato AAAA-MM-DD').optional(),
});

export const rutasAuditoria = Router();
rutasAuditoria.use(autenticar, permitirRoles('dueno'));

rutasAuditoria.get('/', validar({ query: esquemaFiltrosAuditoria }), async (_req, res) => {
  const { accion, desde, hasta } = res.locals.entrada.query;
  const sesion = obtenerSesion(res);

  const registros = await conNegocio(sesion.tenantId, (tx) =>
    tx.auditoria.findMany({
      where: {
        accion,
        fecha: {
          gte: desde ? new Date(`${desde}T00:00:00-05:00`) : undefined,
          // Hasta el final del día indicado, en hora de Colombia (UTC−5).
          lt: hasta
            ? new Date(new Date(`${hasta}T00:00:00-05:00`).getTime() + 86_400_000)
            : undefined,
        },
      },
      orderBy: { fecha: 'desc' },
      take: 200,
      include: { usuario: { select: { id: true, nombre: true, rol: true } } },
    }),
  );

  res.json(registros);
});
