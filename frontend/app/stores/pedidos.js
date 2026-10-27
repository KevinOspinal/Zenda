// @ts-check
// Pedidos activos (sin cobrar ni anular) con sus ítems. Los usan el mapa de mesas, la toma
// de pedidos, los avisos del mesero y la cocina.
//
// Aparte se guardan los pedidos ya cobrados que tienen platos en la cocina (el cliente pagó
// antes de que salieran): la cocina los sigue viendo y el mesero recibe sus avisos, pero no
// cuentan como activos (no están por cobrar ni ocupan la mesa).
//
// - Los datos vienen del API (GET /pedidos?activos=true y ?cocina=true, con sus ítems).
// - Cada acción guarda el pedido completo que responde el API: los totales e impuestos los
//   calcula siempre el backend.
// - Los eventos en vivo los mantienen al día (ver plugins/02.eventos-en-vivo.client.js).

/** Estados de un pedido que todavía se puede modificar o cobrar. */
const ESTADOS_ACTIVOS = Object.freeze(['abierto', 'enviado_a_cocina']);

/**
 * Un pedido cobrado que pasó por la cocina y aún tiene platos por entregar.
 * @param {any} pedido
 */
function esCobradoEnCocina(pedido) {
  return (
    pedido.estado === 'pagado' &&
    Boolean(pedido.enviadoACocinaEn) &&
    (pedido.items ?? []).some((/** @type {any} */ item) => item.estadoCocina !== 'entregado')
  );
}

/**
 * @typedef {{ productoId: string, cantidad: string | number, notas?: string | null }} NuevoItem
 */

export const usePedidosStore = defineStore('pedidos', () => {
  /** Pedidos activos por id. */
  const porId = ref(/** @type {Record<string, any>} */ ({}));
  /** Pedidos cobrados con platos en la cocina, por id. */
  const cobradosEnCocina = ref(/** @type {Record<string, any>} */ ({}));
  /** sin_cargar · cargando · listo · error */
  const estadoCarga = ref('sin_cargar');
  const errorCarga = ref('');

  /** Pedidos activos, del más antiguo al más reciente. */
  const lista = computed(() =>
    Object.values(porId.value).sort((a, b) => String(a.abiertoEn).localeCompare(b.abiertoEn)),
  );

  /** Lo que ve la cocina: los activos y los cobrados que aún tienen platos por entregar. */
  const comandas = computed(() => [...lista.value, ...Object.values(cobradosEnCocina.value)]);

  /**
   * Un pedido activo o cobrado con platos en la cocina. Null si no está.
   * @param {string} id
   */
  function buscar(id) {
    return porId.value[id] ?? cobradosEnCocina.value[id] ?? null;
  }

  /** @param {string} mesaId */
  function pedidoDeMesa(mesaId) {
    return lista.value.find((pedido) => pedido.mesaId === mesaId) ?? null;
  }

  /**
   * Pedidos de mesa con platos listos para llevar, cada uno con esos platos. Si se indica un
   * mesero, solo los de sus pedidos. Los avisos se agrupan así: uno por mesa, no por plato.
   * Solo los de mesa: los de mostrador y los domicilios los entrega la caja.
   * @param {string} [meseroId]
   * @returns {{ pedido: any, items: any[] }[]}
   */
  function pedidosConPlatosListos(meseroId) {
    return comandas.value
      .filter((pedido) => tipoDelPedido(pedido) === 'mesa')
      .filter((pedido) => !meseroId || pedido.meseroId === meseroId)
      .map((pedido) => ({
        pedido,
        items: (pedido.items ?? []).filter(
          (/** @type {any} */ item) => item.estadoCocina === 'listo',
        ),
      }))
      .filter(({ items }) => items.length > 0);
  }

  /**
   * Guarda un pedido que entregó el API donde corresponde: entre los activos, entre los
   * cobrados que siguen en la cocina, o en ninguna parte (se anuló o ya salió todo).
   * @param {any} pedido
   */
  function guardar(pedido) {
    delete porId.value[pedido.id];
    delete cobradosEnCocina.value[pedido.id];
    if (ESTADOS_ACTIVOS.includes(pedido.estado)) porId.value[pedido.id] = pedido;
    else if (esCobradoEnCocina(pedido)) cobradosEnCocina.value[pedido.id] = pedido;
  }

  // ───────────────────────────── Cargar ─────────────────────────────

  /** Trae los pedidos activos y las comandas de la cocina, con sus ítems. */
  async function cargarActivos() {
    if (estadoCarga.value !== 'listo') estadoCarga.value = 'cargando';
    try {
      const api = useApi();
      const [activos, deLaCocina] = await Promise.all([
        api.get('/pedidos', { activos: true, incluirItems: true }),
        api.get('/pedidos', { cocina: true, incluirItems: true }),
      ]);
      porId.value = Object.fromEntries(activos.map((/** @type {any} */ p) => [p.id, p]));
      // Las comandas sin cobrar ya vienen entre los activos; aquí solo las cobradas.
      cobradosEnCocina.value = Object.fromEntries(
        deLaCocina
          .filter((/** @type {any} */ p) => p.estado === 'pagado')
          .map((/** @type {any} */ p) => [p.id, p]),
      );
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
   * Crea un pedido con sus primeros productos. Sin mesa es una venta de mostrador; un
   * domicilio trae además su tipo y sus datos de entrega (ver stores/domicilios.js).
   * El uuidOffline evita duplicarlo si la petición se repite.
   * @param {{ mesaId?: string, items: NuevoItem[], [campo: string]: unknown }} datos
   */
  async function crear({ mesaId, items, ...otrosDatos }) {
    const pedido = await useApi().post('/pedidos', {
      mesaId,
      items,
      uuidOffline: generarUuid(),
      ...otrosDatos,
    });
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
    const item = buscar(pedidoId)?.items?.find((/** @type {any} */ i) => i.id === itemId);
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
   * Avanza todos los platos de un pedido a la vez: "listo" (lo pendiente y lo que se prepara)
   * o "entregado" (lo que está listo). Se ve al instante; si el API lo rechaza, vuelve a como
   * estaba y lanza el error.
   * @param {string} pedidoId
   * @param {'listo' | 'entregado'} estadoCocina
   */
  async function cambiarEstadoCocinaDelPedido(pedidoId, estadoCocina) {
    const avanzan = estadoCocina === 'listo' ? ['pendiente', 'preparando'] : ['listo'];
    const cambiados = (buscar(pedidoId)?.items ?? []).filter((/** @type {any} */ item) =>
      avanzan.includes(item.estadoCocina),
    );
    const anteriores = cambiados.map((/** @type {any} */ item) => item.estadoCocina);
    for (const item of cambiados) item.estadoCocina = estadoCocina;
    try {
      const pedido = await useApi().patch(`/pedidos/${pedidoId}/cocina`, { estadoCocina });
      guardar(pedido);
      return pedido;
    } catch (error) {
      cambiados.forEach((/** @type {any} */ item, i) => (item.estadoCocina = anteriores[i]));
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
    const pedido = buscar(pedidoId);
    const item = pedido?.items?.find((/** @type {any} */ i) => i.id === itemId);
    if (!item) {
      alCambiarPedido({ id: pedidoId });
      return;
    }
    item.estadoCocina = estadoCocina;
    // Un pedido cobrado sale de la cocina cuando se entrega su último plato.
    guardar(pedido);
  }

  /**
   * Varios platos de un pedido cambiaron a la vez (pedido:estado_cocina).
   * @param {{ pedidoId: string, estadoCocina: string, items: { id: string }[] }} datos
   */
  function alCambiarEstadoCocinaDelPedido({ pedidoId, estadoCocina, items }) {
    const pedido = buscar(pedidoId);
    const ids = new Set(items.map((item) => item.id));
    const locales = (pedido?.items ?? []).filter((/** @type {any} */ item) => ids.has(item.id));
    // Si no se tienen todos esos platos, se trae el pedido completo.
    if (!pedido || locales.length < ids.size) {
      alCambiarPedido({ id: pedidoId });
      return;
    }
    for (const item of locales) item.estadoCocina = estadoCocina;
    // Un pedido cobrado sale de la cocina cuando se entrega su último plato.
    guardar(pedido);
  }

  /**
   * Un pedido se cobró o se anuló (pedido:pagado, pedido:anulado): deja de estar activo.
   * Si se cobró con platos en la cocina, la cocina lo sigue viendo hasta que salgan.
   * @param {{ id: string, estado?: string }} datos
   */
  function alCerrarPedido({ id, estado = 'anulado' }) {
    const pedido = buscar(id);
    if (pedido) guardar({ ...pedido, estado });
  }

  return {
    porId,
    lista,
    comandas,
    buscar,
    estadoCarga,
    errorCarga,
    pedidoDeMesa,
    pedidosConPlatosListos,
    cargarActivos,
    cargarDetalle,
    crear,
    agregarItem,
    quitarItem,
    enviarACocina,
    cambiarEstadoCocina,
    cambiarEstadoCocinaDelPedido,
    cobrar,
    anular,
    dividir,
    alCambiarPedido,
    alCambiarEstadoCocina,
    alCambiarEstadoCocinaDelPedido,
    alCerrarPedido,
  };
});
