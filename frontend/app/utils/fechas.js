// @ts-check
// Fechas y tiempos en hora de Colombia, en formato corto y humano.
//
// El API envía las fechas en ISO (UTC). Todo se muestra en la zona America/Bogota, sin
// importar la zona horaria del dispositivo. Colombia no tiene horario de verano.

export const ZONA_HORARIA = 'America/Bogota';

/** @typedef {Date | string | number} ValorFecha */

const HORA = new Intl.DateTimeFormat('es-CO', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: ZONA_HORARIA,
});

const PARTES_FECHA = new Intl.DateTimeFormat('es-CO', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: ZONA_HORARIA,
});

const FECHA_NUMERICA = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: ZONA_HORARIA,
});

// en-CA da el formato YYYY-MM-DD, el que usan los filtros de los reportes.
const DIA_ISO = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA });

/**
 * @param {ValorFecha} valor
 * @returns {Date}
 * @throws {TypeError} Si no es una fecha válida.
 */
function aFecha(valor) {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) throw new TypeError(`Fecha inválida: ${valor}`);
  return fecha;
}

/**
 * Hora en Colombia: "7:45 p. m."
 * @param {ValorFecha} fecha
 */
export function formatearHora(fecha) {
  return HORA.format(aFecha(fecha));
}

/**
 * Fecha y hora completas en Colombia, como van en un recibo: "28/10/2026 7:45 p. m.".
 * @param {ValorFecha} fecha
 */
export function formatearFechaYHora(fecha) {
  const valor = aFecha(fecha);
  return `${FECHA_NUMERICA.format(valor)} ${HORA.format(valor)}`;
}

/**
 * Fecha corta en Colombia: "lun 26 oct".
 * Se arma por partes porque cada navegador agrega "de", comas o puntos distintos.
 * @param {ValorFecha} fecha
 */
export function formatearFechaCorta(fecha) {
  const partes = PARTES_FECHA.formatToParts(aFecha(fecha));
  /** @param {Intl.DateTimeFormatPartTypes} tipo */
  const parte = (tipo) => (partes.find((p) => p.type === tipo)?.value ?? '').replace(/\.$/, '');
  return `${parte('weekday')} ${parte('day')} ${parte('month')}`;
}

/**
 * Día en Colombia en formato YYYY-MM-DD (el de los filtros `desde` y `hasta` del API).
 * @param {ValorFecha} [fecha] Por defecto, ahora.
 */
export function diaEnColombia(fecha = new Date()) {
  return DIA_ISO.format(aFecha(fecha));
}

/**
 * Fecha y hora relativas a hoy: "hoy 7:45 p. m.", "ayer 9:10 a. m." o "lun 26 oct 7:45 p. m.".
 * @param {ValorFecha} fecha
 * @param {ValorFecha} [ahora]
 */
export function fechaRelativa(fecha, ahora = new Date()) {
  const dia = diaEnColombia(fecha);
  const hoy = diaEnColombia(ahora);
  // Mediodía de hoy menos 24 horas siempre cae en el día anterior, aunque sea muy temprano.
  const ayer = diaEnColombia(new Date(`${hoy}T12:00:00-05:00`).getTime() - 24 * 60 * 60 * 1000);
  const hora = formatearHora(fecha);

  if (dia === hoy) return `hoy ${hora}`;
  if (dia === ayer) return `ayer ${hora}`;
  return `${formatearFechaCorta(fecha)} ${hora}`;
}

/**
 * Minutos completos que pasaron desde una fecha. Nunca negativo (si el reloj del
 * dispositivo va atrasado frente al del servidor, da 0).
 * @param {ValorFecha} desde
 * @param {ValorFecha} [ahora]
 */
export function minutosTranscurridos(desde, ahora = new Date()) {
  const milisegundos = aFecha(ahora).getTime() - aFecha(desde).getTime();
  return Math.max(0, Math.floor(milisegundos / 60000));
}

/**
 * Duración corta para tarjetas y comandas: "0 min", "12 min", "1 h 05 min", "2 h".
 * @param {number} minutos
 */
export function duracionCorta(minutos) {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${String(resto).padStart(2, '0')} min`;
}

/**
 * Tiempo desde un momento, para avisos: "hace un momento", "hace 12 min", "hace 1 h 05 min".
 * @param {ValorFecha} desde
 * @param {ValorFecha} [ahora]
 */
export function haceCuanto(desde, ahora = new Date()) {
  const minutos = minutosTranscurridos(desde, ahora);
  return minutos < 1 ? 'hace un momento' : `hace ${duracionCorta(minutos)}`;
}
