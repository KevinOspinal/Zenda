// @ts-check
// Fechas en hora de Colombia.
//
// La base guarda las fechas en UTC. Para el negocio, un "día" es el día en Colombia
// (UTC−5, sin horario de verano): un cobro a las 11:30 p. m. del 20 de octubre es del día 20,
// aunque en UTC ya sean las 4:30 a. m. del 21.

/** Zona horaria de Colombia para las consultas SQL (AT TIME ZONE). */
export const ZONA_HORARIA = 'America/Bogota';

/** Diferencia de Colombia con UTC. Colombia no cambia de horario en el año. */
const DESFASE_COLOMBIA = '-05:00';

const UN_DIA_EN_MS = 24 * 60 * 60 * 1000;

/**
 * Fecha de hoy en Colombia, en formato AAAA-MM-DD.
 * @returns {string}
 */
export function hoyEnColombia() {
  // Se resta el desfase a la hora UTC y se toma la parte de la fecha.
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Momento exacto en que empieza un día en Colombia (00:00 hora local).
 * @param {string} fecha AAAA-MM-DD
 * @returns {Date}
 */
export function inicioDelDia(fecha) {
  return new Date(`${fecha}T00:00:00${DESFASE_COLOMBIA}`);
}

/**
 * Rango de fechas para filtrar en la base: desde el inicio de `desde` hasta el final de `hasta`
 * (incluye todo ese día). Se usa como `fecha >= inicio AND fecha < fin`.
 * @param {string} desde AAAA-MM-DD
 * @param {string} hasta AAAA-MM-DD
 * @returns {{ inicio: Date, fin: Date }}
 */
export function rangoDeDias(desde, hasta) {
  return {
    inicio: inicioDelDia(desde),
    fin: new Date(inicioDelDia(hasta).getTime() + UN_DIA_EN_MS),
  };
}

/**
 * Cantidad de días de un rango, contando ambos extremos (del 1 al 3 son 3 días).
 * @param {string} desde AAAA-MM-DD
 * @param {string} hasta AAAA-MM-DD
 */
export function diasEnRango(desde, hasta) {
  return (
    Math.round((inicioDelDia(hasta).getTime() - inicioDelDia(desde).getTime()) / UN_DIA_EN_MS) + 1
  );
}
