// @ts-check
// Qué pasa con un pedido cobrado que no ha ido a la cocina:
// - "Enviar a cocina": la cocina lo prepara aunque ya esté pagado. Si es de mesa, la mesa
//   sigue ocupada hasta que se entreguen sus platos.
// - "No va a cocina": no hay nada que preparar (por ejemplo, unas gaseosas). Se entrega de una
//   vez y, si es de mesa, la mesa queda libre.
// Lo usan la ventana de cobro (al registrar el cobro) y la vista de un pedido ya cobrado.

/** @typedef {'cocina' | 'sin_cocina'} DecisionDeCocina */

export function useDecisionDeCocina() {
  const pedidos = usePedidosStore();
  const toast = useToast();

  /** La decisión que se está guardando; vacío si ninguna. */
  const decidiendo = ref(/** @type {'' | DecisionDeCocina} */ (''));

  /**
   * Guarda la decisión y la confirma con un aviso; si el API la rechaza, dice por qué.
   * @param {any} pedido Pedido cobrado (forma del API).
   * @param {DecisionDeCocina} decision
   * @returns {Promise<boolean>} Si se guardó.
   */
  async function decidir(pedido, decision) {
    decidiendo.value = decision;
    try {
      if (decision === 'cocina') {
        await pedidos.enviarACocina(pedido.id);
        toast.add({
          title: `${nombreDelPedido(pedido)} enviado a la cocina`,
          icon: 'i-lucide-chef-hat',
          color: 'success',
        });
      } else {
        await pedidos.entregarSinCocina(pedido.id);
        toast.add({
          title: 'Entregado sin pasar por la cocina',
          description: nombreDelPedido(pedido),
          icon: 'i-lucide-check',
          color: 'success',
        });
      }
      return true;
    } catch (error) {
      toast.add({
        title: error instanceof ErrorApi ? error.message : MENSAJE_ERROR_GENERICO,
        icon: 'i-lucide-circle-alert',
        color: 'error',
      });
      return false;
    } finally {
      decidiendo.value = '';
    }
  }

  return { decidiendo, decidir };
}
