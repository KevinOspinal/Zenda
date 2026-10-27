<!--
  Tarjeta de un pedido activo en la lista "Mis pedidos": mesa, estado, tiempo, total y cómo
  van sus platos en la cocina. Toda la tarjeta es un botón que abre el pedido.
-->
<script setup>
const props = defineProps({
  /** Pedido activo con sus ítems (forma del API). */
  pedido: { type: /** @type {import('vue').PropType<any>} */ (Object), required: true },
  /** Minutos desde que se abrió. */
  minutos: { type: Number, required: true },
});

const emit = defineEmits({ abrir: () => true });

/** Cuántos platos hay en cada estado de cocina (sin contar los entregados). */
const resumenCocina = computed(() =>
  /** @type {const} */ (['listo', 'preparando', 'pendiente'])
    .map((estado) => ({
      estado,
      cantidad: (props.pedido.items ?? []).filter(
        (/** @type {any} */ item) => item.estadoCocina === estado,
      ).length,
    }))
    .filter((grupo) => grupo.cantidad > 0),
);
</script>

<template>
  <button
    type="button"
    class="flex w-full flex-col gap-3 rounded-xl bg-default p-4 text-left ring-1 ring-default transition hover:ring-accented focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.98] motion-reduce:transition-none"
    :class="resumenCocina.some((g) => g.estado === 'listo') && 'ring-2 ring-info/60'"
    @click="emit('abrir')"
  >
    <span class="flex items-start justify-between gap-3">
      <span class="min-w-0">
        <span class="block truncate text-lg font-bold text-highlighted">
          {{ pedido.mesa?.nombre ?? 'Mostrador' }}
        </span>
        <span class="cifra inline-flex items-center gap-1 text-sm text-muted">
          <UIcon name="i-lucide-timer" class="size-4" />
          {{ duracionCorta(minutos) }}
        </span>
      </span>
      <ChipEstado :apariencia="ESTADOS_PEDIDO[pedido.estado]" />
    </span>

    <span class="flex flex-wrap gap-2">
      <UBadge
        v-for="grupo in resumenCocina"
        :key="grupo.estado"
        :color="ESTADOS_COCINA[grupo.estado].color"
        :icon="ESTADOS_COCINA[grupo.estado].icono"
        variant="soft"
        :label="`${grupo.cantidad} ${ESTADOS_COCINA[grupo.estado].etiqueta.toLowerCase()}`"
      />
      <span v-if="!resumenCocina.length" class="text-sm text-muted">Sin platos por preparar</span>
    </span>

    <span class="cifra text-xl font-bold text-highlighted">{{ formatearPesos(pedido.total) }}</span>
  </button>
</template>
