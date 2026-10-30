// @ts-check
// Domicilios en curso y los domiciliarios del negocio. Los usa la caja: los datos de entrega
// son personales (Ley 1581) y el API solo se los da a la caja (y a cada domiciliario, los
// suyos: ver stores/entregas.js).
//
// - En curso: sin entregar, o contra entrega entregados y sin cobrar ("por liquidar").
// - Vienen de GET /pedidos?domicilios=true, con sus ítems y su entrega.
// - Los eventos en vivo los mantienen al día (ver plugins/02.eventos-en-vivo.client.js).

export const useDomiciliosStore = defineStore('domicilios', () => {
  /** Domicilios en curso, por id. */
  const porId = ref(/** @type {Record<string, any>} */ ({}));
  /** sin_cargar · cargando · listo · error */
  const estadoCarga = ref('sin_cargar');
  /** Domiciliarios activos, para elegir quién lleva cada domicilio. */
  const domiciliarios = ref(/** @type {any[]} */ ([]));

  /** Del más antiguo al más reciente: el que más lleva esperando va primero. */
  const lista = computed(() =>
    Object.values(porId.value).sort((a, b) => String(a.abiertoEn).localeCompare(b.abiertoEn)),
  );

  /** Lo que cada domiciliario debe traer a la caja (contra entrega, entregado y sin cobrar). */
  const porLiquidar = computed(() => porLiquidarPorDomiciliario(lista.value));

  /**
   * Guarda un domicilio que entregó el API; si terminó o se anuló, sale de la lista.
   * @param {any} pedido
   */
  function guardar(pedido) {
    if (estaEnCurso(pedido)) porId.value[pedido.id] = pedido;
    else delete porId.value[pedido.id];
  }

  /** Trae los domicilios en curso. */
  async function cargar() {
    if (estadoCarga.value !== 'listo') estadoCarga.value = 'cargando';
    try {
      const pedidos = await useApi().get('/pedidos', { domicilios: true });
      porId.value = Object.fromEntries(pedidos.map((/** @type {any} */ p) => [p.id, p]));
      estadoCarga.value = 'listo';
    } catch {
      if (estadoCarga.value !== 'listo') estadoCarga.value = 'error';
    }
  }

  /** Trae los domiciliarios activos. */
  async function cargarDomiciliarios() {
    domiciliarios.value = await useApi().get('/domiciliarios', { activos: true });
  }

  /**
   * Registra un domicilio, todavía sin productos: se agregan al tomar el pedido.
   * @param {{ nombreCliente: string, origen: string, valorDomicilio?: string,
   *   entrega: { telefono: string, direccion: string, indicaciones?: string, pagaCon?: string } }} datos
   */
  async function crear(datos) {
    const pedido = await usePedidosStore().crear({ tipo: 'domicilio', items: [], ...datos });
    guardar(pedido);
    return pedido;
  }

  /**
   * Corrige los datos de un domicilio (dirección, con cuánto paga, valor del domicilio...).
   * @param {string} id
   * @param {Record<string, unknown>} cambios
   */
  async function actualizar(id, cambios) {
    const pedido = await useApi().patch(`/pedidos/${id}/domicilio`, cambios);
    guardar(pedido);
    return pedido;
  }

  /**
   * Manda el domicilio a la cocina. También si ya se cobró (por ejemplo, pagado por
   * transferencia antes de mandarlo): sigue cobrado y la cocina lo ve igual.
   * @param {string} id
   */
  async function enviarACocina(id) {
    const pedido = await usePedidosStore().enviarACocina(id);
    guardar(pedido);
    return pedido;
  }

  /**
   * El domicilio sale con un domiciliario.
   * @param {string} id
   * @param {string} domiciliarioId
   */
  async function despachar(id, domiciliarioId) {
    const pedido = await useApi().post(`/pedidos/${id}/despachar`, { domiciliarioId });
    guardar(pedido);
    return pedido;
  }

  /**
   * El cliente recibió el domicilio. Si ya está pagado, sale de la lista; si es contra entrega
   * y no se ha cobrado, queda por liquidar.
   * @param {string} id
   */
  async function entregar(id) {
    const pedido = await useApi().post(`/pedidos/${id}/entregar`);
    guardar(pedido);
    return pedido;
  }

  /**
   * La caja recibe el dinero que trae un domiciliario: cada domicilio queda cobrado con el
   * método con que pagó el cliente, y sale de la lista.
   * @param {string} domiciliarioId
   * @param {{ pedidoId: string, metodo: string, referencia?: string }[]} pedidos
   * @returns {Promise<{ pedidos: any[], total: string }>}
   */
  async function liquidar(domiciliarioId, pedidos) {
    const resultado = await useApi().post(`/domiciliarios/${domiciliarioId}/liquidar`, {
      pedidos,
    });
    for (const pedido of resultado.pedidos) guardar(pedido);
    return resultado;
  }

  // ───────────────────────────── Eventos en vivo ─────────────────────────────

  /**
   * Un domicilio cambió en otro dispositivo (creado, actualizado, cobrado o anulado).
   * Los eventos traen solo un resumen: el domicilio completo se pide al API.
   * @param {{ id: string }} datos
   */
  async function alCambiarPedido({ id }) {
    if (estadoCarga.value !== 'listo') return;
    try {
      guardar(await useApi().get(`/pedidos/${id}`));
    } catch {
      // Sin conexión: al reconectar se recarga la lista.
    }
  }

  /**
   * Un plato de un domicilio cambió en la cocina (item:estado_cocina).
   * @param {{ pedidoId: string, itemId: string, estadoCocina: string }} datos
   */
  function alCambiarEstadoCocina({ pedidoId, itemId, estadoCocina }) {
    const item = porId.value[pedidoId]?.items?.find((/** @type {any} */ i) => i.id === itemId);
    if (item) item.estadoCocina = estadoCocina;
  }

  /**
   * Varios platos de un domicilio cambiaron a la vez (pedido:estado_cocina).
   * @param {{ pedidoId: string, estadoCocina: string, items: { id: string }[] }} datos
   */
  function alCambiarEstadoCocinaDelPedido({ pedidoId, estadoCocina, items }) {
    const ids = new Set(items.map((item) => item.id));
    for (const item of porId.value[pedidoId]?.items ?? []) {
      if (ids.has(item.id)) item.estadoCocina = estadoCocina;
    }
  }

  return {
    porId,
    lista,
    porLiquidar,
    estadoCarga,
    domiciliarios,
    cargar,
    cargarDomiciliarios,
    crear,
    actualizar,
    enviarACocina,
    despachar,
    entregar,
    liquidar,
    alCambiarPedido,
    alCambiarEstadoCocina,
    alCambiarEstadoCocinaDelPedido,
  };
});
