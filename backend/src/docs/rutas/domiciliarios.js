// @ts-check
// Documentación de /domiciliarios.
import { esquemaParamsId } from '../../lib/esquemas.js';
import {
  esquemaActualizarDomiciliario,
  esquemaCrearDomiciliario,
  esquemaFiltrosDomiciliarios,
} from '../../modules/domiciliarios/domiciliarios.schemas.js';
import { cuerpo, operacion, parametros, respuesta } from '../ayudantes.js';
import { DOMICILIARIO, ID } from '../ejemplos.js';

const CONSULTAN = /** @type {const} */ (['dueno', 'administrador', 'cajero']);
const GESTIONAN = /** @type {const} */ (['dueno', 'administrador']);

export const documentacionDomiciliarios = {
  '/domiciliarios': {
    get: operacion({
      etiqueta: 'Domiciliarios',
      resumen: 'Listar los domiciliarios',
      roles: [...CONSULTAN],
      descripcion: `
Los domiciliarios del negocio: primero los activos, por nombre. Con \`?activos=true\`, solo
los que pueden llevar pedidos (para elegir al despachar un domicilio).`,
      parametros: parametros('query', esquemaFiltrosDomiciliarios, {
        activos: { descripcion: '`true`: solo los activos.', ejemplo: 'true' },
      }),
      respuestas: { 200: respuesta('Lista de domiciliarios.', [DOMICILIARIO]) },
      errores: ['400'],
    }),
    post: operacion({
      etiqueta: 'Domiciliarios',
      resumen: 'Registrar un domiciliario',
      roles: [...GESTIONAN],
      descripcion: `
Registra a quien lleva los domicilios. No inicia sesión: la caja le asigna los pedidos al
despacharlos y le manda los datos por WhatsApp a su teléfono.`,
      cuerpo: cuerpo(esquemaCrearDomiciliario, {
        ejemplo: { nombre: 'Pedro Gómez', telefono: '3001234567' },
      }),
      respuestas: { 201: respuesta('Domiciliario registrado.', DOMICILIARIO) },
      errores: ['400'],
    }),
  },

  '/domiciliarios/{id}': {
    patch: operacion({
      etiqueta: 'Domiciliarios',
      resumen: 'Editar o desactivar un domiciliario',
      roles: [...GESTIONAN],
      descripcion: `
Cambia su nombre o su teléfono, o lo desactiva (\`activo: false\`). Los domiciliarios no se
borran: así se conserva el historial de los domicilios que llevaron.`,
      parametros: parametros('path', esquemaParamsId, {
        id: { descripcion: 'Id del domiciliario.', ejemplo: ID.domiciliario },
      }),
      cuerpo: cuerpo(esquemaActualizarDomiciliario, { ejemplo: { activo: false } }),
      respuestas: {
        200: respuesta('Domiciliario actualizado.', { ...DOMICILIARIO, activo: false }),
      },
      errores: ['400', '404'],
    }),
  },
};
