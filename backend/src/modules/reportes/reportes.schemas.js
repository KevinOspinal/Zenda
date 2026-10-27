// @ts-check
// Esquema del rango de fechas que aceptan todos los reportes.
import { z } from 'zod';
import { diasEnRango, hoyEnColombia } from '../../lib/fechas.js';

/** Máximo de días por consulta, para no recorrer años de ventas de un golpe. */
export const MAXIMO_DIAS = 366;

const fecha = z.iso.date('use el formato AAAA-MM-DD');

/**
 * ?desde=2026-10-01&hasta=2026-10-31 (días en hora de Colombia, ambos incluidos).
 * Sin fechas, el reporte es del día de hoy. Con solo una, el rango es ese único día.
 */
export const esquemaRangoReporte = z
  .object({ desde: fecha.optional(), hasta: fecha.optional() })
  .transform(({ desde, hasta }) => {
    const hoy = hoyEnColombia();
    return { desde: desde ?? hasta ?? hoy, hasta: hasta ?? desde ?? hoy };
  })
  .refine(({ desde, hasta }) => desde <= hasta, {
    message: '"desde" no puede ser posterior a "hasta"',
    path: ['desde'],
  })
  .refine(({ desde, hasta }) => diasEnRango(desde, hasta) <= MAXIMO_DIAS, {
    message: `el rango no puede tener más de ${MAXIMO_DIAS} días`,
    path: ['hasta'],
  });
