// @ts-check
// Inventario: el stock de los productos que lo controlan (GET /inventario) y la categoría de
// la carta de cada uno (GET /categorias y GET /productos), para mostrarlos con su ícono y su
// tono y agruparlos.
//
// En vivo: el stock baja al cobrar un pedido y vuelve al anularlo. El plugin de eventos avisa
// (alCambiarVentas) y, si el inventario ya está a la vista, se vuelve a traer y se resaltan los
// productos cuyo stock cambió.

/** @typedef {import('~/utils/inventario.js').ProductoDeInventario} ProductoDeInventario */
/** @typedef {import('~/utils/inventario.js').CategoriaDeProducto} CategoriaDeProducto */

/** Cuánto dura el resaltado de un producto cuyo stock cambió. */
const RESALTADO_MS = 1500;

export const useInventarioStore = defineStore('inventario', () => {
  const productos = ref(/** @type {ProductoDeInventario[]} */ ([]));
  /** sin_cargar · cargando · listo · error */
  const estadoCarga = ref('sin_cargar');
  const errorCarga = ref('');
  /** Categoría de la carta de cada producto, por su id. */
  const categoriaPorProducto = ref(/** @type {Map<string, CategoriaDeProducto>} */ (new Map()));
  /** Ids de los productos resaltados en este momento. */
  const resaltados = ref(/** @type {Set<string>} */ (new Set()));

  /**
   * Trae el inventario y, salvo en las recargas en vivo, las categorías de la carta (pudo
   * cambiar o ser de otro negocio). Si las categorías fallan, el inventario se muestra igual,
   * sin agrupar.
   * @param {{ conCarta?: boolean }} [opciones]
   */
  async function cargar({ conCarta = true } = {}) {
    if (estadoCarga.value !== 'listo') estadoCarga.value = 'cargando';
    const [inventario] = await Promise.allSettled([
      useApi().get('/inventario'),
      conCarta ? cargarCategorias() : Promise.resolve(),
    ]);
    if (inventario.status === 'rejected') {
      const error = inventario.reason;
      errorCarga.value = error instanceof Error ? error.message : MENSAJE_ERROR_GENERICO;
      if (estadoCarga.value !== 'listo') estadoCarga.value = 'error';
      return;
    }
    // Si ya se veía el inventario, se resaltan los productos que cambiaron.
    if (estadoCarga.value === 'listo') resaltarCambios(productos.value, inventario.value);
    productos.value = inventario.value;
    estadoCarga.value = 'listo';
    errorCarga.value = '';
  }

  /** Cruza los productos con las categorías de la carta (en el orden de la carta). */
  async function cargarCategorias() {
    const [categorias, productosDeLaCarta] = await Promise.all([
      useApi().get('/categorias'),
      useApi().get('/productos'),
    ]);
    /** @type {Map<string, CategoriaDeProducto>} */
    const porCategoria = new Map(
      categorias.map((/** @type {{ id: string, nombre: string }} */ categoria, posicion) => [
        categoria.id,
        {
          id: categoria.id,
          nombre: categoria.nombre,
          posicion,
          apariencia: aparienciaDeCategoria(categoria.nombre, posicion),
        },
      ]),
    );
    /** @type {Map<string, CategoriaDeProducto>} */
    const porProducto = new Map();
    for (const producto of productosDeLaCarta) {
      const categoria = porCategoria.get(producto.categoriaId);
      if (categoria) porProducto.set(producto.id, categoria);
    }
    categoriaPorProducto.value = porProducto;
  }

  /**
   * @param {ProductoDeInventario[]} antes
   * @param {ProductoDeInventario[]} ahora
   */
  function resaltarCambios(antes, ahora) {
    const stockAntes = new Map(antes.map((producto) => [producto.id, producto.stock]));
    for (const producto of ahora) {
      const anterior = stockAntes.get(producto.id);
      if (anterior !== undefined && !aDecimal(anterior).equals(aDecimal(producto.stock))) {
        resaltar(producto.id);
      }
    }
  }

  /** @param {string} productoId */
  function resaltar(productoId) {
    resaltados.value.add(productoId);
    setTimeout(() => resaltados.value.delete(productoId), RESALTADO_MS);
  }

  /**
   * Se registró una compra o un ajuste: el stock nuevo es el que respondió el API.
   * @param {{ productoId: string, stock: string }} resultado
   */
  function alRegistrarMovimiento({ productoId, stock }) {
    const producto = productos.value.find((p) => p.id === productoId);
    if (!producto) return;
    producto.stock = String(stock);
    resaltar(productoId);
  }

  // Varios cobros seguidos (por ejemplo, al cerrar la noche) piden el inventario una sola vez.
  const recargarEnVivo = useDebounceFn(() => cargar({ conCarta: false }), 400);

  /** Se cobró o se anuló un pedido: el stock pudo cambiar. Solo si ya está a la vista. */
  function alCambiarVentas() {
    if (estadoCarga.value === 'listo') recargarEnVivo();
  }

  return {
    productos,
    estadoCarga,
    errorCarga,
    categoriaPorProducto,
    resaltados,
    cargar,
    alRegistrarMovimiento,
    alCambiarVentas,
  };
});
