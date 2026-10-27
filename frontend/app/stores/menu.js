// @ts-check
// Menú para tomar pedidos (GET /menu): categorías con sus productos activos.
// Cada categoría trae su ícono y su tono (utils/categorias.js) y cada producto, los de su
// categoría: los productos no tienen foto.

/** @typedef {{ id: string, nombre: string, descripcion: string | null, precio: string }} ProductoDelMenu */
/** @typedef {{ icono: string, fondo: string, texto: string }} AparienciaCategoria */

export const useMenuStore = defineStore('menu', () => {
  const categoriasDelApi = ref(
    /** @type {{ id: string, nombre: string, productos: ProductoDelMenu[] }[]} */ ([]),
  );
  /** sin_cargar · cargando · listo · error */
  const estadoCarga = ref('sin_cargar');
  const errorCarga = ref('');

  /** Categorías con su apariencia, en el orden del menú. Las vacías no se muestran. */
  const categorias = computed(() =>
    categoriasDelApi.value
      .map((categoria, posicion) => ({
        ...categoria,
        apariencia: aparienciaDeCategoria(categoria.nombre, posicion),
      }))
      .filter((categoria) => categoria.productos.length > 0),
  );

  /** Todos los productos, cada uno con su categoría y la apariencia de ella. */
  const productos = computed(() =>
    categorias.value.flatMap((categoria) =>
      categoria.productos.map((producto) => ({
        ...producto,
        categoriaId: categoria.id,
        apariencia: categoria.apariencia,
      })),
    ),
  );

  /**
   * Trae el menú. Se guarda para toda la sesión; `forzar` lo vuelve a traer.
   * @param {{ forzar?: boolean }} [opciones]
   */
  async function cargar({ forzar = false } = {}) {
    if (estadoCarga.value === 'listo' && !forzar) return;
    if (estadoCarga.value !== 'listo') estadoCarga.value = 'cargando';
    try {
      categoriasDelApi.value = await useApi().get('/menu');
      estadoCarga.value = 'listo';
      errorCarga.value = '';
    } catch (error) {
      errorCarga.value = error instanceof Error ? error.message : MENSAJE_ERROR_GENERICO;
      if (estadoCarga.value !== 'listo') estadoCarga.value = 'error';
    }
  }

  return { categorias, productos, estadoCarga, errorCarga, cargar };
});
