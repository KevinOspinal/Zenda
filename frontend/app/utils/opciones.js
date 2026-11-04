// @ts-check
// Opciones de los productos (término, adiciones, quitar ingredientes):
// - Administración: cómo se describe la regla de un grupo, las formas de elegir que ofrece el
//   formulario y plantillas para empezar rápido.
// - Pedido: elegir respetando el máximo, qué grupos obligatorios faltan y el precio con las
//   adiciones (solo para mostrar).
// - Cuenta, cocina y recibo: el texto de lo que se eligió.
// Las reglas y el precio que se cobra los decide siempre el backend (ver
// backend/src/modules/opciones).
import { aDecimal, formatearPesos } from './dinero.js';

/**
 * @typedef {object} ReglaDeGrupo
 * @property {number} minimo 0 = opcional.
 * @property {number | null} maximo null = sin límite.
 */

/** @typedef {{ id: string, nombre: string, precioExtra: string }} OpcionDelMenu */
/** @typedef {ReglaDeGrupo & { id: string, nombre: string, opciones: OpcionDelMenu[] }} GrupoDelMenu */

/** Máximo de opciones por grupo (igual que en el backend). */
export const MAXIMO_OPCIONES_POR_GRUPO = 30;

/**
 * Formas de elegir más comunes, para no tener que pensar en mínimos y máximos.
 * 'personalizada' deja escribir el mínimo y el máximo.
 */
export const FORMAS_DE_ELEGIR = Object.freeze([
  {
    value: 'una_obligatoria',
    label: 'Elige una (obligatorio)',
    description: 'Por ejemplo, el término de la carne.',
    minimo: 1,
    maximo: 1,
  },
  {
    value: 'una_opcional',
    label: 'Una o ninguna',
    description: 'Por ejemplo, el tipo de pan si el cliente quiere cambiarlo.',
    minimo: 0,
    maximo: 1,
  },
  {
    value: 'varias_opcionales',
    label: 'Varias o ninguna',
    description: 'Por ejemplo, adiciones o ingredientes para quitar.',
    minimo: 0,
    maximo: null,
  },
  {
    value: 'personalizada',
    label: 'Personalizada',
    description: 'Tú defines cuántas debe y puede elegir.',
  },
]);

/**
 * La forma de elegir que corresponde a una regla (o 'personalizada' si no es una común).
 * @param {ReglaDeGrupo} regla
 */
export function formaDeElegir({ minimo, maximo }) {
  const forma = FORMAS_DE_ELEGIR.find((f) => f.minimo === minimo && f.maximo === maximo);
  return forma?.value ?? 'personalizada';
}

/**
 * Instrucción corta de un grupo: "Elige 1", "Elige hasta 3", "Elige las que quieras"...
 * Si es obligatorio u opcional se muestra aparte.
 * @param {ReglaDeGrupo} regla
 */
export function describirRegla({ minimo, maximo }) {
  if (maximo === null) return minimo === 0 ? 'Elige las que quieras' : `Elige al menos ${minimo}`;
  if (minimo === 0 && maximo > 1) return `Elige hasta ${maximo}`;
  if (minimo === 0 || minimo === maximo) return `Elige ${maximo}`;
  return `Elige de ${minimo} a ${maximo}`;
}

/**
 * Plantillas para crear rápido los grupos más comunes. Las adiciones llegan sin precio: el
 * dueño escribe el suyo.
 */
export const PLANTILLAS_DE_GRUPO = Object.freeze([
  {
    nombre: 'Término de la carne',
    icono: 'i-lucide-beef',
    minimo: 1,
    maximo: 1,
    opciones: ['Azul', 'Término medio', '3/4', 'Bien asado'],
  },
  {
    nombre: 'Adiciones',
    icono: 'i-lucide-circle-plus',
    minimo: 0,
    maximo: null,
    opciones: ['Queso', 'Tocineta'],
  },
  {
    nombre: 'Quitar ingredientes',
    icono: 'i-lucide-circle-minus',
    minimo: 0,
    maximo: null,
    opciones: ['Sin cebolla', 'Sin tomate', 'Sin salsas'],
  },
]);

/**
 * Indica si hay que elegir algo antes de agregar el producto (por ejemplo, el término).
 * @param {{ grupos?: GrupoDelMenu[] }} producto Producto de GET /menu.
 */
export function requiereElegir(producto) {
  return (producto.grupos ?? []).some((grupo) => grupo.minimo > 0);
}

/**
 * Elige o suelta una opción respetando el máximo del grupo. En los grupos de una sola opción,
 * elegir otra reemplaza la anterior; si además es obligatorio, la elegida no se suelta.
 * @param {GrupoDelMenu} grupo
 * @param {string[]} elegidas Ids elegidos en todo el plato.
 * @param {string} opcionId La opción que se tocó.
 * @returns {string[]} Las elegidas después del toque.
 */
export function alternarOpcion(grupo, elegidas, opcionId) {
  const delGrupo = new Set(grupo.opciones.map((opcion) => opcion.id));
  if (elegidas.includes(opcionId)) {
    if (grupo.maximo === 1 && grupo.minimo > 0) return elegidas;
    return elegidas.filter((id) => id !== opcionId);
  }
  if (grupo.maximo === 1) return [...elegidas.filter((id) => !delGrupo.has(id)), opcionId];
  const enElGrupo = elegidas.filter((id) => delGrupo.has(id)).length;
  if (grupo.maximo !== null && enElGrupo >= grupo.maximo) return elegidas;
  return [...elegidas, opcionId];
}

/**
 * Cuántas opciones de un grupo están elegidas.
 * @param {GrupoDelMenu} grupo
 * @param {string[]} elegidas
 */
export function elegidasEnGrupo(grupo, elegidas) {
  return grupo.opciones.filter((opcion) => elegidas.includes(opcion.id)).length;
}

/**
 * Los grupos obligatorios a los que todavía les falta elegir.
 * @param {GrupoDelMenu[]} grupos
 * @param {string[]} elegidas
 */
export function gruposPendientes(grupos, elegidas) {
  return grupos.filter((grupo) => elegidasEnGrupo(grupo, elegidas) < grupo.minimo);
}

/**
 * Precio de una unidad con las adiciones elegidas, solo para mostrar (el backend cobra).
 * @param {string} precio Precio del plato.
 * @param {GrupoDelMenu[]} grupos
 * @param {string[]} elegidas
 */
export function precioConOpciones(precio, grupos, elegidas) {
  return grupos
    .flatMap((grupo) => grupo.opciones)
    .filter((opcion) => elegidas.includes(opcion.id))
    .reduce((total, opcion) => total.plus(aDecimal(opcion.precioExtra)), aDecimal(precio));
}

/**
 * Texto de las opciones elegidas de un plato: "3/4 · Queso +$ 2.160 · Sin cebolla".
 * @param {{ nombre: string, precioExtra?: string }[] | undefined} opciones Las del ítem (API).
 * @param {{ conPrecio?: boolean }} [ajustes] La cocina no necesita los precios.
 */
export function textoDeOpciones(opciones, { conPrecio = true } = {}) {
  return (opciones ?? [])
    .map((opcion) =>
      conPrecio && aDecimal(opcion.precioExtra ?? 0).gt(0)
        ? `${opcion.nombre} +${formatearPesos(/** @type {string} */ (opcion.precioExtra))}`
        : opcion.nombre,
    )
    .join(' · ');
}
