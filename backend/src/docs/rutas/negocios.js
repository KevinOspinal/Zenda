// @ts-check
// Documentación de /negocios.
import { esquemaRegistroNegocio } from '../../modules/negocios/negocios.schemas.js';
import { cuerpo, operacion, respuesta } from '../ayudantes.js';
import { TOKEN_EJEMPLO } from '../ejemplos.js';

const ID_NEGOCIO_NUEVO = 'f0e1d2c3-b4a5-4697-8879-6a5b4c3d2e1f';

export const documentacionNegocios = {
  '/negocios/registro': {
    post: operacion({
      etiqueta: 'Negocios',
      resumen: 'Registrar un negocio nuevo',
      roles: null,
      descripcion: `
Crea un restaurante o cafetería con su **usuario dueño**, en una sola operación, y entrega
la **sesión iniciada** del dueño para que empiece a configurarlo: menú, mesas y empleados.

**Reglas**
- El **NIT** es único en todo el sistema (si ya existe, 409 \`NIT_YA_REGISTRADO\`). Es el
  que usarán todos los empleados para iniciar sesión.
- El **régimen de impuesto** define qué cobra el negocio: \`responsable_inc\` (INC 8 %,
  restaurantes independientes, por defecto), \`franquicia_iva\` (IVA 19 %) o
  \`no_responsable\` (sin impuesto al consumo). ⚠️ Confírmalo con un contador.
- El registro está **abierto en desarrollo y cerrado en producción** (403
  \`REGISTRO_DESHABILITADO\`). Se controla con la variable \`REGISTRO_HABILITADO\`.`,
      cuerpo: cuerpo(esquemaRegistroNegocio, {
        ejemplo: {
          negocio: {
            nombre: 'Café La Esquina',
            nit: '901234567',
            ciudad: 'Medellín',
            regimenImpuesto: 'responsable_inc',
          },
          dueno: {
            nombre: 'María López',
            email: 'maria@laesquina.test',
            contrasena: 'Esquina2026',
          },
        },
        descripciones: {
          'negocio.nombre': 'Nombre comercial del negocio.',
          'negocio.nit': 'Solo dígitos, sin puntos ni dígito de verificación.',
          'negocio.ciudad': 'Ciudad donde opera. Opcional.',
          'negocio.regimenImpuesto':
            '`responsable_inc` (por defecto), `franquicia_iva` o `no_responsable`.',
          'dueno.nombre': 'Nombre completo del dueño.',
          'dueno.email': 'Correo con el que el dueño iniciará sesión.',
          'dueno.contrasena': 'Mínimo 8 caracteres, con al menos una letra y un número.',
        },
      }),
      respuestas: {
        201: respuesta('Negocio registrado. El dueño ya tiene la sesión iniciada.', {
          negocio: {
            id: ID_NEGOCIO_NUEVO,
            nombre: 'Café La Esquina',
            nit: '901234567',
            ciudad: 'Medellín',
            regimenImpuesto: 'responsable_inc',
          },
          tokenAcceso: TOKEN_EJEMPLO,
          refreshToken: `${ID_NEGOCIO_NUEVO}.Qm9vbGVhbnNBcmVGdW5CdXRUaGlzSXNKdXN0QW5FeGFtcGxl`,
          expiraEnSegundos: 900,
          usuario: {
            id: 'a9b8c7d6-e5f4-4321-9a8b-7c6d5e4f3a2b',
            nombre: 'María López',
            email: 'maria@laesquina.test',
            rol: 'dueno',
          },
        }),
        403: respuesta('El registro está cerrado en este servidor.', {
          error: {
            code: 'REGISTRO_DESHABILITADO',
            message: 'El registro de negocios nuevos no está disponible',
          },
        }),
      },
      errores: ['400', '409'],
    }),
  },
};
