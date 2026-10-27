<!--
  Lista de pedidos por cobrar en la caja (mesas y mostrador), con su estado, su tiempo y su
  total. Se elige uno para ver su detalle y cobrarlo.
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
});

const ahora = useNow({ interval: 30_000 });
const busqueda = ref('');

const visibles = computed(() => {
  const texto = busqueda.value.trim().toLowerCase();
  if (!texto) return props.pedidos;
  return props.pedidos.filter((pedido) =>
    (pedido.mesa?.nombre ?? 'mostrador').toLowerCase().includes(texto),
  );
});
</script>

<template>
  <div class="space-y-3">
    <UInput
      v-model="busqueda"
      icon="i-lucide-search"
      size="lg"
      class="w-full"
      placeholder="Buscar mesa"
      aria-label="Buscar mesa"
    />

    <UEmpty
      v-if="!pedidos.length"
      variant="naked"
      icon="i-lucide-receipt"
      title="No hay pedidos por cobrar"
      description="Los pedidos de las mesas aparecen aquí en vivo."
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
              :name="pedido.mesa ? 'i-lucide-armchair' : 'i-lucide-shopping-bag'"
              class="size-5 text-toned"
            />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold text-highlighted">
              {{ pedido.mesa?.nombre ?? 'Mostrador' }}
            </span>
            <span class="cifra block text-sm text-muted">
              {{ duracionCorta(minutosTranscurridos(pedido.abiertoEn, ahora)) }}
            </span>
          </span>
          <span class="flex flex-col items-end gap-1">
            <span class="cifra font-bold text-highlighted">{{ formatearPesos(pedido.total) }}</span>
            <ChipEstado :apariencia="ESTADOS_PEDIDO[pedido.estado]" tamano="sm" />
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>
