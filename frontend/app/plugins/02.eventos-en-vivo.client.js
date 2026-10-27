// @ts-check
// Eventos en vivo del backend → stores. Es el único lugar donde se escuchan los eventos de
// pedidos, mesas y caja, para que cada uno se atienda una sola vez en toda la app.
// También avisa al mesero (sonido, vibración y aviso) cuando un plato suyo está listo, y
// suena en la cocina cuando llega una comanda nueva.
export default defineNuxtPlugin(() => {
  const socket = useTiempoReal();
  const sesion = useSesionStore();
  const mesas = useMesasStore();
  const pedidos = usePedidosStore();
  const caja = useCajaStore();
  const preferencias = usePreferenciasStore();
  const sonidos = useSonidos();
  const toast = useToast();
  const router = useRouter();

  prepararAudioAlPrimerToque();

  /** Este dispositivo está mostrando la pantalla de la cocina. */
  const enLaCocina = () => router.currentRoute.value.path === '/cocina';

  /**
   * Avisa al mesero que un plato de su pedido está listo para llevar.
   * @param {{ pedidoId: string, mesa: { id: string, nombre: string } | null, producto: string }} datos
   */
  function avisarPlatoListo({ pedidoId, mesa, producto }) {
    if (mesa) mesas.resaltar(mesa.id);
    const pedido = pedidos.porId[pedidoId];
    // Solo al mesero del pedido; la cocina no se avisa a sí misma.
    if (!pedido || pedido.meseroId !== sesion.usuario?.id || enLaCocina()) return;

    sonidos.platoListo();
    if (preferencias.vibracion) navigator.vibrate?.([40, 60, 40]);
    toast.add({
      title: '¡Listo para llevar!',
      description: `${mesa?.nombre ?? 'Mostrador'} · ${producto}`,
      icon: 'i-lucide-bell-ring',
      color: 'info',
      actions: [{ label: 'Ver avisos', to: '/avisos', color: 'info', variant: 'outline' }],
    });
  }

  const E = EVENTOS_EN_VIVO;

  socket.on(E.MESA_ESTADO, (datos) => mesas.alCambiarEstado(datos));
  socket.on(E.CAJA_ABIERTA, () => caja.alAbrirse());
  socket.on(E.CAJA_CERRADA, () => caja.alCerrarse());

  socket.on(E.PEDIDO_CREADO, (datos) => pedidos.alCambiarPedido(datos));
  socket.on(E.PEDIDO_ACTUALIZADO, (datos) => {
    pedidos.alCambiarPedido(datos);
    if (datos.mesa) mesas.resaltar(datos.mesa.id);
  });
  socket.on(E.PEDIDO_ENVIADO_A_COCINA, (datos) => {
    pedidos.alCambiarPedido(datos);
    if (enLaCocina()) sonidos.comandaNueva();
  });
  socket.on(E.ITEM_ESTADO_COCINA, (datos) => {
    pedidos.alCambiarEstadoCocina(datos);
    if (datos.estadoCocina === 'listo') avisarPlatoListo(datos);
  });
  socket.on(E.PEDIDO_PAGADO, (datos) => pedidos.alCerrarPedido(datos));
  socket.on(E.PEDIDO_ANULADO, (datos) => pedidos.alCerrarPedido(datos));

  // Al conectar (y al reconectar) se recarga lo necesario: mientras estuvo desconectado se
  // pudieron perder eventos. Los pedidos y la caja se cargan siempre, para que los avisos
  // del mesero funcionen desde que entra; las mesas, solo si alguna pantalla ya las usó.
  socket.on('connect', () => {
    if (!sesion.activa) return;
    pedidos.cargarActivos();
    caja.cargarEstado();
    if (mesas.estadoCarga === 'listo') mesas.cargar();
  });
});
