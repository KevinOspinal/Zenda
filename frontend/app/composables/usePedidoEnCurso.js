// @ts-check
// Lógica de tomar un pedido: cargarlo, agregar y quitar productos y enviarlo a la cocina.
// La usa el componente TomarPedido; aquí no hay nada de pantalla.
//
// - Un pedido nuevo todavía no existe: se crea con el primer producto.
// - Las operaciones van en fila: así el primer producto crea el pedido y los siguientes se
//   agregan a ese mismo, aunque el mesero toque varios productos muy rápido.
// - El total siempre lo calcula el backend: se usa el pedido que responde el API.

/**
 * @param {object} opciones
 * @param {import('vue').Ref<string>} opciones.pedidoId Pedido abierto; vacío si es nuevo.
 * @param {import('vue').Ref<string>} opciones.mesaId Mesa del pedido nuevo; vacío si es de mostrador.
 * @param {(id: string) => void} opciones.alCrear Se creó el pedido nuevo con su primer producto.
 */
export function usePedidoEnCurso({ pedidoId, mesaId, alCrear }) {
  const pedidos = usePedidosStore();
  const mesas = useMesasStore();
  const caja = useCajaStore();
  const toast = useToast();

  if (mesas.estadoCarga === 'sin_cargar') mesas.cargar();

  // 1. El pedido: el del store mientras esté activo. Si se cobró o se anuló, se conserva el
  //    último que se trajo para decir qué pasó con él.
  const idCreado = ref('');
  const idActual = computed(() => pedidoId.value || idCreado.value);
  const pedido = computed(() => (idActual.value ? (pedidos.porId[idActual.value] ?? null) : null));
  const pedidoCerrado = ref(/** @type {any} */ (null));
  const cargando = ref(false);
  const errorDeCarga = ref('');

  async function cargarPedido() {
    if (!pedidoId.value) return;
    // Si el store ya lo tiene, se muestra de una vez y se actualiza en silencio.
    cargando.value = !pedido.value;
    errorDeCarga.value = '';
    try {
      const encontrado = await pedidos.cargarDetalle(pedidoId.value);
      pedidoCerrado.value = pedido.value ? null : encontrado;
    } catch (error) {
      errorDeCarga.value = error instanceof ErrorApi ? error.message : MENSAJE_ERROR_GENERICO;
    } finally {
      cargando.value = false;
    }
  }
  watch(pedidoId, cargarPedido, { immediate: true });

  // Pedido nuevo en una mesa que ya tiene uno abierto (por ejemplo, otro mesero lo abrió):
  // se abre ese en lugar de crear otro.
  watchEffect(() => {
    if (pedidoId.value || idCreado.value || !mesaId.value) return;
    const existente = pedidos.pedidoDeMesa(mesaId.value);
    if (existente) navigateTo(`/pedidos/${existente.id}`, { replace: true });
  });

  const mesa = computed(
    () => pedido.value?.mesa ?? mesas.lista.find((m) => m.id === mesaId.value) ?? null,
  );
  const titulo = computed(() => mesa.value?.nombre ?? 'Mostrador');
  const subtitulo = computed(() =>
    pedido.value
      ? `Abierto ${haceCuanto(pedido.value.abiertoEn)}`
      : 'Pedido nuevo: toca un producto para empezar',
  );
  /** A dónde vuelve el botón de atrás y a dónde se va al terminar: al mapa o a la caja. */
  const volverA = computed(() => (mesa.value || mesaId.value ? '/mesas' : '/caja'));

  // 2. Fila de operaciones.
  /** @type {Promise<unknown>} */
  let fila = Promise.resolve();
  const enCurso = ref(0);
  /**
   * @template T
   * @param {() => Promise<T>} operacion
   * @returns {Promise<T>}
   */
  function enFila(operacion) {
    enCurso.value += 1;
    const resultado = fila.then(operacion).finally(() => (enCurso.value -= 1));
    fila = resultado.catch(() => {});
    return resultado;
  }

  // 3. Cantidades de cada producto (las del pedido y las que van en camino al API), para
  //    que el contador de la tarjeta responda al instante.
  const enCamino = ref(/** @type {Record<string, number>} */ ({}));
  const cantidades = computed(() => {
    /** @type {Record<string, number>} */
    const resultado = {};
    for (const item of pedido.value?.items ?? []) {
      resultado[item.productoId] = (resultado[item.productoId] ?? 0) + Number(item.cantidad);
    }
    for (const [productoId, cantidad] of Object.entries(enCamino.value)) {
      resultado[productoId] = (resultado[productoId] ?? 0) + cantidad;
    }
    return resultado;
  });
  /**
   * @param {string} productoId
   * @param {number} cantidad
   */
  function sumarEnCamino(productoId, cantidad) {
    enCamino.value[productoId] = (enCamino.value[productoId] ?? 0) + cantidad;
  }

  /**
   * Muestra el error en un aviso y, si la situación cambió, pone los datos al día.
   * @param {unknown} error
   */
  function avisarError(error) {
    const mensaje = error instanceof ErrorApi ? error.message : MENSAJE_ERROR_GENERICO;
    toast.add({ title: mensaje, icon: 'i-lucide-circle-alert', color: 'error' });
    if (!(error instanceof ErrorApi)) return;
    if (error.codigo === 'CAJA_CERRADA') caja.alCerrarse();
    if (['PEDIDO_CERRADO', 'PEDIDO_ANULADO'].includes(error.codigo)) cargarPedido();
    if (error.codigo === 'MESA_OCUPADA') pedidos.cargarActivos();
  }

  // 4. Acciones.
  /**
   * Agrega un producto. Si el pedido aún no existe, lo crea con este primer producto.
   * @param {{ id: string, nombre: string }} producto
   * @param {{ cantidad?: number, notas?: string | null }} [opciones]
   */
  async function agregar(producto, { cantidad = 1, notas = '' } = {}) {
    sumarEnCamino(producto.id, cantidad);
    try {
      await enFila(async () => {
        const item = { productoId: producto.id, cantidad, ...(notas ? { notas } : {}) };
        if (idActual.value) {
          await pedidos.agregarItem(idActual.value, item);
          return;
        }
        const nuevo = await pedidos.crear({ mesaId: mesaId.value || undefined, items: [item] });
        idCreado.value = nuevo.id;
        alCrear(nuevo.id);
      });
    } catch (error) {
      avisarError(error);
    } finally {
      sumarEnCamino(producto.id, -cantidad);
    }
  }

  /**
   * Quita un producto de la cuenta, con la opción de deshacer.
   * @param {any} item
   */
  async function quitar(item) {
    try {
      await enFila(() => pedidos.quitarItem(idActual.value, item.id));
      toast.add({
        title: `Quitaste ${item.producto.nombre}`,
        icon: 'i-lucide-trash-2',
        color: 'neutral',
        actions: [
          {
            label: 'Deshacer',
            icon: 'i-lucide-undo-2',
            color: 'neutral',
            variant: 'outline',
            onClick: () =>
              agregar(
                { id: item.productoId, nombre: item.producto.nombre },
                { cantidad: Number(item.cantidad), notas: item.notas },
              ),
          },
        ],
      });
    } catch (error) {
      avisarError(error);
    }
  }

  const enviando = ref(false);
  /**
   * Envía el pedido a la cocina.
   * @returns {Promise<boolean>} true si se envió.
   */
  async function enviarACocina() {
    enviando.value = true;
    try {
      await enFila(() => pedidos.enviarACocina(idActual.value));
      toast.add({
        title: 'Enviado a cocina',
        description: titulo.value,
        icon: 'i-lucide-chef-hat',
        color: 'success',
      });
      return true;
    } catch (error) {
      avisarError(error);
      return false;
    } finally {
      enviando.value = false;
    }
  }

  return {
    pedido,
    pedidoCerrado,
    cargando,
    errorDeCarga,
    cargarPedido,
    titulo,
    subtitulo,
    volverA,
    cantidades,
    enCurso,
    enviando,
    items: computed(() => pedido.value?.items ?? []),
    total: computed(() => pedido.value?.total ?? '0'),
    estadoPedido: computed(() => pedido.value?.estado ?? 'nuevo'),
    agregar,
    quitar,
    enviarACocina,
  };
}
