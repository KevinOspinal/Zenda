<!--
  Lista de pedidos por cobrar en la caja (mesas, mostrador y domicilios), con su estado, su
  tiempo y su total. Se filtra por tipo (con cuántos hay de cada uno) y se busca por mesa,
  número o cliente. Se elige uno para ver su detalle y cobrarlo.
  Sin pedidos, invita a vender: venta de mostrador o nuevo domicilio.
-->
<script setup>
const props = defineProps({
  pedidos: { type: /** @type {import('vue').PropType<any[]>} */ (Array), required: true },
  /** Id del pedido elegido. */
  seleccionado: { type: String, default: '' },
});

const emit = defineEmits({
  /** @param {string} _id */
  seleccionar: (_id) => true,
  'nuevo-domicilio': () => true,
});

const ahora = useNow({ interval: 30_000 });
const busqueda = ref('');

/** @typedef {import('~/utils/pedidos.js').TipoPedido} TipoPedido */
/** Filtro por tipo: 'todos' o un tipo de pedido. */
const filtro = ref(/** @type {'todos' | TipoPedido} */ ('todos'));

const filtros = computed(() => {
  /** @param {TipoPedido} tipo */
  const cuantos = (tipo) => props.pedidos.filter((p) => tipoDelPedido(p) === tipo).length;
  return [
    { valor: 'todos', etiqueta: 'Todos', icono: 'i-lucide-list', cantidad: props.pedidos.length },
    .../** @type {TipoPedido[]} */ (['mesa', 'mostrador', 'domicilio']).map((tipo) => ({
      valor: tipo,
      etiqueta: TIPOS_PEDIDO[tipo].etiqueta,
      icono: TIPOS_PEDIDO[tipo].icono,
      cantidad: cuantos(tipo),
    })),
  ];
});

const visibles = computed(() => {
  const texto = busqueda.value.trim().toLowerCase();
  return props.pedidos.filter(
    (pedido) =>
      (filtro.value === 'todos' || tipoDelPedido(pedido) === filtro.value) &&
      // Se busca por mesa, número del día o nombre del cliente ("#15 · Juan").
      (!texto || nombreDelPedido(pedido).toLowerCase().includes(texto)),
  );
});
</script>

<template>
  <section class="space-y-3 rounded-xl bg-default p-4 ring-1 ring-default">
    <header class="flex items-center justify-between gap-2">
      <h2 class="text-lg font-semibold text-highlighted">Por cobrar</h2>
      <UBadge
        v-if="pedidos.length"
        :label="String(pedidos.length)"
        color="warning"
        variant="subtle"
        class="cifra"
      />
    </header>

    <template v-if="pedidos.length">
      <div class="flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo de pedido">
        <UButton
          v-for="opcion in filtros"
          :key="opcion.valor"
          :icon="opcion.icono"
          size="md"
          :color="filtro === opcion.valor ? 'primary' : 'neutral'"
          :variant="filtro === opcion.valor ? 'solid' : 'soft'"
          :aria-pressed="filtro === opcion.valor"
          @click="filtro = /** @type {any} */ (opcion.valor)"
        >
          {{ opcion.etiqueta }}
          <span class="cifra opacity-80">{{ opcion.cantidad }}</span>
        </UButton>
      </div>

      <UInput
        v-model="busqueda"
        icon="i-lucide-search"
        size="lg"
        class="w-full"
        placeholder="Buscar mesa, número o cliente"
        aria-label="Buscar mesa, número o cliente"
      />
    </template>

    <!-- Sin nada por cobrar: se invita a vender. -->
    <UEmpty
      v-if="!pedidos.length"
      variant="naked"
      icon="i-lucide-circle-check-big"
      title="Todo cobrado"
      description="No hay cuentas pendientes. Las mesas y los pedidos nuevos aparecen aquí en vivo."
      :actions="[
        { label: 'Venta de mostrador', icon: 'i-lucide-shopping-bag', to: '/mostrador' },
        {
          label: 'Nuevo domicilio',
          icon: 'i-lucide-bike',
          variant: 'soft',
          onClick: () => emit('nuevo-domicilio'),
        },
      ]"
    />

    <UEmpty
      v-else-if="!visibles.length"
      variant="naked"
      icon="i-lucide-search-x"
      title="No hay pedidos con ese filtro"
      description="Prueba con otro tipo de pedido u otra búsqueda."
      :actions="[
        {
          label: 'Ver todos',
          color: 'neutral',
          variant: 'soft',
          onClick: () => ((filtro = 'todos'), (busqueda = '')),
        },
      ]"
    />

    <ul v-else class="space-y-2" aria-label="Pedidos por cobrar">
      <li v-for="pedido in visibles" :key="pedido.id">
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-xl p-3 text-left ring-1 transition focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.99] motion-reduce:transition-none"
          :class="
            pedido.id === seleccionado
              ? 'bg-primary/10 ring-2 ring-primary'
              : 'bg-default ring-default hover:ring-accented'
          "
          :aria-current="pedido.id === seleccionado ? 'true' : undefined"
          @click="emit('seleccionar', pedido.id)"
        >
          <span class="grid size-10 shrink-0 place-items-center rounded-lg bg-elevated">
            <UIcon
              :name="TIPOS_PEDIDO[tipoDelPedido(pedido)].icono"
              class="size-5 text-toned"
              :aria-label="TIPOS_PEDIDO[tipoDelPedido(pedido)].etiqueta"
            />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold text-highlighted">
              {{ nombreDelPedido(pedido) }}
            </span>
            <span class="cifra block text-sm text-muted">
              {{ duracionCorta(minutosTranscurridos(pedido.abiertoEn, ahora)) }}
            </span>
          </span>
          <span class="flex flex-col items-end gap-1">
            <span class="cifra font-bold text-highlighted">{{ formatearPesos(pedido.total) }}</span>
            <ChipEstado :apariencia="aparienciaDelPedido(pedido)" tamano="sm" />
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>
