// @ts-check
// Esquemas del registro de un negocio nuevo y de su configuración.
import { z } from 'zod';
import { aDecimal } from '../../lib/dinero.js';
import {
  alMenosUnCampo,
  esquemaContrasenaNueva,
  esquemaMonto,
  esquemaTelefono,
  textoObligatorio,
} from '../../lib/esquemas.js';

/** Régimen de impuestos del negocio (ver src/config/impuestos.js). */
const esquemaRegimen = z.enum(['responsable_inc', 'franquicia_iva', 'no_responsable']);
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
    regimenImpuesto: esquemaRegimen.default('responsable_inc'),
  }),
  dueno: z.object({
    nombre: textoObligatorio(120),
    email: z.string().trim().toLowerCase().pipe(z.email('correo inválido')),
    contrasena: esquemaContrasenaNueva,
  }),
});

/** PATCH /negocios/actual: al menos un valor. */
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
      // No responsable = no factura electrónicamente: sin impuestos y con recibo de venta.
      regimenImpuesto: esquemaRegimen,
      // Datos del recibo de venta. null los borra.
      direccion: z.string().trim().max(200, 'máximo 200 caracteres').nullable(),
      telefono: esquemaTelefono.nullable(),
      pieRecibo: z.string().trim().max(200, 'máximo 200 caracteres').nullable(),
    })
    .partial(),
);
