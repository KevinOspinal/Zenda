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
    <UEmpty
      v-else-if="pedidoCerrado || (props.pedidoId && !pedido)"
      icon="i-lucide-circle-check"
      title="Este pedido ya se cerró"
      description="Se cobró o se anuló desde otro dispositivo."
      :actions="[{ label: 'Volver', to: volverA }]"
    />

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
