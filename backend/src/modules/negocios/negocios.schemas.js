// @ts-check
// Esquemas del registro de un negocio nuevo y de su configuración.
import { z } from 'zod';
import { aDecimal } from '../../lib/dinero.js';
import {
  alMenosUnCampo,
  esquemaContrasenaNueva,
  esquemaMonto,
  textoObligatorio,
} from '../../lib/esquemas.js';
import { PROPINA_MAXIMA_SUGERIDA } from '../pedidos/propina.js';

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

/** PATCH /negocios/actual: al menos uno de los dos valores. */
export const esquemaConfiguracionNegocio = alMenosUnCampo(
  z
    .object({
      // Porcentaje de propina que se sugiere en mesa: de 0 (no sugerir) a 10 % (Ley 1935 de 2018).
      propinaSugerida: esquemaMonto.refine(
        (valor) => aDecimal(valor).lessThanOrEqualTo(PROPINA_MAXIMA_SUGERIDA),
        `no puede superar el ${PROPINA_MAXIMA_SUGERIDA} % (Ley 1935 de 2018)`,
      ),
      // Valor del domicilio que se propone en cada pedido a domicilio (editable en cada uno).
      valorDomicilio: esquemaMonto,
    })
    .partial(),
);
