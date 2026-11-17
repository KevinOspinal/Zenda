// @ts-check
// Reintentos de las acciones que se pueden repetir sin riesgo: crear el pedido, agregar o
// quitar un producto y enviarlo a la cocina.
//
// Con mala señal, una petición puede no llegar, o llegar y perderse la respuesta. Estas
// acciones se repiten solas durante unos segundos, con esperas cada vez más largas. El backend
// reconoce la repetición (el uuidOffline del pedido, la claveIdempotencia de cada producto) y
// no duplica nada.
//
// Cobrar nunca se repite solo: ver ModalCobro.
import { ErrorApi } from './errores.js';

/** Esperas entre un intento y el siguiente; la última se repite si queda tiempo. */
export const ESPERAS_ENTRE_INTENTOS_MS = Object.freeze([1000, 2000, 4000, 8000, 15_000]);

/** Cuánto se insiste, desde el primer intento. Después se avisa que no se pudo. */
export const LIMITE_DE_REINTENTOS_MS = 45_000;

/** Estados HTTP de un servidor que no respondió a tiempo o se está reiniciando. */
const ESTADOS_PASAJEROS = new Set([502, 503, 504]);

/** Lo que devuelve conReintentos cuando la acción ya se había hecho (ver `yaSeHizoSi`). */
export const YA_SE_HIZO = Symbol('ya se hizo');

/**
 * Indica si el error es de la conexión y no de la acción: puede salir bien si se repite.
 * Un error del negocio (caja cerrada, pedido cobrado...) no cambia con repetirlo.
 * @param {unknown} error
 */
export function esFallaPasajera(error) {
  return (
    error instanceof ErrorApi &&
    (error.codigo === 'SIN_CONEXION' || ESTADOS_PASAJEROS.has(error.status))
  );
}

/**
 * Hace la operación y, si falla por la conexión, la repite mientras quede tiempo.
 *
 * `yaSeHizoSi`: códigos de error que, en un reintento, muestran que un intento anterior sí
 * llegó (solo se perdió la respuesta). Por ejemplo, al quitar un producto, el reintento ya no
 * lo encuentra. Entonces no es una falla: se devuelve YA_SE_HIZO.
 *
 * @template T
 * @param {(intento: number) => Promise<T>} operacion Recibe el número de intento (0 el primero).
 * @param {object} [ajustes]
 * @param {(reintento: number, error: ErrorApi) => void} [ajustes.alReintentar] Antes de esperar
 *   cada reintento: sirve para mostrar "Enviando… sin señal".
 * @param {readonly string[]} [ajustes.yaSeHizoSi]
 * @param {readonly number[]} [ajustes.esperas]
 * @param {number} [ajustes.limiteMs]
 * @param {(ms: number) => Promise<void>} [ajustes.dormir] Para las pruebas.
 * @param {() => number} [ajustes.ahora] Para las pruebas.
 * @returns {Promise<T | typeof YA_SE_HIZO>}
 * @throws El último error, si no es pasajero o si se acabó el tiempo.
 */
export async function conReintentos(
  operacion,
  {
    alReintentar = () => {},
    yaSeHizoSi = [],
    esperas = ESPERAS_ENTRE_INTENTOS_MS,
    limiteMs = LIMITE_DE_REINTENTOS_MS,
    dormir = esperar,
    ahora = Date.now,
  } = {},
) {
  const inicio = ahora();
  for (let intento = 0; ; intento += 1) {
    try {
      return await operacion(intento);
    } catch (error) {
      // 1. En un reintento, "ya no existe" quiere decir que el intento anterior sí llegó.
      if (intento > 0 && error instanceof ErrorApi && yaSeHizoSi.includes(error.codigo)) {
        return YA_SE_HIZO;
      }

      // 2. Solo se repite una falla de la conexión, y solo si queda tiempo. La última espera
      //    se acorta a lo que falte: así el último intento cae justo en el límite.
      const quedaMs = limiteMs - (ahora() - inicio);
      if (!esFallaPasajera(error) || quedaMs <= 0) throw error;
      const espera = Math.min(esperas[Math.min(intento, esperas.length - 1)] ?? 0, quedaMs);

      // 3. Esperar y volver a intentar.
      alReintentar(intento + 1, /** @type {ErrorApi} */ (error));
      await dormir(espera);
    }
  }
}

/** @param {number} ms */
function esperar(ms) {
  return new Promise((resolver) => setTimeout(resolver, ms));
}
