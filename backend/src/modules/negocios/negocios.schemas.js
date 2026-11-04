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

/**
 * Formatos de las llaves Bre-B, según el Banco de la República. El negocio solo escribe la
 * suya; aquí se revisa que tenga la forma de alguna para evitar errores de digitación.
 */
const FORMATOS_LLAVE_BRE_B = Object.freeze({
  // 10 dígitos que empiezan en 3, sin el +57.
  celular: /^3\d{9}$/,
  // 00 y 8 dígitos; lo asigna el adquirente al comercio.
  codigoDeComercio: /^00\d{8}$/,
  // Cédula, NIT, cédula de extranjería o pasaporte: sin puntos ni guiones, con al menos un número.
  documento: /^(?=.*\d)[A-Za-z0-9]{5,18}$/,
  // La que empieza por @, por ejemplo @laindustria.
  alfanumerica: /^@[A-Za-z0-9._-]{1,40}$/,
});

/**
 * Deja la llave como la registran los bancos: sin espacios alrededor; los números, sin
 * espacios, puntos ni guiones ("300 123 4567" → "3001234567"); el correo, en minúsculas.
 * @param {unknown} valor
 */
function normalizarLlaveBreB(valor) {
  if (typeof valor !== 'string') return valor;
  const llave = valor.trim();
  const soloNumeros = llave.replace(/[\s.-]/g, '');
  if (/^\d+$/.test(soloNumeros)) return soloNumeros;
  if (llave.includes('@') && !llave.startsWith('@')) return llave.toLowerCase();
  return llave;
}

/** @param {string} llave */
function esLlaveBreBValida(llave) {
  if (Object.values(FORMATOS_LLAVE_BRE_B).some((formato) => formato.test(llave))) return true;
  return z.email().safeParse(llave).success;
}

/** Llave Bre-B del negocio. null la borra. */
export const esquemaLlaveBreB = z
  .preprocess(
    normalizarLlaveBreB,
    z
      .string()
      .max(100, 'máximo 100 caracteres')
      .refine(
        esLlaveBreBValida,
        'llave Bre-B inválida: usa un celular (3001234567), un correo, un documento sin puntos, ' +
          'una llave que empiece por @ o un código de comercio (00 y 8 dígitos)',
      ),
  )
  .nullable();

/**
 * Contenido del QR de cobro que el banco le dio al negocio. No es la imagen: es el texto que
 * lleva el código (en los QR de pago, hasta 512 caracteres). null lo borra.
 */
export const esquemaQrBreB = z
  .string()
  .trim()
  .min(10, 'el contenido del QR es muy corto')
  .max(512, 'máximo 512 caracteres')
  // Sin saltos de línea ni caracteres de control: un QR de pago es una sola línea de texto.
  .regex(/^[^\p{Cc}]+$/u, 'el contenido del QR tiene caracteres no válidos')
  .nullable();

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
      // Cobro por Bre-B: salen en la precuenta y en el cobro por transferencia.
      llaveBreB: esquemaLlaveBreB,
      qrBreB: esquemaQrBreB,
    })
    .partial(),
);
