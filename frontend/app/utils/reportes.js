// @ts-check
// Datos de los reportes listos para mostrar: horas completas para la gráfica, hora pico y
// el color de cada método de pago. Los totales los calcula el backend; aquí solo se ordenan
// y se convierten a número para dibujar (las cifras que se leen salen del texto del API).
import { aDecimal } from './dinero.js';

/** Color de cada método de pago en las gráficas (paleta validada, ver main.css). */
export const COLOR_METODO = Object.freeze({
  efectivo: 'var(--zenda-pago-efectivo)',
  tarjeta: 'var(--zenda-pago-tarjeta)',
  transferencia: 'var(--zenda-pago-transferencia)',
  otro: 'var(--zenda-pago-otro)',
});

/**
 * Hora del día como se dice en Colombia: 13 → "1 p. m.".
 * @param {number} hora 0 a 23
 */
export function etiquetaDeHora(hora) {
  const sufijo = hora < 12 ? 'a. m.' : 'p. m.';
  const enDoce = hora % 12 === 0 ? 12 : hora % 12;
  return `${enDoce} ${sufijo}`;
}

/**
 * Completa con cero las horas sin ventas entre la primera y la última, para que la gráfica
 * no salte horas.
 * @param {{ hora: number, ventas: number, total: string }[]} porHora
 * @returns {{ hora: number, etiqueta: string, ventas: number, total: number }[]}
 */
export function completarHoras(porHora) {
  if (!porHora.length) return [];
  const horas = porHora.map((fila) => fila.hora);
  const primera = Math.min(...horas);
  const ultima = Math.max(...horas);
  return Array.from({ length: ultima - primera + 1 }, (_, i) => {
    const hora = primera + i;
    const fila = porHora.find((f) => f.hora === hora);
    return {
      hora,
      etiqueta: etiquetaDeHora(hora),
      ventas: fila?.ventas ?? 0,
      // Solo para dibujar la barra.
      total: fila ? aDecimal(fila.total).toNumber() : 0,
    };
  });
}

/**
 * La hora con más ventas (por total). Null si no hay ventas.
 * @param {{ hora: number, ventas: number, total: string }[]} porHora
 */
export function horaPico(porHora) {
  /** @type {{ hora: number, ventas: number, total: string } | null} */
  let pico = null;
  for (const fila of porHora) {
    if (!pico || aDecimal(fila.total).greaterThan(pico.total)) pico = fila;
  }
  return pico;
}
