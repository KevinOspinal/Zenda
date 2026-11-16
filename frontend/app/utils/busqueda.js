// @ts-check
// Búsqueda de texto para las listas (inventario, usuarios, clientes): sin importar tildes ni
// mayúsculas, por palabras en cualquier orden, y las partes de un texto que coinciden con lo
// buscado, para resaltarlas.
// Son funciones puras, para probarlas fácil (tests/unit/busqueda.test.js).

/**
 * Pasa un texto a minúsculas y sin tildes: "Árbol Ñandú" → "arbol nandu".
 * Conserva el largo del texto letra por letra (cada letra con tilde queda en una sola), para
 * que las posiciones sirvan sobre el texto original.
 * @param {string} texto
 */
export function normalizarTexto(texto) {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Palabras de una búsqueda, ya normalizadas: "  Gaseosa 1.5 " → ["gaseosa", "1.5"].
 * @param {string} busqueda
 */
function palabrasDe(busqueda) {
  return normalizarTexto(busqueda).split(/\s+/).filter(Boolean);
}

/**
 * El texto contiene todas las palabras buscadas, en cualquier orden y sin importar tildes ni
 * mayúsculas: "gaseosa 1.5" encuentra "Gaseosa 1.5 L". Una búsqueda vacía encuentra todo.
 * @param {string} texto
 * @param {string} busqueda
 */
export function coincideBusqueda(texto, busqueda) {
  const normalizado = normalizarTexto(texto);
  return palabrasDe(busqueda).every((palabra) => normalizado.includes(palabra));
}

/**
 * Qué letras de un texto cubre alguna palabra buscada (sin importar tildes ni mayúsculas):
 * una marca por letra. Si normalizar cambia el largo del texto (letras raras que se parten
 * en dos), no se marca nada.
 * @param {string} texto
 * @param {string} busqueda
 * @returns {boolean[]}
 */
export function marcasDeBusqueda(texto, busqueda) {
  const marcas = Array.from({ length: texto.length }, () => false);
  const normalizado = normalizarTexto(texto);
  if (normalizado.length !== texto.length) return marcas;
  for (const palabra of palabrasDe(busqueda)) {
    let desde = normalizado.indexOf(palabra);
    while (desde !== -1) {
      for (let i = desde; i < desde + palabra.length; i += 1) marcas[i] = true;
      desde = normalizado.indexOf(palabra, desde + 1);
    }
  }
  return marcas;
}

/**
 * Junta las letras seguidas con la misma marca en trozos: ("Ana", [F, T, T]) →
 * [{ texto: "A", coincide: false }, { texto: "na", coincide: true }].
 * @param {string} texto
 * @param {boolean[]} marcas Una por letra.
 * @returns {{ texto: string, coincide: boolean }[]}
 */
export function partesSegunMarcas(texto, marcas) {
  /** @type {{ texto: string, coincide: boolean }[]} */
  const partes = [];
  for (let i = 0; i < texto.length; i += 1) {
    const coincide = Boolean(marcas[i]);
    const ultima = partes.at(-1);
    if (ultima && ultima.coincide === coincide) ultima.texto += texto[i];
    else partes.push({ texto: texto[i], coincide });
  }
  return partes;
}

/**
 * Parte un texto en trozos, marcando los que coinciden con alguna palabra buscada, para
 * resaltarlos: ("Ana Ruiz", "ruí") → [{ texto: "Ana ", coincide: false },
 * { texto: "Rui", coincide: true }, { texto: "z", coincide: false }].
 * @param {string} texto
 * @param {string} busqueda
 * @returns {{ texto: string, coincide: boolean }[]}
 */
export function partesResaltadas(texto, busqueda) {
  if (!palabrasDe(busqueda).length) return texto ? [{ texto, coincide: false }] : [];
  return partesSegunMarcas(texto, marcasDeBusqueda(texto, busqueda));
}
