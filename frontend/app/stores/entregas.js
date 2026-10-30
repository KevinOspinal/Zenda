// @ts-check
// Las entregas del domiciliario: los domicilios que lleva él, en camino o por liquidar
// (contra entrega, entregados, con el dinero aún sin llevar a la caja). El API solo le da los
// suyos y los eventos en vivo los mantienen al día (ver plugins/02.eventos-en-vivo.client.js).
//
// "Entregado" tiene unos segundos para deshacerse: la entrega se oculta enseguida, pero solo
// llega al API si no se deshace (ver pages/entregas.vue).

export const useEntregasStore = defineStore('entregas', () => {
  /** Entregas en curso del domiciliario, por id. */
  const porId = ref(/** @type {Record<string, any>} */ ({}));
  /** sin_cargar · cargando · listo · error */
  const estadoCarga = ref('sin_cargar');
  /** Ids tocados como entregados que esperan confirmarse (se pueden deshacer). */
  const confirmando = ref(/** @type {Record<string, true>} */ ({}));
  /** La última entrega que le asignaron, para avisarle (sonido, vibración y resalte). */
  const ultimaAsignada = ref(/** @type {{ id: string, en: number } | null} */ (null));

  /** En camino: la que salió primero va primero (es la que debe entregar ya). */
  const enCamino = computed(() =>
    Object.values(porId.value)
      .filter(
        (pedido) => etapaDelDomicilio(pedido) === 'en_camino' && !confirmando.value[pedido.id],
      )
      .sort((a, b) => String(a.entrega.despachadoEn).localeCompare(b.entrega.despachadoEn)),
  );

  /** Entregadas contra entrega cuyo dinero debe llevar a la caja. */
  const porLiquidar = computed(() =>
    Object.values(porId.value)
      .filter((pedido) => etapaDelDomicilio(pedido) === 'por_liquidar')
      .sort((a, b) => String(a.entrega.entregadoEn).localeCompare(b.entrega.entregadoEn)),
  );

  /** Lo que debe entregar en la caja. */
  const totalPorLiquidar = computed(() => sumar(porLiquidar.value.map((pedido) => pedido.total)));

  /**
   * Guarda una entrega que respondió el API: si terminó o se anuló, sale; si es nueva y va en
   * camino, queda como la última asignada.
   * @param {any} pedido
   */
  function guardar(pedido) {
    if (!estaEnCurso(pedido)) {
      delete porId.value[pedido.id];
      return;
    }
    const esNueva = !porId.value[pedido.id] && etapaDelDomicilio(pedido) === 'en_camino';
    porId.value[pedido.id] = pedido;
    if (esNueva && estadoCarga.value === 'listo') {
      ultimaAsignada.value = { id: pedido.id, en: Date.now() };
    }
  }

  /** Trae las entregas en curso del domiciliario. */
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

  /**
   * Oculta una entrega mientras se confirma (o se deshace).
   * @param {string} id
   */
  function ocultar(id) {
    confirmando.value[id] = true;
  }

  /**
   * Deshace un "Entregado" que aún no se confirmaba: la entrega vuelve a la lista.
   * @param {string} id
   */
  function mostrar(id) {
    delete confirmando.value[id];
  }

  /**
   * Confirma en el API que el cliente recibió el domicilio. Si es contra entrega, queda por
   * liquidar; si ya estaba pagado, sale de la lista.
   * @param {string} id
   */
  async function entregar(id) {
    try {
      guardar(await useApi().post(`/pedidos/${id}/entregar`));
    } finally {
      delete confirmando.value[id];
    }
  }

  /**
   * Un domicilio cambió (lo despacharon, lo liquidaron, lo anularon...). Si es de otro
   * domiciliario, el API responde que no existe y se ignora.
   * @param {{ id: string }} datos
   */
  async function alCambiarPedido({ id }) {
    if (estadoCarga.value !== 'listo') return;
    try {
      guardar(await useApi().get(`/pedidos/${id}`));
    } catch (fallo) {
      // Ya no es suyo (o nunca lo fue): sale de la lista. Sin conexión, se recarga al volver.
      if (fallo instanceof ErrorApi && fallo.status === 404) delete porId.value[id];
    }
  }

  return {
    porId,
    estadoCarga,
    confirmando,
    ultimaAsignada,
    enCamino,
    porLiquidar,
    totalPorLiquidar,
    cargar,
    ocultar,
    mostrar,
    entregar,
    alCambiarPedido,
  };
});
