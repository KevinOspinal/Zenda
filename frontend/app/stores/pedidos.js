// @ts-check
// Pedidos activos (sin cobrar ni anular) con sus ítems. Los usan el mapa de mesas, la toma
// de pedidos, los avisos del mesero y la cocina.
//
// - Los datos vienen del API (GET /pedidos?activos=true&incluirItems=true).
// - Cada acción guarda el pedido completo que responde el API: los totales e impuestos los
//   calcula siempre el backend.
// - Los eventos en vivo los mantienen al día (ver plugins/02.eventos-en-vivo.client.js).

/** Estados de un pedido que todavía se puede modificar o cobrar. */
const ESTADOS_ACTIVOS = Object.freeze(['abierto', 'enviado_a_cocina']);

/**
 * @typedef {{ productoId: string, cantidad: string | number, notas?: string | null }} NuevoItem
 */

export const usePedidosStore = defineStore('pedidos', () => {
  /** Pedidos activos por id. */
  const porId = ref(/** @type {Record<string, any>} */ ({}));
  /** sin_cargar · cargando · listo · error */
  const estadoCarga = ref('sin_cargar');
  const errorCarga = ref('');

  /** Pedidos activos, del más antiguo al más reciente. */
  const lista = computed(() =>
    Object.values(porId.value).sort((a, b) => String(a.abiertoEn).localeCompare(b.abiertoEn)),
  );

  /** @param {string} mesaId */
  function pedidoDeMesa(mesaId) {
    return lista.value.find((pedido) => pedido.mesaId === mesaId) ?? null;
  }

  /**
   * Platos listos para llevar, con su pedido. Si se indica un mesero, solo los de sus pedidos.
   * @param {string} [meseroId]
   */
  function platosListos(meseroId) {
    return lista.value
      .filter((pedido) => !meseroId || pedido.meseroId === meseroId)
      .flatMap((pedido) =>
        (pedido.items ?? [])
          .filter((/** @type {any} */ item) => item.estadoCocina === 'listo')
          .map((/** @type {any} */ item) => ({ item, pedido })),
      );
  }

  /**
   * Guarda un pedido que entregó el API. Si ya no está activo (se cobró o se anuló), lo quita.
   * @param {any} pedido
   */
  function guardar(pedido) {
    if (ESTADOS_ACTIVOS.includes(pedido.estado)) porId.value[pedido.id] = pedido;
    else delete porId.value[pedido.id];
  }

  // ───────────────────────────── Cargar ─────────────────────────────

  /** Trae todos los pedidos activos con sus ítems. */
  async function cargarActivos() {
    if (estadoCarga.value !== 'listo') estadoCarga.value = 'cargando';
    try {
      const pedidos = await useApi().get('/pedidos', { activos: true, incluirItems: true });
      porId.value = Object.fromEntries(pedidos.map((/** @type {any} */ p) => [p.id, p]));
      estadoCarga.value = 'listo';
      errorCarga.value = '';
    } catch (error) {
      errorCarga.value = error instanceof Error ? error.message : MENSAJE_ERROR_GENERICO;
      if (estadoCarga.value !== 'listo') estadoCarga.value = 'error';
    }
  }

  /**
   * Trae un pedido completo (con subtotal, impuestos y propina sugerida).
   * Lo devuelve aunque ya no esté activo, para que la pantalla diga qué pasó con él.
   * @param {string} id
   */
  async function cargarDetalle(id) {
    const pedido = await useApi().get(`/pedidos/${id}`);
    guardar(pedido);
    return pedido;
  }

  // ───────────────────────────── Acciones ─────────────────────────────

  /**
   * Crea un pedido con sus primeros productos. Sin mesa es una venta de mostrador.
   * El uuidOffline evita duplicarlo si la petición se repite.
   * @param {{ mesaId?: string, items: NuevoItem[] }} datos
   */
  async function crear({ mesaId, items }) {
    const pedido = await useApi().post('/pedidos', { mesaId, items, uuidOffline: generarUuid() });
    guardar(pedido);
    return pedido;
  }

  /**
   * @param {string} pedidoId
   * @param {NuevoItem} item
   */
  async function agregarItem(pedidoId, item) {
    const pedido = await useApi().post(`/pedidos/${pedidoId}/items`, item);
    guardar(pedido);
    return pedido;
  }

  /**
   * @param {string} pedidoId
   * @param {string} itemId
   */
  async function quitarItem(pedidoId, itemId) {
    const pedido = await useApi().eliminar(`/pedidos/${pedidoId}/items/${itemId}`);
    guardar(pedido);
    return pedido;
  }

  /** @param {string} pedidoId */
  async function enviarACocina(pedidoId) {
    const pedido = await useApi().post(`/pedidos/${pedidoId}/enviar-cocina`);
    guardar(pedido);
    return pedido;
  }

  /**
   * Avanza un plato en la cocina (preparando, listo o entregado).
   * Se ve al instante; si el API lo rechaza, vuelve a como estaba y lanza el error.
   * @param {string} pedidoId
   * @param {string} itemId
   * @param {'preparando' | 'listo' | 'entregado'} estadoCocina
   */
  async function cambiarEstadoCocina(pedidoId, itemId, estadoCocina) {
    const item = porId.value[pedidoId]?.items?.find((/** @type {any} */ i) => i.id === itemId);
    const anterior = item?.estadoCocina;
    if (item) item.estadoCocina = estadoCocina;
    try {
      const pedido = await useApi().patch(`/pedidos/${pedidoId}/items/${itemId}/cocina`, {
        estadoCocina,
      });
      guardar(pedido);
      return pedido;
    } catch (error) {
      if (item) item.estadoCocina = anterior;
      throw error;
    }
  }

  /**
   * Cobra un pedido. Los pagos deben sumar exactamente el total más la propina.
   * Devuelve la respuesta del API: el pedido pagado, el cambio y las advertencias de stock.
   * @param {string} pedidoId
   * @param {{ pagos: object[], propina?: string, clienteId?: string }} datos
   * @returns {Promise<{ pedido: any, cambio: string, advertencias: any[] }>}
   */
  async function cobrar(pedidoId, datos) {
    const respuesta = await useApi().post(`/pedidos/${pedidoId}/cobrar`, datos);
    guardar(respuesta.pedido);
    return respuesta;
  }

  /**
   * Anula un pedido (dueño y administrador). Exige el motivo; queda en la auditoría.
   * @param {string} pedidoId
   * @param {string} motivo
   */
  async function anular(pedidoId, motivo) {
    const pedido = await useApi().post(`/pedidos/${pedidoId}/anular`, { motivo });
    guardar(pedido);
    return pedido;
  }

  /**
   * Pasa productos (o parte de sus unidades) a una cuenta nueva.
   * @param {string} pedidoId
   * @param {{ itemId: string, cantidad: string | number }[]} items
   * @returns {Promise<{ original: any, nuevo: any }>}
   */
  async function dividir(pedidoId, items) {
    const respuesta = await useApi().post(`/pedidos/${pedidoId}/dividir`, { items });
    guardar(respuesta.original);
    guardar(respuesta.nuevo);
    return respuesta;
  }

  // ───────────────────────────── Eventos en vivo ─────────────────────────────

  /**
   * Un pedido nuevo o con cambios (pedido:creado, pedido:actualizado, pedido:enviado_a_cocina).
   * Los eventos traen solo un resumen: el pedido completo se pide al API.
   * @param {{ id: string }} datos
   */
  async function alCambiarPedido({ id }) {
    if (estadoCarga.value === 'sin_cargar') return;
    try {
      await cargarDetalle(id);
    } catch {
      // Sin conexión: al reconectar se recargan todos los pedidos.
    }
  }

  /**
   * Un plato cambió de estado en la cocina (item:estado_cocina).
   * @param {{ pedidoId: string, itemId: string, estadoCocina: string }} datos
   */
  function alCambiarEstadoCocina({ pedidoId, itemId, estadoCocina }) {
    const item = porId.value[pedidoId]?.items?.find((/** @type {any} */ i) => i.id === itemId);
    if (item) item.estadoCocina = estadoCocina;
    else alCambiarPedido({ id: pedidoId });
  }

  /**
   * Un pedido se cobró o se anuló (pedido:pagado, pedido:anulado): deja de estar activo.
   * @param {{ id: string }} datos
   */
  function alCerrarPedido({ id }) {
    delete porId.value[id];
  }

  return {
    porId,
    lista,
    estadoCarga,
    errorCarga,
    pedidoDeMesa,
    platosListos,
    cargarActivos,
    cargarDetalle,
    crear,
    agregarItem,
    quitarItem,
    enviarACocina,
    cambiarEstadoCocina,
    cobrar,
    anular,
    dividir,
    alCambiarPedido,
    alCambiarEstadoCocina,
    alCerrarPedido,
  };
});
