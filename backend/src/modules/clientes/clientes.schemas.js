// @ts-check
// Esquemas Zod de los clientes finales (a quienes se les factura).
//
// Por la Ley 1581 de 2012 (habeas data) solo se piden los datos necesarios para facturar.
import { z } from 'zod';
import { alMenosUnCampo, textoObligatorio } from '../../lib/esquemas.js';

const TIPOS_DOCUMENTO = /** @type {const} */ (['cc', 'nit', 'ce', 'pasaporte', 'otro']);

const camposCliente = {
  tipoDocumento: z.enum(TIPOS_DOCUMENTO),
  // Sin puntos ni guiones. El pasaporte y "otro" pueden tener letras.
  numeroDocumento: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{3,20}$/, 'solo letras y números, sin puntos ni guiones'),
  nombre: textoObligatorio(120),
  // Correo al que Factus envía la factura electrónica.
  email: z.string().trim().toLowerCase().pipe(z.email('correo inválido')).nullable(),
  telefono: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{7,20}$/, 'teléfono inválido')
    .nullable(),
};

/**
 * La cédula, la cédula de extranjería y el NIT son solo números.
 * @param {{ tipoDocumento?: string, numeroDocumento?: string }} datos
 */
function documentoCoincideConTipo({ tipoDocumento, numeroDocumento }) {
  if (!tipoDocumento || !numeroDocumento) return true;
  if (['cc', 'ce', 'nit'].includes(tipoDocumento)) return /^\d+$/.test(numeroDocumento);
  return true;
}

const mensajeDocumento = {
  message: 'la cédula, la cédula de extranjería y el NIT solo llevan números',
  path: ['numeroDocumento'],
};

/** POST /clientes */
export const esquemaCrearCliente = z
  .object({
    ...camposCliente,
    email: camposCliente.email.optional(),
    telefono: camposCliente.telefono.optional(),
  })
  .refine(documentoCoincideConTipo, mensajeDocumento);

/** PATCH /clientes/:id */
export const esquemaActualizarCliente = alMenosUnCampo(z.object(camposCliente).partial()).refine(
  documentoCoincideConTipo,
  mensajeDocumento,
);

/** GET /clientes?buscar=... (por nombre o número de documento) */
export const esquemaFiltrosClientes = z.object({
  buscar: z.string().trim().min(2, 'escriba al menos 2 caracteres').max(60).optional(),
});
