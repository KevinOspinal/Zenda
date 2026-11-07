// @ts-check
// Calcula qué hay que cambiar en un negocio para que su menú quede igual a una carta (lo usa
// scripts/cargar-menu.js): qué crear, qué actualizar y qué ya no está en la carta. No llama al
// API: recibe lo que el negocio ya tiene y devuelve los cambios, para mostrarlos antes de
// aplicarlos (y para probarlo sin red).
//
// Reglas:
// - Las categorías, los grupos de opciones y los productos se reconocen por su nombre, sin
//   importar mayúsculas, tildes ni espacios de más. Un producto se reconoce aunque esté en otra
//   categoría: entonces se mueve a la de la carta.
// - Lo que la carta no dice de un producto no se toca: si no trae descripción o grupos de
//   opciones, se dejan los que tenga. Tampoco se tocan su impuesto ni su inventario.
// - Nada se borra aquí: lo que ya no está en la carta se propone retirar (desactivar los
//   productos y borrar los grupos de opciones que ningún producto activo va a usar), y el
//   script pregunta antes de hacerlo.
import { aDecimal } from '../src/lib/dinero.js';

/** @typedef {import('../prisma/datos/menus.js').MenuParaCargar} MenuParaCargar */
/** @typedef {import('../prisma/datos/menus.js').ProductoMenu} ProductoMenu */
/** @typedef {import('../prisma/datos/menus.js').GrupoMenu} GrupoMenu */
/** @typedef {import('../src/config/impuestos.js').TipoImpuesto} TipoImpuesto */

/**
 * @typedef {object} CategoriaDelNegocio
 * @property {string} id
 * @property {string} nombre
 * @property {number} orden
 */

/**
 * @typedef {object} ProductoDelNegocio
 * @property {string} id
 * @property {string} nombre
 * @property {string} categoriaId
 * @property {string} precio
 * @property {string | null} descripcion
 * @property {boolean} activo
 * @property {string[]} gruposOpciones Ids de sus grupos, en orden.
 */

/**
 * @typedef {object} GrupoDelNegocio
 * @property {string} id
 * @property {string} nombre
 * @property {number} minimo
 * @property {number | null} maximo
 * @property {{ id: string, nombre: string, precioExtra: string, activo: boolean }[]} opciones
 */

/**
 * Lo que el negocio ya tiene, tal como lo devuelve el API (GET /categorias, /productos y
 * /grupos-opciones).
 * @typedef {object} MenuDelNegocio
 * @property {CategoriaDelNegocio[]} categorias
 * @property {ProductoDelNegocio[]} productos Activos e inactivos.
 * @property {GrupoDelNegocio[]} grupos
 */

/** @typedef {'crear' | 'actualizar' | 'igual'} Accion */

/**
 * Lo que se envía al API para crear o reemplazar un grupo (POST o PUT /grupos-opciones): el
 * grupo completo, y cada opción que ya existe con su id para conservarla.
 * @typedef {object} CuerpoDeGrupo
 * @property {string} nombre
 * @property {number} minimo
 * @property {number | null} maximo
 * @property {number} orden
 * @property {{ id?: string, nombre: string, precioExtra: string, tipoImpuesto: TipoImpuesto,
 *   activo: boolean }[]} opciones
 */

/**
 * @typedef {object} CambioDeGrupo
 * @property {GrupoMenu} grupo El de la carta.
 * @property {Accion} accion
 * @property {string} [id] El del negocio, si ya existe.
 * @property {string[]} detalle Qué cambia, en palabras.
 * @property {CuerpoDeGrupo} cuerpo
 */

/**
 * @typedef {object} CambioDeCategoria
 * @property {string} nombre
 * @property {number} orden Su lugar en la carta.
 * @property {Accion} accion
 * @property {string} [id]
 * @property {string[]} detalle
 */

/** @typedef {'precio' | 'descripcion' | 'categoria' | 'grupos' | 'activo'} CampoDeProducto */

/**
 * @typedef {object} CambioDeProducto
 * @property {ProductoMenu} producto El de la carta.
 * @property {string} categoria Nombre de su categoría en la carta.
 * @property {Accion} accion
 * @property {string} [id]
 * @property {CampoDeProducto[]} campos Los que hay que cambiar.
 * @property {string[]} detalle
 */

/**
 * @typedef {object} CambiosDelMenu
 * @property {CambioDeGrupo[]} grupos En el orden de la carta.
 * @property {CambioDeCategoria[]} categorias En el orden de la carta.
 * @property {CambioDeProducto[]} productos En el orden de la carta.
 * @property {{ id: string, nombre: string }[]} productosARetirar Activos que ya no están en la
 *   carta.
 * @property {{ id: string, nombre: string }[]} gruposARetirar Los que no están en la carta y
 *   ningún producto activo va a usar.
 */

/**
 * Compara nombres sin importar mayúsculas, tildes ni espacios de más.
 * @param {string} nombre
 */
export function normalizar(nombre) {
  return nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Un monto como en la carta: "$176.000" (o "$4.500,50" si tiene centavos).
 * @param {string} valor
 */
export function pesos(valor) {
  const monto = aDecimal(valor);
  const [enteros, centavos] = monto.toFixed(monto.isInteger() ? 0 : 2).split('.');
  return `$${enteros.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${centavos ? `,${centavos}` : ''}`;
}

/**
 * @param {string} a
 * @param {string} b
 */
const mismoMonto = (a, b) => aDecimal(a).equals(aDecimal(b));

/**
 * @template {{ nombre: string }} T
 * @param {T[]} lista
 * @param {string} nombre
 * @returns {T | undefined}
 */
function buscarPorNombre(lista, nombre) {
  return lista.find((item) => normalizar(item.nombre) === normalizar(nombre));
}

/**
 * Busca un producto de la carta en el negocio: primero en su categoría y, si no está ahí, en
 * cualquier otra (prefiriendo uno activo).
 * @param {ProductoDelNegocio[]} productos
 * @param {string} nombre
 * @param {string | undefined} categoriaId
 */
function buscarProducto(productos, nombre, categoriaId) {
  const conEseNombre = productos.filter((p) => normalizar(p.nombre) === normalizar(nombre));
  return (
    conEseNombre.find((p) => p.categoriaId === categoriaId) ??
    conEseNombre.find((p) => p.activo) ??
    conEseNombre[0]
  );
}

/**
 * Las opciones de un grupo en palabras: "Pernil, Pechuga +$2.000".
 * @param {{ nombre: string, precioExtra: string }[]} opciones
 */
function describirOpciones(opciones) {
  return opciones
    .map((o) =>
      mismoMonto(o.precioExtra, '0') ? o.nombre : `${o.nombre} +${pesos(o.precioExtra)}`,
    )
    .join(', ');
}

/**
 * @param {GrupoMenu} grupo
 * @param {number} orden
 * @param {GrupoDelNegocio | undefined} actual
 * @param {TipoImpuesto} tipoImpuesto
 * @returns {CambioDeGrupo}
 */
function cambioDeGrupo(grupo, orden, actual, tipoImpuesto) {
  const cuerpo = {
    nombre: actual?.nombre ?? grupo.nombre,
    minimo: grupo.minimo,
    maximo: grupo.maximo,
    orden,
    opciones: grupo.opciones.map((opcion) => ({
      // Una opción que ya existe va con su id: así se actualiza en lugar de borrarse y
      // crearse de nuevo.
      id: actual && buscarPorNombre(actual.opciones, opcion.nombre)?.id,
      nombre: opcion.nombre,
      precioExtra: opcion.precioExtra,
      tipoImpuesto,
      activo: true,
    })),
  };
  if (!actual) {
    return { grupo, accion: 'crear', detalle: [`${grupo.opciones.length} opciones`], cuerpo };
  }

  const detalle = [];
  if (actual.minimo !== grupo.minimo) detalle.push(`mínimo ${actual.minimo} → ${grupo.minimo}`);
  if (actual.maximo !== grupo.maximo) {
    detalle.push(`máximo ${actual.maximo ?? 'sin límite'} → ${grupo.maximo ?? 'sin límite'}`);
  }
  const mismasOpciones =
    actual.opciones.length === grupo.opciones.length &&
    grupo.opciones.every((opcion, indice) => {
      const enElNegocio = actual.opciones[indice];
      return (
        enElNegocio.activo &&
        enElNegocio.nombre === opcion.nombre &&
        mismoMonto(enElNegocio.precioExtra, opcion.precioExtra)
      );
    });
  if (!mismasOpciones) {
    detalle.push(
      `opciones ${describirOpciones(actual.opciones)} → ${describirOpciones(grupo.opciones)}`,
    );
  }
  return { grupo, accion: detalle.length ? 'actualizar' : 'igual', id: actual.id, detalle, cuerpo };
}

/**
 * @param {string} nombre
 * @param {number} orden
 * @param {CategoriaDelNegocio | undefined} actual
 * @returns {CambioDeCategoria}
 */
function cambioDeCategoria(nombre, orden, actual) {
  if (!actual) return { nombre, orden, accion: 'crear', detalle: [] };
  const detalle = actual.orden === orden ? [] : ['cambia de lugar en el menú'];
  return { nombre, orden, accion: detalle.length ? 'actualizar' : 'igual', id: actual.id, detalle };
}

/**
 * @param {ProductoMenu} producto
 * @param {string} categoria
 * @param {ProductoDelNegocio | undefined} actual
 * @param {{ categorias: Map<string, string>, grupos: Map<string, string> }} nombres Nombre de
 *   cada categoría y de cada grupo del negocio, por su id.
 * @returns {CambioDeProducto}
 */
function cambioDeProducto(producto, categoria, actual, nombres) {
  if (!actual) {
    return { producto, categoria, accion: 'crear', campos: [], detalle: [pesos(producto.precio)] };
  }

  /** @type {CampoDeProducto[]} */
  const campos = [];
  const detalle = [];
  if (!actual.activo) {
    campos.push('activo');
    detalle.push('se vuelve a activar');
  }
  if (!mismoMonto(actual.precio, producto.precio)) {
    campos.push('precio');
    detalle.push(`precio ${pesos(actual.precio)} → ${pesos(producto.precio)}`);
  }
  const categoriaActual = nombres.categorias.get(actual.categoriaId) ?? '';
  if (normalizar(categoriaActual) !== normalizar(categoria)) {
    campos.push('categoria');
    detalle.push(`pasa de ${categoriaActual} a ${categoria}`);
  }
  if (producto.descripcion !== undefined && (actual.descripcion ?? '') !== producto.descripcion) {
    campos.push('descripcion');
    detalle.push('descripción nueva');
  }
  if (producto.grupos) {
    const gruposActuales = actual.gruposOpciones.map((id) => nombres.grupos.get(id) ?? '');
    if (gruposActuales.map(normalizar).join('|') !== producto.grupos.map(normalizar).join('|')) {
      campos.push('grupos');
      detalle.push(
        `opciones ${gruposActuales.join(', ') || 'ninguna'} → ${producto.grupos.join(', ') || 'ninguna'}`,
      );
    }
  }
  return {
    producto,
    categoria,
    accion: campos.length ? 'actualizar' : 'igual',
    id: actual.id,
    campos,
    detalle,
  };
}

/**
 * Compara la carta con lo que el negocio ya tiene y devuelve qué hay que cambiar.
 * @param {MenuParaCargar} menu
 * @param {MenuDelNegocio} negocio
 * @param {TipoImpuesto} tipoImpuesto El de los productos y opciones nuevos (sale del régimen).
 * @returns {CambiosDelMenu}
 */
export function calcularCambios(menu, negocio, tipoImpuesto) {
  // 1. Grupos de opciones y categorías, en el orden de la carta.
  const grupos = menu.grupos.map((grupo, orden) =>
    cambioDeGrupo(grupo, orden, buscarPorNombre(negocio.grupos, grupo.nombre), tipoImpuesto),
  );
  const categorias = menu.categorias.map(({ nombre }, orden) =>
    cambioDeCategoria(nombre, orden, buscarPorNombre(negocio.categorias, nombre)),
  );

  // 2. Productos: cada uno de la carta con el suyo en el negocio, si ya existe.
  const nombres = {
    categorias: new Map(negocio.categorias.map((c) => [c.id, c.nombre])),
    grupos: new Map(negocio.grupos.map((g) => [g.id, g.nombre])),
  };
  /** Productos del negocio que están en la carta. */
  const enLaCarta = new Set();
  /** Grupos que siguen en uso: los de productos de la carta a los que no se les cambian. */
  const gruposEnUso = new Set();
  const productos = menu.categorias.flatMap((categoria) => {
    const categoriaId = buscarPorNombre(negocio.categorias, categoria.nombre)?.id;
    return categoria.productos.map((producto) => {
      const actual = buscarProducto(negocio.productos, producto.nombre, categoriaId);
      if (actual) {
        enLaCarta.add(actual.id);
        if (!producto.grupos) actual.gruposOpciones.forEach((id) => gruposEnUso.add(id));
      }
      return cambioDeProducto(producto, categoria.nombre, actual, nombres);
    });
  });

  // 3. Lo que ya no está en la carta. Los grupos se proponen borrar solo si ningún producto
  //    que quede activo los usa.
  const gruposDeLaCarta = new Set(menu.grupos.map((grupo) => normalizar(grupo.nombre)));
  return {
    grupos,
    categorias,
    productos,
    productosARetirar: negocio.productos
      .filter((p) => p.activo && !enLaCarta.has(p.id))
      .map(({ id, nombre }) => ({ id, nombre })),
    gruposARetirar: negocio.grupos
      .filter((g) => !gruposDeLaCarta.has(normalizar(g.nombre)) && !gruposEnUso.has(g.id))
      .map(({ id, nombre }) => ({ id, nombre })),
  };
}
