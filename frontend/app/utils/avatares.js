// @ts-check
// Avatares sin foto (el API no guarda fotos de personas): las iniciales del nombre y un tono
// de color que siempre es el mismo para el mismo texto, para reconocer a cada uno de un
// vistazo en las listas de clientes.
import { TONOS_DE_CATEGORIA } from './categorias.js';

/**
 * Iniciales de un nombre, en mayúscula: "Marta Ruiz" → "MR", "Andrés" → "A".
 * Se toman las dos primeras palabras que empiezan con letra o número.
 * @param {string} nombre
 */
export function inicialesDe(nombre) {
  const palabras = nombre
    .trim()
    .split(/\s+/)
    .filter((palabra) => /^[\p{L}\p{N}]/u.test(palabra));
  return palabras
    .slice(0, 2)
    .map((palabra) => palabra[0])
    .join('')
    .toLocaleUpperCase('es-CO');
}

/**
 * Tono (fondo y texto) que le toca a un texto, siempre el mismo: así un cliente tiene su
 * color en todas las pantallas. Son los tonos decorativos de las categorías, que no se
 * confunden con los colores con significado (listo, atención, error).
 * @param {string} texto Por ejemplo, el id del cliente.
 */
export function tonoDeTexto(texto) {
  // Suma sencilla de los códigos de las letras, con un multiplicador para repartir mejor.
  let suma = 0;
  for (const letra of texto) suma = (suma * 31 + (letra.codePointAt(0) ?? 0)) % 1_000_003;
  return TONOS_DE_CATEGORIA[suma % TONOS_DE_CATEGORIA.length];
}
