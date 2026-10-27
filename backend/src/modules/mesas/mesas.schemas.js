// @ts-check
// Esquemas Zod de las mesas.
import { z } from 'zod';
import { alMenosUnCampo, textoObligatorio } from '../../lib/esquemas.js';

const camposMesa = {
  // Único por negocio, por ejemplo "Mesa 4" o "Terraza 1".
  nombre: textoObligatorio(40),
  // Área del local, por ejemplo "Salón" o "Terraza".
  zona: z.string().trim().max(40).nullable(),
  capacidad: z.number().int().min(1, 'debe ser al menos 1').max(50),
};

/** POST /mesas */
export const esquemaCrearMesa = z.object({ ...camposMesa, zona: camposMesa.zona.optional() });

/**
 * PATCH /mesas/:id
 * El estado (libre u ocupada) no se edita aquí: lo cambian los pedidos.
 */
export const esquemaActualizarMesa = alMenosUnCampo(z.object(camposMesa).partial());
