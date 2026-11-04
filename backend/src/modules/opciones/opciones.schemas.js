// @ts-check
// Esquemas Zod de los grupos de opciones de los productos (término, adiciones, quitar...).
import { z } from 'zod';
import { esquemaId, esquemaMonto, textoObligatorio } from '../../lib/esquemas.js';

/** Máximo de opciones por grupo: más no caben bien en la pantalla del mesero. */
export const MAXIMO_OPCIONES_POR_GRUPO = 30;

/** Una opción del grupo. Con `id` es una que ya existe; sin `id`, una nueva. */
const esquemaOpcion = z.object({
  id: esquemaId.optional(),
  nombre: textoObligatorio(60),
  // Lo que suma al precio del plato, con el impuesto incluido. 0 si no cuesta.
  precioExtra: esquemaMonto.default('0'),
  tipoImpuesto: z.enum(['impoconsumo', 'iva', 'exento']),
  activo: z.boolean().default(true),
});

/**
 * POST /grupos-opciones y PUT /grupos-opciones/:id
 * Se envía el grupo completo: las opciones van en el orden en que se muestran. Al editar, las
 * opciones que no lleguen se borran (las ventas pasadas conservan su copia).
 */
export const esquemaGrupoOpciones = z
  .object({
    nombre: textoObligatorio(60),
    // 0 = opcional; 1 o más = obligatorio.
    minimo: z.number().int().min(0).max(MAXIMO_OPCIONES_POR_GRUPO).default(0),
    // 1 = elegir una sola; null = sin límite.
    maximo: z.number().int().min(1).max(MAXIMO_OPCIONES_POR_GRUPO).nullable().default(null),
    orden: z.number().int().min(0).max(1000).default(0),
    opciones: z
      .array(esquemaOpcion)
      .min(1, 'agrega al menos una opción')
      .max(MAXIMO_OPCIONES_POR_GRUPO),
  })
  .superRefine((grupo, contexto) => {
    // 1. El máximo no puede ser menor que el mínimo.
    if (grupo.maximo !== null && grupo.maximo < grupo.minimo) {
      contexto.addIssue({
        code: 'custom',
        path: ['maximo'],
        message: 'el máximo no puede ser menor que el mínimo',
      });
    }
    // 2. Tiene que haber suficientes opciones activas para cumplir el mínimo.
    const activas = grupo.opciones.filter((opcion) => opcion.activo).length;
    if (grupo.minimo > activas) {
      contexto.addIssue({
        code: 'custom',
        path: ['minimo'],
        message: `se deben elegir ${grupo.minimo} y solo hay ${activas} opciones activas`,
      });
    }
    // 3. Sin nombres repetidos en el grupo (sin importar mayúsculas).
    const nombres = grupo.opciones.map((opcion) => opcion.nombre.toLowerCase());
    nombres.forEach((nombre, indice) => {
      if (nombres.indexOf(nombre) !== indice) {
        contexto.addIssue({
          code: 'custom',
          path: ['opciones', indice, 'nombre'],
          message: 'ya hay otra opción con este nombre',
        });
      }
    });
    // 4. Cada opción existente aparece una sola vez.
    const ids = grupo.opciones.map((opcion) => opcion.id).filter(Boolean);
    if (new Set(ids).size !== ids.length) {
      contexto.addIssue({ code: 'custom', path: ['opciones'], message: 'hay opciones repetidas' });
    }
  });
