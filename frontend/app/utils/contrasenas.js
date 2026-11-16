// @ts-check
// Contraseñas nuevas: las reglas (copian las del backend, lib/esquemas.js), los requisitos que
// se marcan mientras se escribe y una contraseña segura generada al azar, fácil de dictar.
// Son funciones puras, para probarlas fácil (tests/unit/contrasenas.test.js).
import { z } from 'zod';

export const LARGO_MINIMO_CONTRASENA = 8;
export const LARGO_MAXIMO_CONTRASENA = 128;

const UNA_LETRA = /[A-Za-zÁÉÍÓÚáéíóúÑñ]/;
const UN_NUMERO = /\d/;

/**
 * Requisitos de una contraseña nueva, en el orden en que se muestran.
 * @type {ReadonlyArray<{ id: string, etiqueta: string, cumple: (contrasena: string) => boolean }>}
 */
export const REQUISITOS_CONTRASENA = Object.freeze([
  {
    id: 'largo',
    etiqueta: `Al menos ${LARGO_MINIMO_CONTRASENA} caracteres`,
    cumple: (contrasena) => contrasena.length >= LARGO_MINIMO_CONTRASENA,
  },
  { id: 'letra', etiqueta: 'Una letra', cumple: (contrasena) => UNA_LETRA.test(contrasena) },
  { id: 'numero', etiqueta: 'Un número', cumple: (contrasena) => UN_NUMERO.test(contrasena) },
]);

/** Esquema de una contraseña nueva, con los mensajes de cada regla. */
export const esquemaContrasenaNueva = z
  .string()
  .min(LARGO_MINIMO_CONTRASENA, `Debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres`)
  .max(LARGO_MAXIMO_CONTRASENA, `Máximo ${LARGO_MAXIMO_CONTRASENA} caracteres`)
  .regex(UNA_LETRA, 'Debe tener al menos una letra')
  .regex(UN_NUMERO, 'Debe tener al menos un número');

/**
 * Cada requisito con si ya se cumple, para la lista que se marca mientras se escribe.
 * @param {string} contrasena
 */
export function requisitosDe(contrasena) {
  return REQUISITOS_CONTRASENA.map(({ id, etiqueta, cumple }) => ({
    id,
    etiqueta,
    cumplido: cumple(contrasena),
  }));
}

/** @param {string} contrasena */
export function contrasenaValida(contrasena) {
  return esquemaContrasenaNueva.safeParse(contrasena).success;
}

// Letras y números sin los que se confunden al dictarlos o leerlos (0 y O, 1, l e I).
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const GRUPOS = 3;
const LETRAS_POR_GRUPO = 4;

/**
 * Llena un arreglo de bytes al azar (por defecto, con el generador seguro del navegador).
 * @typedef {(bytes: Uint8Array) => Uint8Array} FuenteAlAzar
 */
/** @type {FuenteAlAzar} */
const alAzarSeguro = (bytes) => globalThis.crypto.getRandomValues(bytes);

/**
 * Contraseña segura al azar, en grupos fáciles de dictar en persona: "Kx7m-Pq4r-Tz9w".
 * Doce caracteres de un alfabeto de 55 (unos 69 bits). Siempre tiene letras y números.
 * @param {FuenteAlAzar} [alAzar] Solo para las pruebas.
 */
export function generarContrasena(alAzar = alAzarSeguro) {
  const largo = GRUPOS * LETRAS_POR_GRUPO;
  // Se descartan los bytes que no caben un número exacto de veces en el alfabeto, para que
  // todas las letras salgan con la misma probabilidad.
  const limite = 256 - (256 % ALFABETO.length);
  for (;;) {
    let letras = '';
    while (letras.length < largo) {
      for (const byte of alAzar(new Uint8Array(largo * 2))) {
        if (byte < limite && letras.length < largo) letras += ALFABETO[byte % ALFABETO.length];
      }
    }
    const contrasena = letras.match(new RegExp(`.{${LETRAS_POR_GRUPO}}`, 'g'))?.join('-') ?? '';
    if (contrasenaValida(contrasena)) return contrasena;
  }
}
