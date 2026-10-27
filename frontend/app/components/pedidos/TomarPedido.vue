<!--
  Tomar un pedido: el menú para agregar productos y la cuenta para revisarla y enviarla a
  la cocina. Sirve para un pedido nuevo (se crea con el primer producto) y para uno abierto.
  - Celular: el menú ocupa la pantalla y la cuenta se abre desde una barra fija abajo.
  - Tablet horizontal y PC: el menú a la izquierda y la cuenta fija a la derecha.
  La lógica está en usePedidoEnCurso; aquí solo la pantalla.
-->
<script setup>
const props = defineProps({
  /** Pedido abierto. Vacío si es un pedido nuevo. */
  pedidoId: { type: String, default: '' },
  /** Mesa del pedido nuevo. Vacío si es una venta de mostrador. */
  mesaId: { type: String, default: '' },
});

const emit = defineEmits({
  /** Se creó el pedido nuevo con su primer producto. @param {string} _id */
  creado: (_id) => true,
  /** Se cobró el pedido y se cerró el resumen del cobro. @param {string} _volverA */
  cobrado: (_volverA) => true,
});

const sesion = useSesionStore();
const pedidos = usePedidosStore();
const toast = useToast();
const puedeCobrar = computed(() => puede(sesion.rol, 'cobrar'));

const {
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
  items,
  total,
  estadoPedido,
  agregar,
  quitar,
  enviarACocina,
} = usePedidoEnCurso({
  pedidoId: toRef(props, 'pedidoId'),
  mesaId: toRef(props, 'mesaId'),
  alCrear: (id) => emit('creado', id),
});

const cuentaAbierta = ref(false);
async function enviar() {
  if (!(await enviarACocina())) return;
  cuentaAbierta.value = false;
  await navigateTo(volverA.value);
}

// Cobrar desde la cuenta. Al cerrar el resumen del cobro (con el cambio), se avisa a la
// página: el mostrador empieza una venta nueva; en una mesa se vuelve al mapa.
const cobrando = ref(false);
const cobrado = ref(false);
function abrirCobro() {
  cuentaAbierta.value = false;
  cobrando.value = true;
}
watch(cobrando, (abierto) => {
  if (abierto || !cobrado.value) return;
  cobrado.value = false;
  emit('cobrado', volverA.value);
});

// Platos de esta mesa que la cocina ya terminó: el mesero los entrega todos de una vez.
const platosListos = computed(() =>
  pedido.value && tipoDelPedido(pedido.value) === 'mesa'
    ? (pedido.value.items ?? []).filter((/** @type {any} */ item) => item.estadoCocina === 'listo')
    : [],
);
async function entregarListos() {
  try {
    await pedidos.cambiarEstadoCocinaDelPedido(pedido.value.id, 'entregado');
  } catch (error) {
    toast.add({
      title: error instanceof ErrorApi ? error.message : MENSAJE_ERROR_GENERICO,
      icon: 'i-lucide-circle-alert',
      color: 'error',
    });
  }
}

// Pedido que ya se cobró o se anuló: se ve qué tenía y, si se cobró sin pasar por la
// cocina (por ejemplo, un domicilio pagado por adelantado), se puede enviar ahora.
const faltaEnviarACocina = computed(
  () =>
    pedidoCerrado.value?.estado === 'pagado' &&
    !pedidoCerrado.value.enviadoACocinaEn &&
    (pedidoCerrado.value.items?.length ?? 0) > 0,
);
const TITULOS_CERRADO = Object.freeze({
  pagado: 'Este pedido ya se cobró',
  anulado: 'Este pedido se anuló',
});
const tituloCerrado = computed(
  () => TITULOS_CERRADO[pedidoCerrado.value?.estado] ?? 'Este pedido ya se cerró',
);
const descripcionCerrado = computed(() => {
  if (pedidoCerrado.value?.estado === 'anulado') return 'Ya no se le pueden hacer cambios.';
  return faltaEnviarACocina.value
    ? 'Ya no se le pueden agregar productos, pero falta enviarlo a la cocina para que lo preparen.'
    : 'Ya no se le pueden agregar productos.';
});
async function enviarCerradoACocina() {
  try {
    await pedidos.enviarACocina(pedidoCerrado.value.id);
    toast.add({
      title: `${nombreDelPedido(pedidoCerrado.value)} enviado a la cocina`,
      icon: 'i-lucide-chef-hat',
      color: 'success',
    });
    await navigateTo(volverA.value);
  } catch (error) {
    toast.add({
      title: error instanceof ErrorApi ? error.message : MENSAJE_ERROR_GENERICO,
      icon: 'i-lucide-circle-alert',
      color: 'error',
    });
  }
}
const accionesCerrado = computed(() => [
  ...(faltaEnviarACocina.value
    ? [{ label: 'Enviar a cocina', icon: 'i-lucide-chef-hat', onClick: enviarCerradoACocina }]
    : []),
  {
    label: 'Volver',
    color: /** @type {const} */ ('neutral'),
    variant: /** @type {const} */ (faltaEnviarACocina.value ? 'outline' : 'solid'),
    to: volverA.value,
  },
]);

// Producto con cantidad y notas.
const personalizando = ref(false);
const productoElegido = ref(/** @type {any} */ (null));
/** @param {any} producto */
function personalizar(producto) {
  productoElegido.value = producto;
  personalizando.value = true;
}
</script>

<template>
  <div class="space-y-5 pb-24 lg:pb-0">
    <!-- Encabezado: mesa, desde cuándo está abierto y estado. -->
    <div class="flex items-center gap-3">
      <UButton
        :to="volverA"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        class="size-11 justify-center"
        aria-label="Volver"
      />
      <div class="min-w-0 flex-1">
        <h2 class="truncate text-xl font-bold text-highlighted">{{ titulo }}</h2>
        <p class="truncate text-sm text-muted">{{ subtitulo }}</p>
      </div>
      <ChipEstado v-if="pedido" :apariencia="aparienciaDelPedido(pedido)" />
    </div>

    <!-- Platos listos de la mesa: se entregan todos de una vez. -->
    <div
      v-if="platosListos.length"
      class="flex flex-wrap items-center gap-3 rounded-xl bg-info/10 p-3 ring-1 ring-info/40"
      role="status"
    >
      <UIcon name="i-lucide-bell-ring" class="size-5 text-info" />
      <p class="min-w-0 flex-1 font-medium text-highlighted">
        {{
          platosListos.length === 1
            ? '1 plato listo para llevar'
            : `${platosListos.length} platos listos para llevar`
        }}
      </p>
      <UButton
        color="info"
        icon="i-lucide-check-check"
        :label="platosListos.length === 1 ? 'Entregado' : 'Entregar todo'"
        loading-auto
        @click="entregarListos"
      />
    </div>

    <!-- Cargando, error o pedido que ya se cerró. -->
    <div v-if="cargando" class="grid gap-3 sm:grid-cols-2">
      <USkeleton v-for="n in 6" :key="n" class="h-20 rounded-xl" />
    </div>
    <UEmpty
      v-else-if="errorDeCarga"
      icon="i-lucide-circle-alert"
      title="No pudimos abrir el pedido"
      :description="errorDeCarga"
      :actions="[
        { label: 'Reintentar', icon: 'i-lucide-rotate-cw', onClick: cargarPedido },
        { label: 'Volver', color: 'neutral', variant: 'outline', to: volverA },
      ]"
    />
    <div v-else-if="pedidoCerrado || (props.pedidoId && !pedido)" class="space-y-4">
      <UEmpty
        :icon="pedidoCerrado?.estado === 'anulado' ? 'i-lucide-ban' : 'i-lucide-circle-check'"
        :title="tituloCerrado"
        :description="descripcionCerrado"
        :actions="accionesCerrado"
      />
      <div
        v-if="pedidoCerrado?.items?.length"
        class="mx-auto max-w-xl rounded-xl bg-default p-4 ring-1 ring-default"
      >
        <ResumenCuenta :items="pedidoCerrado.items" solo-lectura />
      </div>
    </div>

    <div v-else class="grid gap-6 lg:grid-cols-3">
      <MenuParaPedir
        class="lg:col-span-2"
        :cantidades="cantidades"
        @agregar="agregar"
        @personalizar="personalizar"
      />
      <CuentaDelPedido
        v-model:abierta="cuentaAbierta"
        :titulo="titulo"
        :items="items"
        :total="total"
        :estado-pedido="estadoPedido"
        :procesando="enCurso > 0"
        :enviando="enviando"
        :puede-cobrar="puedeCobrar"
        @quitar="quitar"
        @enviar="enviar"
        @cobrar="abrirCobro"
      />
    </div>

    <ModalCobro
      v-if="puedeCobrar"
      v-model:abierto="cobrando"
      :pedido-id="pedido?.id ?? ''"
      @cobrado="cobrado = true"
    />

    <PersonalizarProducto
      v-model:abierto="personalizando"
      :producto="productoElegido"
      :apariencia="productoElegido?.apariencia ?? null"
      @agregar="({ producto, cantidad, notas }) => agregar(producto, { cantidad, notas })"
    />
  </div>
</template>
