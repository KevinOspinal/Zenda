// @ts-check
// Esquema del registro de un negocio nuevo.
import { z } from 'zod';
import { esquemaContrasenaNueva, textoObligatorio } from '../../lib/esquemas.js';

/** POST /negocios/registro */
export const esquemaRegistroNegocio = z.object({
  negocio: z.object({
    nombre: textoObligatorio(120),
    // Solo dígitos, sin puntos ni dígito de verificación. Es el que se usará en el login.
    nit: z
      .string()
      .trim()
      .regex(/^\d{5,15}$/, 'debe tener solo dígitos, sin puntos ni dígito de verificación'),
    ciudad: z.string().trim().max(80).optional(),
    // Define qué impuesto se cobra (ver src/config/impuestos.js).
    regimenImpuesto: z
      .enum(['responsable_inc', 'franquicia_iva', 'no_responsable'])
      .default('responsable_inc'),
  }),
  dueno: z.object({
    nombre: textoObligatorio(120),
    email: z.string().trim().toLowerCase().pipe(z.email('correo inválido')),
    contrasena: esquemaContrasenaNueva,
  }),
});
