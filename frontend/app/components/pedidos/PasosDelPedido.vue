<!--
  Seguimiento de un pedido: lo que ya pasó, con su hora, y lo que falta. El siguiente paso
  se resalta. El estado de cada paso se lee por ícono y texto, no solo por el color.
-->
<script setup>
defineProps({
  /** Pasos armados por pasosDelPedido (utils/pedidos.js). */
  pasos: {
    type: /** @type {import('vue').PropType<import('~/utils/pedidos.js').PasoDelPedido[]>} */ (
      Array
    ),
    required: true,
  },
});

/** @param {import('~/utils/pedidos.js').PasoDelPedido} paso */
function claseDelMarcador(paso) {
  if (paso.id === 'anulado') return 'bg-error text-inverted';
  if (paso.en) return 'bg-primary text-inverted';
  if (paso.siguiente) return 'bg-warning/15 text-warning ring-2 ring-warning/60';
  return 'bg-elevated text-dimmed ring-1 ring-default';
}

/** @param {import('~/utils/pedidos.js').PasoDelPedido} paso */
function iconoDelMarcador(paso) {
  if (paso.id === 'anulado') return 'i-lucide-ban';
  return paso.en ? 'i-lucide-check' : paso.icono;
}
</script>

<template>
  <ol>
    <li v-for="(paso, posicion) in pasos" :key="paso.id" class="relative flex gap-3 pb-5 last:pb-0">
      <!-- Línea que une este paso con el siguiente. -->
      <span
        v-if="posicion < pasos.length - 1"
        class="absolute top-9 bottom-1 left-4 w-0.5 -translate-x-1/2 rounded-full"
        :class="paso.en ? 'bg-primary/40' : 'bg-accented'"
        aria-hidden="true"
      />
      <span
        class="relative grid size-8 shrink-0 place-items-center rounded-full"
        :class="claseDelMarcador(paso)"
      >
        <UIcon :name="iconoDelMarcador(paso)" class="size-4" />
      </span>
      <div class="min-w-0 pt-0.5">
        <p
          class="font-medium"
          :class="paso.en || paso.siguiente ? 'text-highlighted' : 'text-muted'"
        >
          {{ paso.etiqueta }}
        </p>
        <p v-if="paso.en" class="text-sm text-muted">{{ fechaRelativa(paso.en) }}</p>
        <p v-else-if="paso.siguiente" class="text-sm font-semibold text-warning">Falta</p>
        <p v-else class="text-sm text-dimmed">Pendiente</p>
      </div>
    </li>
  </ol>
</template>
