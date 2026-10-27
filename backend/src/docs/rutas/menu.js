// @ts-check
// Documentación de /menu, /categorias y /productos.
import { esquemaParamsId } from '../../lib/esquemas.js';
import {
  esquemaActualizarCategoria,
  esquemaActualizarProducto,
  esquemaCrearCategoria,
  esquemaCrearProducto,
  esquemaFiltrosProductos,
} from '../../modules/menu/menu.schemas.js';
import { TODOS, cuerpo, operacion, parametros, respuesta } from '../ayudantes.js';
import { ID, PRODUCTO_HAMBURGUESA } from '../ejemplos.js';

const EDITAN_MENU = /** @type {const} */ (['dueno', 'administrador']);

const CATEGORIA = { id: ID.categoria, tenantId: ID.negocio, nombre: 'Hamburguesas', orden: 0 };

const parametroId = (/** @type {string} */ que) =>
  parametros('path', esquemaParamsId, {
    id: { descripcion: `Id de ${que}.`, ejemplo: ID.categoria },
  });

const DESCRIPCIONES_PRODUCTO = {
  categoriaId: 'Categoría a la que pertenece. Debe ser de tu negocio.',
  nombre: 'Nombre como aparece en el menú.',
  descripcion: 'Ingredientes o detalle, por ejemplo "Pollo apanado y tocineta".',
  precio:
    'Precio final en pesos, **con el impuesto incluido** (lo que paga el cliente). Sin puntos de miles: `12000`, no `"12.000"`. Máximo 2 decimales.',
  tipoImpuesto:
    'Impuesto del producto. Un restaurante independiente usa `impoconsumo` (INC 8 %); una franquicia, `iva` (19 %); `exento` para alimentos sin preparación que no causan impuesto.',
  controlaStock:
    '`true` si el producto descuenta inventario al venderse (por ejemplo, bebidas embotelladas).',
  activo: '`false` lo oculta del menú sin borrarlo. Así las ventas pasadas no se afectan.',
};

export const documentacionMenu = {
  '/menu': {
    get: operacion({
      etiqueta: 'Menú',
      resumen: 'Menú para tomar pedidos',
      roles: TODOS,
      descripcion: `
Las categorías en el orden del menú, cada una con sus **productos activos**.
Es lo que ve el mesero al tomar un pedido.

💡 De aquí se sacan los \`id\` de los productos para crear pedidos. Cada \`id\` está
**encima del nombre** del producto, dentro de las mismas llaves \`{ }\`.`,
      respuestas: {
        200: respuesta('Menú agrupado por categoría.', [
          {
            ...CATEGORIA,
            productos: [
              {
                id: ID.hamburguesa,
                nombre: 'IND Classic Artesanal',
                descripcion: 'Carne artesanal, queso y vegetales',
                precio: '12000',
              },
            ],
          },
        ]),
      },
    }),
  },

  '/categorias': {
    get: operacion({
      etiqueta: 'Menú',
      resumen: 'Listar categorías',
      roles: TODOS,
      descripcion: 'Todas las categorías del negocio, ordenadas por `orden` y luego por nombre.',
      respuestas: { 200: respuesta('Lista de categorías.', [CATEGORIA]) },
    }),
    post: operacion({
      etiqueta: 'Menú',
      resumen: 'Crear una categoría',
      roles: [...EDITAN_MENU],
      descripcion: 'Crea una categoría del menú, por ejemplo "Postres".',
      cuerpo: cuerpo(esquemaCrearCategoria, {
        ejemplo: { nombre: 'Postres', orden: 8 },
        descripciones: {
          nombre: 'Nombre de la categoría.',
          orden: 'Posición en el menú: 0 aparece primero. Si no se envía, es 0.',
        },
      }),
      respuestas: {
        201: respuesta('Categoría creada.', { ...CATEGORIA, nombre: 'Postres', orden: 8 }),
      },
      errores: ['400'],
    }),
  },

  '/categorias/{id}': {
    patch: operacion({
      etiqueta: 'Menú',
      resumen: 'Editar una categoría',
      roles: [...EDITAN_MENU],
      descripcion: 'Cambia el nombre o el orden. Envía solo los campos que quieres cambiar.',
      parametros: parametroId('la categoría'),
      cuerpo: cuerpo(esquemaActualizarCategoria, {
        ejemplo: { orden: 2 },
        descripciones: { nombre: 'Nombre nuevo.', orden: 'Posición nueva en el menú.' },
      }),
      respuestas: { 200: respuesta('Categoría actualizada.', { ...CATEGORIA, orden: 2 }) },
      errores: ['400', '404'],
    }),
    delete: operacion({
      etiqueta: 'Menú',
      resumen: 'Eliminar una categoría vacía',
      roles: [...EDITAN_MENU],
      descripcion: `
Solo se puede eliminar si **no tiene productos**. Si tiene, responde 409 \`EN_USO\`:
mueve o desactiva primero sus productos.`,
      parametros: parametroId('la categoría'),
      respuestas: { 204: respuesta('Categoría eliminada. Sin contenido.') },
      errores: ['400', '404', '409'],
    }),
  },

  '/productos': {
    get: operacion({
      etiqueta: 'Menú',
      resumen: 'Listar productos',
      roles: TODOS,
      descripcion: `
Todos los productos, **incluidos los inactivos**, ordenados por nombre.
Para ver solo lo que se puede vender, usa \`?activo=true\` o el endpoint \`/menu\`.`,
      parametros: parametros('query', esquemaFiltrosProductos, {
        categoriaId: {
          descripcion: 'Solo los productos de esta categoría.',
          ejemplo: ID.categoria,
        },
        activo: { descripcion: '`true` solo activos; `false` solo inactivos.', ejemplo: 'true' },
      }),
      respuestas: { 200: respuesta('Lista de productos.', [PRODUCTO_HAMBURGUESA]) },
      errores: ['400'],
    }),
    post: operacion({
      etiqueta: 'Menú',
      resumen: 'Crear un producto',
      roles: [...EDITAN_MENU],
      descripcion: `
Agrega un producto al menú.

**Reglas**
- La categoría debe ser de tu negocio.
- El impuesto debe ser compatible con el régimen del negocio: un restaurante responsable
  del INC no puede cobrar IVA en ningún producto (son excluyentes). Si no, responde 422.
- El stock no se envía aquí: se registra con \`POST /inventario/movimientos\`.`,
      cuerpo: cuerpo(esquemaCrearProducto, {
        ejemplo: {
          categoriaId: ID.categoria,
          nombre: 'IND Rustik Artesanal',
          descripcion: 'Queso apanado, tocineta',
          precio: 22000,
          tipoImpuesto: 'impoconsumo',
        },
        descripciones: DESCRIPCIONES_PRODUCTO,
      }),
      respuestas: {
        201: respuesta('Producto creado.', {
          ...PRODUCTO_HAMBURGUESA,
          nombre: 'IND Rustik Artesanal',
          descripcion: 'Queso apanado, tocineta',
          precio: '22000',
        }),
      },
      errores: ['400', '404', '422'],
    }),
  },

  '/productos/{id}': {
    get: operacion({
      etiqueta: 'Menú',
      resumen: 'Ver un producto',
      roles: TODOS,
      descripcion: 'Detalle de un producto, incluido su stock actual.',
      parametros: parametros('path', esquemaParamsId, {
        id: { descripcion: 'Id del producto.', ejemplo: ID.hamburguesa },
      }),
      respuestas: { 200: respuesta('El producto.', PRODUCTO_HAMBURGUESA) },
      errores: ['400', '404'],
    }),
    patch: operacion({
      etiqueta: 'Menú',
      resumen: 'Editar un producto o cambiar su precio',
      roles: [...EDITAN_MENU],
      descripcion: `
Envía solo los campos que quieres cambiar.

- **Cambio de precio:** queda registrado en la **auditoría** con el precio anterior, el nuevo
  y quién lo cambió. Los pedidos ya tomados conservan el precio con que se vendieron.
- **Desactivar:** envía \`{ "activo": false }\`. Los productos no se borran para no afectar
  las ventas pasadas.
- El stock no se edita aquí: usa \`POST /inventario/movimientos\`.`,
      parametros: parametros('path', esquemaParamsId, {
        id: { descripcion: 'Id del producto.', ejemplo: ID.hamburguesa },
      }),
      cuerpo: cuerpo(esquemaActualizarProducto, {
        ejemplos: {
          precio: { summary: 'Cambiar el precio', value: { precio: 13000 } },
          desactivar: { summary: 'Sacar del menú (agotado)', value: { activo: false } },
        },
        descripciones: DESCRIPCIONES_PRODUCTO,
      }),
      respuestas: {
        200: respuesta('Producto actualizado.', { ...PRODUCTO_HAMBURGUESA, precio: '13000' }),
      },
      errores: ['400', '404', '422'],
    }),
  },
};
