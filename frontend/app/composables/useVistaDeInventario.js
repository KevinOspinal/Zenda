// @ts-check
// Lo que muestra la pantalla de inventario: los contadores, el filtro por estado, la búsqueda,
// los grupos por categoría de la carta y el producto elegido para la vista rápida.
// La lógica pura está en utils/inventario.js; aquí solo se junta con los datos del store.

/** Nombre del grupo de los productos sin categoría conocida. */
const SIN_CATEGORIA = 'Sin categoría';

export function useVistaDeInventario() {
  const inventario = useInventarioStore();

  /** Estado elegido en los contadores, o null para ver todos. */
  const filtro = ref(/** @type {import('~/utils/inventario.js').EstadoStock | null} */ (null));
  const busqueda = ref('');

  /** Los contadores cuentan todo el inventario, sin importar la búsqueda. */
  const conteo = computed(() => conteoPorEstado(inventario.productos));

  /** Los productos del filtro y la búsqueda, lo más urgente primero. */
  const visibles = computed(() =>
    inventario.productos
      .filter(
        (producto) =>
          (!filtro.value || estadoDeStock(producto.stock) === filtro.value) &&
          coincideBusqueda(producto.nombre, busqueda.value),
      )
      .sort(compararPorUrgencia),
  );

  /**
   * Sin filtro ni búsqueda, los productos se agrupan por categoría (si hay más de una); al
   * filtrar o buscar, van todos juntos, lo más urgente primero.
   */
  const grupos = computed(() => {
    const categorias = new Set(
      visibles.value.map((producto) => inventario.categoriaPorProducto.get(producto.id)?.id),
    );
    const agrupar = !filtro.value && !busqueda.value.trim() && categorias.size > 1;
    if (agrupar) {
      return agruparPorCategoria(visibles.value, inventario.categoriaPorProducto, SIN_CATEGORIA);
    }
    return [
      {
        clave: 'todos',
        nombre: '',
        posicion: 0,
        apariencia: null,
        productos: visibles.value,
        porAtender: 0,
      },
    ];
  });

  // Producto de la vista rápida (o de la hoja de abajo, en el celular).
  const elegidoId = ref(/** @type {string | null} */ (null));
  const elegido = computed(
    () => inventario.productos.find((producto) => producto.id === elegidoId.value) ?? null,
  );

  function verTodos() {
    filtro.value = null;
    busqueda.value = '';
  }

  return { filtro, busqueda, conteo, visibles, grupos, elegidoId, elegido, verTodos };
}
