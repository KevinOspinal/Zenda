// @ts-check
// Funciones para escribir la documentación OpenAPI (Swagger) de forma corta y uniforme.
//
// Los cuerpos y parámetros se generan desde los MISMOS esquemas Zod que validan las
// peticiones: si cambia una validación, la documentación cambia sola.
import { z } from 'zod';

/** @typedef {'dueno' | 'administrador' | 'cajero' | 'mesero'} Rol */
/** @typedef {Record<string, any>} Objeto */

/** Nombre legible de cada rol. */
const NOMBRES_ROL = Object.freeze({
  dueno: 'Dueño',
  administrador: 'Administrador',
  cajero: 'Cajero',
  mesero: 'Mesero',
});

/** Todos los roles: para endpoints que cualquier usuario autenticado puede usar. */
export const TODOS = /** @type {Rol[]} */ (['dueno', 'administrador', 'cajero', 'mesero']);

/**
 * Convierte un esquema Zod a JSON Schema tal como lo recibe el API (antes de transformarlo)
 * y le agrega una descripción a cada campo.
 *
 * @param {import('zod').ZodType} esquema
 * @param {Record<string, string>} [descripciones] Por campo. Se puede entrar a listas y
 *   objetos con puntos: `'items.productoId'`.
 * @returns {Objeto}
 */
export function esquemaJson(esquema, descripciones = {}) {
  const json = z.toJSONSchema(esquema, { io: 'input', unrepresentable: 'any' });
  delete json.$schema;
  quitarPatronesConFormato(json);

  for (const [ruta, descripcion] of Object.entries(descripciones)) {
    for (const nodo of buscarCampos(json, ruta.split('.'))) {
      nodo.description = descripcion;
    }
  }
  return json;
}

/**
 * Cuerpo JSON de una petición.
 * @param {import('zod').ZodType} esquema
 * @param {{ ejemplo?: unknown, ejemplos?: Record<string, { summary: string, value: unknown }>,
 *   descripciones?: Record<string, string> }} opciones
 */
export function cuerpo(esquema, { ejemplo, ejemplos, descripciones }) {
  return {
    required: true,
    content: {
      'application/json': {
        schema: esquemaJson(esquema, descripciones),
        ...(ejemplo === undefined ? {} : { example: ejemplo }),
        ...(ejemplos ? { examples: ejemplos } : {}),
      },
    },
  };
}

/**
 * Parámetros de la URL a partir de un esquema de objeto Zod.
 * @param {'path' | 'query'} ubicacion `path` para `/pedidos/{id}`; `query` para `?desde=...`.
 * @param {import('zod').ZodType} esquema
 * @param {Record<string, { descripcion: string, ejemplo?: unknown }>} campos
 */
export function parametros(ubicacion, esquema, campos) {
  const json = esquemaJson(esquema);
  const requeridos = new Set(json.required ?? []);

  return Object.entries(json.properties ?? {}).map(([nombre, schema]) => ({
    name: nombre,
    in: ubicacion,
    // Los parámetros de ruta siempre son obligatorios.
    required: ubicacion === 'path' || requeridos.has(nombre),
    description: campos[nombre]?.descripcion,
    example: campos[nombre]?.ejemplo,
    schema,
  }));
}

/**
 * Respuesta exitosa con un ejemplo.
 * @param {string} descripcion
 * @param {unknown} [ejemplo]
 */
export function respuesta(descripcion, ejemplo) {
  return ejemplo === undefined
    ? { description: descripcion }
    : { description: descripcion, content: { 'application/json': { example: ejemplo } } };
}

/**
 * Arma una operación (un endpoint) con el formato común de toda la documentación.
 *
 * @param {object} op
 * @param {string} op.etiqueta Grupo en Swagger (Pedidos, Caja...).
 * @param {string} op.resumen Una línea: aparece junto a la ruta.
 * @param {string} op.descripcion Explicación completa en Markdown.
 * @param {Rol[] | null} op.roles Quién puede usarlo; null si es público (no requiere token).
 * @param {Objeto[]} [op.parametros]
 * @param {Objeto} [op.cuerpo]
 * @param {Record<string, Objeto>} op.respuestas Respuestas exitosas por código.
 * @param {('400' | '403' | '404' | '409' | '422' | '423' | '429')[]} [op.errores] Errores posibles
 *   además del 401, que se agrega solo en los endpoints protegidos.
 */
export function operacion(op) {
  const publica = op.roles === null;
  const errores = /** @type {string[]} */ ([...(op.errores ?? [])]);
  if (!publica) errores.unshift('401');
  if (!publica && op.roles && op.roles.length < TODOS.length && !errores.includes('403')) {
    errores.push('403');
  }

  return {
    tags: [op.etiqueta],
    summary: op.resumen,
    description: `${textoRoles(op.roles)}\n\n${op.descripcion.trim()}`,
    // Un arreglo vacío anula la autenticación global: el endpoint es público.
    ...(publica ? { security: [] } : {}),
    ...(op.parametros?.length ? { parameters: op.parametros } : {}),
    ...(op.cuerpo ? { requestBody: op.cuerpo } : {}),
    responses: {
      ...op.respuestas,
      ...Object.fromEntries(
        errores.sort().map((codigo) => [codigo, { $ref: `#/components/responses/Error${codigo}` }]),
      ),
    },
  };
}

/**
 * @param {Rol[] | null} roles
 */
function textoRoles(roles) {
  if (roles === null) return '🔓 **Público**: no requiere token.';
  if (roles.length === TODOS.length) return '🔐 **Quién puede usarlo:** todos los roles.';
  return `🔐 **Quién puede usarlo:** ${roles.map((rol) => NOMBRES_ROL[rol]).join(', ')}.`;
}

/**
 * Quita las expresiones regulares que Zod agrega a campos con formato conocido (uuid,
 * date, email): son muy largas y en Swagger se verían como un bloque ilegible.
 * El `format` ya explica qué se espera.
 * @param {unknown} nodo
 */
function quitarPatronesConFormato(nodo) {
  if (!nodo || typeof nodo !== 'object') return;
  const objeto = /** @type {Objeto} */ (nodo);
  if (objeto.format && objeto.pattern) delete objeto.pattern;
  for (const valor of Object.values(objeto)) quitarPatronesConFormato(valor);
}

/**
 * Busca los nodos de un campo dentro de un JSON Schema, entrando a listas, objetos
 * y alternativas (anyOf/oneOf, por ejemplo compra o ajuste de inventario).
 * @param {Objeto} nodo
 * @param {string[]} partes
 * @returns {Objeto[]}
 */
function buscarCampos(nodo, partes) {
  if (partes.length === 0) return [nodo];

  const alternativas = nodo.anyOf ?? nodo.oneOf;
  if (alternativas)
    return alternativas.flatMap((/** @type {Objeto} */ alt) => buscarCampos(alt, partes));
  if (nodo.type === 'array' && nodo.items) return buscarCampos(nodo.items, partes);

  const [actual, ...resto] = partes;
  const hijo = nodo.properties?.[actual];
  return hijo ? buscarCampos(hijo, resto) : [];
}
