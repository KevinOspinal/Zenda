// @ts-check
// Documentación de /grupos-opciones: término, adiciones y demás opciones de los productos.
import { esquemaParamsId } from '../../lib/esquemas.js';
import { esquemaGrupoOpciones } from '../../modules/opciones/opciones.schemas.js';
import { TODOS, cuerpo, operacion, parametros, respuesta } from '../ayudantes.js';
import { GRUPO_ADICIONES, ID } from '../ejemplos.js';

const EDITAN_MENU = /** @type {const} */ (['administrador_zenda', 'dueno', 'administrador']);

const parametroId = parametros('path', esquemaParamsId, {
  id: { descripcion: 'Id del grupo de opciones.', ejemplo: ID.grupoAdiciones },
});

const DESCRIPCIONES_GRUPO = {
  nombre: 'Como lo ve el mesero, por ejemplo "Término de la carne" o "Adiciones".',
  minimo: 'Cuántas opciones hay que elegir como mínimo. `0` = opcional; `1` = obligatorio.',
  maximo: 'Cuántas se pueden elegir como máximo. `1` = una sola; `null` = sin límite.',
  orden: 'Posición del grupo cuando un producto lleva varios. 0 se muestra primero.',
  opciones: 'Las opciones, en el orden en que se muestran. Con `id`, una que ya existe.',
  'opciones.id': 'Solo al editar: la opción que ya existe. Sin `id` se crea una nueva.',
  'opciones.precioExtra':
    'Lo que suma al precio del plato, **con el impuesto incluido**. `0` si no cuesta (3/4, sin cebolla).',
  'opciones.tipoImpuesto':
    'Impuesto propio de la opción, como el de los productos: `impoconsumo`, `iva` o `exento`, según el régimen del negocio.',
  'opciones.activo': '`false` deja de ofrecerla sin borrarla (por ejemplo, si se acabó).',
};

const REGLAS_GRUPO = `
**Reglas**
- El máximo no puede ser menor que el mínimo, y debe haber al menos tantas opciones
  activas como el mínimo (si no, 400).
- Sin nombres repetidos en el grupo.
- El impuesto de cada opción debe ser compatible con el régimen del negocio (si no, 422).
- Las ventas guardan una copia de cada opción elegida: editar o borrar opciones **no
  cambia lo que ya se vendió**.`;

export const documentacionOpciones = {
  '/grupos-opciones': {
    get: operacion({
      etiqueta: 'Menú',
      resumen: 'Listar los grupos de opciones',
      roles: TODOS,
      descripcion: `
Los grupos de opciones del negocio (término, adiciones, quitar...) con todas sus opciones,
también las inactivas, y en cuántos productos se usa cada uno (\`productos\`).

Un producto los lleva con \`gruposOpciones\` (ver \`/productos\`). Para tomar pedidos, usa
\`/menu\`: trae cada producto con sus grupos y solo las opciones activas.`,
      respuestas: { 200: respuesta('Grupos de opciones.', [GRUPO_ADICIONES]) },
    }),
    post: operacion({
      etiqueta: 'Menú',
      resumen: 'Crear un grupo de opciones',
      roles: [...EDITAN_MENU],
      descripcion: `
Crea un grupo con sus opciones. Ejemplos:
- **Término de la carne**: \`minimo: 1, maximo: 1\` (elegir uno, obligatorio).
- **Adiciones**: \`minimo: 0, maximo: null\` (varias, opcional), con precio.
- **Quitar**: \`minimo: 0\`, opciones sin precio como "Sin cebolla".

Después se asigna a los productos con \`gruposOpciones\` en \`/productos\`.
${REGLAS_GRUPO}`,
      cuerpo: cuerpo(esquemaGrupoOpciones, {
        ejemplo: {
          nombre: 'Adiciones',
          minimo: 0,
          maximo: null,
          opciones: [
            { nombre: 'Queso', precioExtra: '3000', tipoImpuesto: 'impoconsumo' },
            { nombre: 'Tocineta', precioExtra: '4000', tipoImpuesto: 'impoconsumo' },
          ],
        },
        descripciones: DESCRIPCIONES_GRUPO,
      }),
      respuestas: { 201: respuesta('Grupo creado.', GRUPO_ADICIONES) },
      errores: ['400', '422'],
    }),
  },

  '/grupos-opciones/{id}': {
    put: operacion({
      etiqueta: 'Menú',
      resumen: 'Editar un grupo de opciones',
      roles: [...EDITAN_MENU],
      descripcion: `
Reemplaza el grupo con lo que se envía: se manda **completo**, con todas sus opciones.
- Las opciones con \`id\` se actualizan; las que no traen \`id\` se crean.
- Las que no lleguen **se borran** (las ventas pasadas conservan su copia).
- Un cambio de precio queda en la **auditoría** (\`cambiar_precio\`), igual que el de un producto.
${REGLAS_GRUPO}`,
      parametros: parametroId,
      cuerpo: cuerpo(esquemaGrupoOpciones, {
        ejemplo: {
          nombre: 'Adiciones',
          minimo: 0,
          maximo: 3,
          opciones: [
            {
              id: ID.opcionQueso,
              nombre: 'Queso',
              precioExtra: '3500',
              tipoImpuesto: 'impoconsumo',
            },
          ],
        },
        descripciones: DESCRIPCIONES_GRUPO,
      }),
      respuestas: { 200: respuesta('Grupo actualizado.', { ...GRUPO_ADICIONES, maximo: 3 }) },
      errores: ['400', '404', '422'],
    }),
    delete: operacion({
      etiqueta: 'Menú',
      resumen: 'Borrar un grupo de opciones',
      roles: [...EDITAN_MENU],
      descripcion: `
Borra el grupo con sus opciones y lo quita de los productos que lo llevaban. Las ventas pasadas
conservan su copia de las opciones elegidas.`,
      parametros: parametroId,
      respuestas: { 204: respuesta('Grupo borrado. Sin contenido.') },
      errores: ['404'],
    }),
  },
};
