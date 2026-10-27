// @ts-check
// Eventos en vivo del backend → stores. Es el único lugar donde se escuchan los eventos de
// pedidos, mesas y caja, para que cada uno se atienda una sola vez en toda la app.
// También avisa cuando un plato está listo (sonido, vibración y aviso): en mesa, al mesero
// del pedido; en mostrador y domicilio, a la caja, que es quien lo entrega. Y suena en la
// cocina cuando llega una comanda nueva.
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

  /**
   * Avisa que un plato está listo a quien lo entrega: en mesa, al mesero del pedido; en
   * mostrador y domicilio, a la caja (si está atendiendo la caja o el mostrador).
   * @param {{ pedidoId: string, mesa: { id: string, nombre: string } | null, producto: string }} datos
   */
  function avisarPlatoListo({ pedidoId, mesa, producto }) {
    if (mesa) mesas.resaltar(mesa.id);
    // También si el pedido ya se cobró: el cliente pudo pagar antes de que saliera el plato.
    const pedido = pedidos.buscar(pedidoId);
    // La cocina no se avisa a sí misma.
    if (!pedido || enLaCocina()) return;
    const tipo = tipoDelPedido(pedido);
    const leToca =
      tipo === 'mesa'
        ? pedido.meseroId === sesion.usuario?.id
        : puede(sesion.rol, 'cobrar') && enLaCaja();
    if (!leToca) return;

    sonidos.platoListo();
    if (preferencias.vibracion) navigator.vibrate?.([40, 60, 40]);
    toast.add({
      title: TITULO_LISTO[tipo],
      description: `${nombreDelPedido(pedido)} · ${producto}`,
      icon: 'i-lucide-bell-ring',
      color: 'info',
      actions: [
        tipo === 'mesa'
          ? { label: 'Ver avisos', to: '/avisos', color: 'info', variant: 'outline' }
          : { label: 'Ir a la caja', to: '/caja', color: 'info', variant: 'outline' },
      ],
    });
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
    if (datos.estadoCocina === 'listo') avisarPlatoListo(datos);
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
