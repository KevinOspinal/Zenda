// @ts-check
// Documentación de /mesas y /clientes.
import { esquemaParamsId } from '../../lib/esquemas.js';
import {
  esquemaActualizarCliente,
  esquemaCrearCliente,
  esquemaFiltrosClientes,
} from '../../modules/clientes/clientes.schemas.js';
import { esquemaActualizarMesa, esquemaCrearMesa } from '../../modules/mesas/mesas.schemas.js';
import { TODOS, cuerpo, operacion, parametros, respuesta } from '../ayudantes.js';
import { CLIENTE, ID, MESA } from '../ejemplos.js';

const EDITAN_MESAS = /** @type {const} */ (['dueno', 'administrador']);
const GESTIONAN_CLIENTES = /** @type {const} */ (['dueno', 'administrador', 'cajero']);

const idMesa = parametros('path', esquemaParamsId, {
  id: { descripcion: 'Id de la mesa.', ejemplo: ID.mesa },
});
const idCliente = parametros('path', esquemaParamsId, {
  id: { descripcion: 'Id del cliente.', ejemplo: ID.cliente },
});

const DESCRIPCIONES_MESA = {
  nombre: 'Nombre visible, único en tu negocio. Por ejemplo "Mesa 4" o "Terraza 1".',
  zona: 'Área del local, por ejemplo "Salón" o "Terraza". Opcional.',
  capacidad: 'Número de personas (1 a 50).',
};

const DESCRIPCIONES_CLIENTE = {
  tipoDocumento: '`cc` cédula, `nit`, `ce` cédula de extranjería, `pasaporte` u `otro`.',
  numeroDocumento:
    'Sin puntos ni guiones. La cédula, la cédula de extranjería y el NIT llevan solo números.',
  nombre: 'Nombre completo o razón social, como debe salir en la factura.',
  email: 'Correo al que llegará la factura electrónica. Opcional.',
  telefono: 'Teléfono de contacto. Opcional.',
};

export const documentacionMesasYClientes = {
  '/mesas': {
    get: operacion({
      etiqueta: 'Mesas',
      resumen: 'Listar las mesas (mapa del local)',
      roles: TODOS,
      descripcion: `
Todas las mesas con su estado (\`libre\` u \`ocupada\`), ordenadas por zona y nombre.

💡 En tiempo real, el evento \`mesa:estado\` avisa cuando una mesa cambia, sin volver a consultar.`,
      respuestas: { 200: respuesta('Lista de mesas.', [MESA]) },
    }),
    post: operacion({
      etiqueta: 'Mesas',
      resumen: 'Crear una mesa',
      roles: [...EDITAN_MESAS],
      descripcion: 'Agrega una mesa al local. Siempre se crea **libre**.',
      cuerpo: cuerpo(esquemaCrearMesa, {
        ejemplo: { nombre: 'Mesa 11', zona: 'Terraza', capacidad: 4 },
        descripciones: DESCRIPCIONES_MESA,
      }),
      respuestas: {
        201: respuesta('Mesa creada.', { ...MESA, nombre: 'Mesa 11', zona: 'Terraza' }),
      },
      errores: ['400', '409'],
    }),
  },

  '/mesas/{id}': {
    get: operacion({
      etiqueta: 'Mesas',
      resumen: 'Ver una mesa',
      roles: TODOS,
      descripcion: 'Detalle de una mesa con su estado actual.',
      parametros: idMesa,
      respuestas: { 200: respuesta('La mesa.', MESA) },
      errores: ['400', '404'],
    }),
    patch: operacion({
      etiqueta: 'Mesas',
      resumen: 'Editar una mesa',
      roles: [...EDITAN_MESAS],
      descripcion: `
Cambia el nombre, la zona o la capacidad. Envía solo lo que cambia.

El **estado** (libre u ocupada) no se edita aquí: lo cambian los pedidos automáticamente.`,
      parametros: idMesa,
      cuerpo: cuerpo(esquemaActualizarMesa, {
        ejemplo: { capacidad: 6 },
        descripciones: DESCRIPCIONES_MESA,
      }),
      respuestas: { 200: respuesta('Mesa actualizada.', { ...MESA, capacidad: 6 }) },
      errores: ['400', '404', '409'],
    }),
    delete: operacion({
      etiqueta: 'Mesas',
      resumen: 'Eliminar una mesa',
      roles: [...EDITAN_MESAS],
      descripcion: `
Elimina una mesa que **nunca ha tenido pedidos**. Si ya tuvo, responde 409 \`EN_USO\`
para no perder el historial de ventas.`,
      parametros: idMesa,
      respuestas: { 204: respuesta('Mesa eliminada. Sin contenido.') },
      errores: ['400', '404', '409'],
    }),
  },

  '/clientes': {
    get: operacion({
      etiqueta: 'Clientes',
      resumen: 'Buscar clientes',
      roles: [...GESTIONAN_CLIENTES],
      descripcion: `
Busca por **nombre** (contiene, sin importar mayúsculas) o por el **inicio del número de
documento**. Devuelve máximo 50 resultados.

🔒 El mesero no tiene acceso: los datos personales solo los ve quien factura (Ley 1581 de 2012).`,
      parametros: parametros('query', esquemaFiltrosClientes, {
        buscar: { descripcion: 'Texto a buscar (mínimo 2 caracteres).', ejemplo: 'ana' },
      }),
      respuestas: { 200: respuesta('Clientes encontrados.', [CLIENTE]) },
      errores: ['400'],
    }),
    post: operacion({
      etiqueta: 'Clientes',
      resumen: 'Registrar un cliente',
      roles: [...GESTIONAN_CLIENTES],
      descripcion: `
Registra a la persona o empresa que pide la factura a su nombre. Solo se piden los datos
necesarios para facturar (Ley 1581 de 2012).

No puede haber dos clientes con el mismo tipo y número de documento (responde 409).`,
      cuerpo: cuerpo(esquemaCrearCliente, {
        ejemplo: {
          tipoDocumento: 'cc',
          numeroDocumento: '1000000001',
          nombre: 'Ana María Ruiz',
          email: 'ana.ruiz@ejemplo.test',
          telefono: '3001234567',
        },
        descripciones: DESCRIPCIONES_CLIENTE,
      }),
      respuestas: { 201: respuesta('Cliente registrado.', CLIENTE) },
      errores: ['400', '409'],
    }),
  },

  '/clientes/{id}': {
    get: operacion({
      etiqueta: 'Clientes',
      resumen: 'Ver un cliente',
      roles: [...GESTIONAN_CLIENTES],
      descripcion: 'Datos de un cliente.',
      parametros: idCliente,
      respuestas: { 200: respuesta('El cliente.', CLIENTE) },
      errores: ['400', '404'],
    }),
    patch: operacion({
      etiqueta: 'Clientes',
      resumen: 'Editar un cliente',
      roles: [...GESTIONAN_CLIENTES],
      descripcion: 'Corrige los datos del cliente. Envía solo lo que cambia.',
      parametros: idCliente,
      cuerpo: cuerpo(esquemaActualizarCliente, {
        ejemplo: { email: 'ana.nuevo@ejemplo.test' },
        descripciones: DESCRIPCIONES_CLIENTE,
      }),
      respuestas: {
        200: respuesta('Cliente actualizado.', { ...CLIENTE, email: 'ana.nuevo@ejemplo.test' }),
      },
      errores: ['400', '404', '409'],
    }),
  },
};
