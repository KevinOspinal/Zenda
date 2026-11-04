// @ts-check
// Imprimir la precuenta de un pedido abierto: la cuenta que se lleva a la mesa antes de cobrar,
// con la propina sugerida y cómo pagar por Bre-B (ver useImpresion).
//
// Antes de imprimir se piden de nuevo el pedido y el negocio: la precuenta lleva lo último que
// se pidió y la llave Bre-B vigente. Los valores son los del API; aquí no se calcula nada.

export function useImpresionDePrecuenta() {
  const { imprimir } = useImpresion();
  const pedidos = usePedidosStore();
  const negocioStore = useNegocioStore();
  const toast = useToast();

  /** Se están trayendo los datos para imprimir (para el estado de carga del botón). */
  const preparando = ref(false);

  /** @param {string} pedidoId */
  async function imprimirPrecuenta(pedidoId) {
    preparando.value = true;
    try {
      const [pedido, negocio] = await Promise.all([
        pedidos.cargarDetalle(pedidoId),
        negocioStore.cargar({ forzar: true }),
      ]);
      await imprimir({ tipo: 'precuenta', pedido, negocio, fecha: new Date().toISOString() });
    } catch (fallo) {
      toast.add({
        title: 'No pudimos preparar la precuenta',
        description: fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO,
        icon: 'i-lucide-circle-alert',
        color: 'error',
      });
    } finally {
      preparando.value = false;
    }
  }

  return { preparando, imprimirPrecuenta };
}
