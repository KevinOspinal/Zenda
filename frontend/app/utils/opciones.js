// @ts-check
// Opciones de los productos (término, adiciones, quitar ingredientes): cómo se describe la
// regla de un grupo, las formas de elegir que ofrece el formulario y plantillas para empezar
// rápido. Las reglas las valida siempre el backend (ver backend/src/modules/opciones).

/**
 * @typedef {object} ReglaDeGrupo
 * @property {number} minimo 0 = opcional.
 * @property {number | null} maximo null = sin límite.
 */

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
