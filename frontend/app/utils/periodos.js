// @ts-check
// Periodos de los reportes en hora de Colombia: hoy, ayer, esta semana y este mes.
// Las fechas van en formato YYYY-MM-DD, el que reciben los filtros del API.
import { diaEnColombia } from './fechas.js';

/** @typedef {'hoy' | 'ayer' | 'semana' | 'mes'} Periodo */
/** @typedef {{ desde: string, hasta: string }} Rango */

const UN_DIA_MS = 86_400_000;

/**
 * Mediodía de un día de Colombia. Sumar o restar días desde el mediodía nunca cae en otra
 * fecha por error (Colombia no tiene horario de verano).
 * @param {string} dia YYYY-MM-DD
 */
function mediodia(dia) {
  return new Date(`${dia}T12:00:00-05:00`);
}

/**
 * @param {string} dia YYYY-MM-DD
 * @param {number} dias Puede ser negativo.
 */
function sumarDias(dia, dias) {
  return diaEnColombia(mediodia(dia).getTime() + dias * UN_DIA_MS);
}

/**
 * Rango de fechas de un periodo.
 * - semana: desde el lunes de esta semana hasta hoy.
 * - mes: desde el día 1 hasta hoy.
 * @param {Periodo} periodo
 * @param {Date | string | number} [ahora]
 * @returns {Rango}
 */
export function rangoDePeriodo(periodo, ahora = new Date()) {
  const hoy = diaEnColombia(ahora);
  if (periodo === 'ayer') {
    const ayer = sumarDias(hoy, -1);
    return { desde: ayer, hasta: ayer };
  }
  if (periodo === 'semana') {
    // Día de la semana en Colombia (0 domingo ... 6 sábado); la semana empieza el lunes.
    const diasDesdeElLunes = (mediodia(hoy).getUTCDay() + 6) % 7;
    return { desde: sumarDias(hoy, -diasDesdeElLunes), hasta: hoy };
  }
  if (periodo === 'mes') return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
  return { desde: hoy, hasta: hoy };
}

/**
 * Cuántos días tiene un rango, contando ambos extremos.
 * @param {Rango} rango
 */
export function diasDelRango({ desde, hasta }) {
  return Math.round((mediodia(hasta).getTime() - mediodia(desde).getTime()) / UN_DIA_MS) + 1;
}
