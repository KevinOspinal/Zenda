// @ts-check
// Eventos en vivo del backend → stores. Es el único lugar donde se escuchan los eventos de
// pedidos, mesas y caja, para que cada uno se atienda una sola vez en toda la app.
// También avisa cuando hay platos listos (sonido, vibración y aviso): en mesa, al mesero
// del pedido; en mostrador y domicilio, a la caja, que es quien los entrega. Los avisos no
// saturan: uno por mesa, que se actualiza, y el sonido como máximo una vez cada pocos
// segundos (utils/avisos.js). Y suena en la cocina cuando llega una comanda nueva.
export default defineNuxtPlugin(() => {
  const socket = useTiempoReal();
  const sesion = useSesionStore();
  const mesas = useMesasStore();
  const pedidos = usePedidosStore();
  const caja = useCajaStore();
  const domicilios = useDomiciliosStore();
  const preferencias = usePreferenciasStore();
  const sonidos = useSonidos();
  const toast = useToast();
  const router = useRouter();

  prepararAudioAlPrimerToque();

  /** Este dispositivo está mostrando la pantalla de la cocina. */
  const enLaCocina = () => router.currentRoute.value.path === '/cocina';
  /** Este dispositivo está atendiendo la caja o el mostrador. */
  const enLaCaja = () =>
    ['/caja', '/mostrador'].some((ruta) => router.currentRoute.value.path.startsWith(ruta));

  /** Título del aviso de un plato listo, según quién lo entrega. */
  const TITULO_LISTO = Object.freeze({
    mesa: '¡Listo para llevar!',
    mostrador: '¡Listo para entregar!',
    domicilio: '¡Listo para salir!',
  });

  const agrupador = crearAgrupadorDeAvisos();

  /**
   * Avisa que hay platos listos a quien los entrega: en mesa, al mesero del pedido; en
   * mostrador y domicilio, a la caja (si está atendiendo la caja o el mostrador).
   * Un solo aviso por pedido: si ya está en pantalla, se actualiza en lugar de sumar otro.
   * @param {{ pedidoId: string, mesa: { id: string, nombre: string } | null,
   *   productos: string[] }} datos
   */
  function avisarPlatosListos({ pedidoId, mesa, productos }) {
    if (mesa) mesas.resaltar(mesa.id);
    // También si el pedido ya se cobró: el cliente pudo pagar antes de que saliera el plato.
    const pedido = pedidos.buscar(pedidoId);
    // La cocina no se avisa a sí misma.
    if (!pedido || enLaCocina() || !productos.length) return;
    const tipo = tipoDelPedido(pedido);
    const leToca =
      tipo === 'mesa'
        ? pedido.meseroId === sesion.usuario?.id
        : puede(sesion.rol, 'cobrar') && enLaCaja();
    if (!leToca) return;

    const { cantidad, sonar } = agrupador.registrar(pedidoId, productos.length);
    if (sonar) {
      sonidos.platoListo();
      if (preferencias.vibracion) navigator.vibrate?.([40, 60, 40]);
    }
    toast.add({
      id: `listo-${pedidoId}`,
      title: TITULO_LISTO[tipo],
      description: textoDeAvisoListo(nombreDelPedido(pedido), cantidad, productos.at(-1) ?? ''),
      icon: 'i-lucide-bell-ring',
      color: 'info',
      duration: VENTANA_AVISO_MS,
      actions: [
        tipo === 'mesa'
          ? { label: 'Ver avisos', to: '/avisos', color: 'info', variant: 'outline' }
          : { label: 'Ir a la caja', to: '/caja', color: 'info', variant: 'outline' },
      ],
    });
  }

  /**
   * Si a un pedido ya no le quedan platos listos (se entregaron), su aviso sobra.
   * @param {string} pedidoId
   */
  function quitarAvisoSiYaSeEntrego(pedidoId) {
    const pedido = pedidos.buscar(pedidoId);
    if (pedido?.items?.some((/** @type {any} */ item) => item.estadoCocina === 'listo')) return;
    agrupador.olvidar(pedidoId);
    toast.remove(`listo-${pedidoId}`);
  }

  /**
   * Un pedido cambió: se actualizan los pedidos activos y, si es domicilio, la lista de la caja.
   * @param {{ id: string, tipo?: string }} datos
   */
  function alCambiarPedido(datos) {
    pedidos.alCambiarPedido(datos);
    if (datos.tipo === 'domicilio') domicilios.alCambiarPedido(datos);
  }

  const E = EVENTOS_EN_VIVO;

  socket.on(E.MESA_ESTADO, (datos) => mesas.alCambiarEstado(datos));
  socket.on(E.CAJA_ABIERTA, () => caja.alAbrirse());
  socket.on(E.CAJA_CERRADA, () => caja.alCerrarse());

  socket.on(E.PEDIDO_CREADO, alCambiarPedido);
  socket.on(E.PEDIDO_ACTUALIZADO, (datos) => {
    alCambiarPedido(datos);
    if (datos.mesa) mesas.resaltar(datos.mesa.id);
  });
  socket.on(E.PEDIDO_ENVIADO_A_COCINA, (datos) => {
    alCambiarPedido(datos);
    if (enLaCocina()) sonidos.comandaNueva();
  });
  socket.on(E.ITEM_ESTADO_COCINA, (datos) => {
    pedidos.alCambiarEstadoCocina(datos);
    domicilios.alCambiarEstadoCocina(datos);
    if (datos.estadoCocina === 'listo') {
      avisarPlatosListos({ ...datos, productos: [datos.producto] });
    }
    if (datos.estadoCocina === 'entregado') quitarAvisoSiYaSeEntrego(datos.pedidoId);
  });
  socket.on(E.PEDIDO_ESTADO_COCINA, (datos) => {
    pedidos.alCambiarEstadoCocinaDelPedido(datos);
    domicilios.alCambiarEstadoCocinaDelPedido(datos);
    if (datos.estadoCocina === 'listo') {
      avisarPlatosListos({
        pedidoId: datos.pedidoId,
        mesa: datos.mesa,
        productos: datos.items.map((/** @type {any} */ item) => item.producto),
      });
    }
    if (datos.estadoCocina === 'entregado') quitarAvisoSiYaSeEntrego(datos.pedidoId);
  });
  socket.on(E.PEDIDO_PAGADO, (datos) => {
    pedidos.alCerrarPedido(datos);
    caja.alCambiarVentas();
    if (datos.tipo === 'domicilio') domicilios.alCambiarPedido(datos);
  });
  socket.on(E.PEDIDO_ANULADO, (datos) => {
    pedidos.alCerrarPedido(datos);
    caja.alCambiarVentas();
    if (datos.tipo === 'domicilio') domicilios.alCambiarPedido(datos);
  });

  // Al conectar (y al reconectar) se recarga lo necesario: mientras estuvo desconectado se
  // pudieron perder eventos. Los pedidos y la caja se cargan siempre, para que los avisos
  // del mesero funcionen desde que entra; las mesas, solo si alguna pantalla ya las usó.
  socket.on('connect', () => {
    if (!sesion.activa) return;
    pedidos.cargarActivos();
    caja.cargarEstado();
    if (mesas.estadoCarga === 'listo') mesas.cargar();
    if (domicilios.estadoCarga === 'listo') domicilios.cargar();
  });
});
