// @ts-check
// Documentación de /negocios.
import {
  esquemaConfiguracionNegocio,
  esquemaRegistroNegocio,
} from '../../modules/negocios/negocios.schemas.js';
import { TODOS, cuerpo, operacion, respuesta } from '../ayudantes.js';
import { ID, TOKEN_EJEMPLO } from '../ejemplos.js';

const ID_NEGOCIO_NUEVO = 'f0e1d2c3-b4a5-4697-8879-6a5b4c3d2e1f';

/** El negocio del demo, como lo entregan GET y PATCH /negocios/actual. */
const NEGOCIO_ACTUAL = {
  id: ID.negocio,
  nombre: 'La Industria',
  nit: '900111222',
  ciudad: 'Cali',
  regimenImpuesto: 'responsable_inc',
  propinaSugerida: '10',
  valorDomicilio: '3000',
};

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
- Límite: **5 registros por hora** desde una misma IP (si no, 429).
- El registro está **abierto en desarrollo y cerrado en producción** (403
  \`REGISTRO_DESHABILITADO\`). Se controla con la variable \`REGISTRO_HABILITADO\`.
- El negocio empieza sugiriendo una **propina del 10 %**; el dueño la cambia con
  \`PATCH /negocios/actual\`.`,
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
            propinaSugerida: '10',
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
      errores: ['400', '409', '429'],
    }),
  },

  '/negocios/actual': {
    get: operacion({
      etiqueta: 'Negocios',
      resumen: 'Ver el negocio de la sesión',
      roles: TODOS,
      descripcion: `
Datos y configuración del negocio con el que se inició sesión: nombre, NIT, ciudad,
régimen de impuesto y **porcentaje de propina sugerida**.`,
      respuestas: { 200: respuesta('El negocio.', NEGOCIO_ACTUAL) },
    }),
    patch: operacion({
      etiqueta: 'Negocios',
      resumen: 'Cambiar la propina sugerida',
      roles: ['dueno'],
      descripcion: `
Cambia la configuración del negocio. Envía uno o los dos valores.

**Valor del domicilio** (\`valorDomicilio\`): el que se propone en cada pedido a domicilio;
en cada pedido se puede cambiar (por ejemplo, si es lejos). Por defecto, $3.000. El cambio queda
en la **auditoría** (\`cambiar_valor_domicilio\`).

**Propina sugerida** (\`propinaSugerida\`, Ley 1935 de 2018). Solo se sugiere en los pedidos de
mesa (es por el servicio a la mesa).
- Entre **0 y 10 %**. La ley no permite sugerir más del 10 % (si no, 400).
- En **0** el negocio no sugiere propina; el cliente igual puede darla si quiere.
- La propina sugerida de cada pedido se calcula sobre el **subtotal antes de impuestos**.
  ⚠️ Confírmalo con un contador.
- El cambio queda en la **auditoría** con el valor anterior (\`cambiar_propina_sugerida\`).`,
      cuerpo: cuerpo(esquemaConfiguracionNegocio, {
        ejemplo: { propinaSugerida: 8, valorDomicilio: 3500 },
        descripciones: {
          propinaSugerida:
            'Porcentaje de 0 a 10, con máximo 2 decimales. 0 desactiva la sugerencia.',
          valorDomicilio: 'Valor del domicilio por defecto, en pesos.',
        },
      }),
      respuestas: {
        200: respuesta('Configuración actualizada.', {
          ...NEGOCIO_ACTUAL,
          propinaSugerida: '8',
          valorDomicilio: '3500',
        }),
      },
      errores: ['400'],
    }),
  },
};
