<!--
  Cómo va la cocina con los platos de una mesa: una barra con un tramo por paso, del más
  avanzado al que falta (servidos, listos para llevar, en preparación y pendientes). Cuando un
  plato avanza, los tramos se acomodan con una transición; un paso nuevo crece desde cero.

  Los colores son los del avance de un pedido de mesa (ver AVANCE_EN_COCINA y ESTADOS_COCINA).
  La barra es visual; los lectores de pantalla oyen el resumen en texto.
-->
<script setup>
const props = defineProps({
  /** Platos en cada paso (ver avanceDeCocina en utils/mesas.js). */
  avance: {
    type: /** @type {import('vue').PropType<import('~/utils/mesas.js').AvanceDeCocina>} */ (Object),
    required: true,
  },
  /** Muestra debajo cuántos platos hay en cada paso. */
  conLeyenda: { type: Boolean, default: false },
});

// Del paso más avanzado al que falta. Clases completas para que Tailwind las encuentre.
const PASOS = Object.freeze([
  { paso: 'entregado', singular: 'servido', plural: 'servidos', clase: 'bg-secondary' },
  { paso: 'listo', singular: 'listo para llevar', plural: 'listos para llevar', clase: 'bg-info' },
  { paso: 'preparando', singular: 'en preparación', plural: 'en preparación', clase: 'bg-warning' },
  { paso: 'pendiente', singular: 'pendiente', plural: 'pendientes', clase: 'bg-accented' },
]);

const tramos = computed(() =>
  PASOS.map((paso) => ({
    ...paso,
    cantidad: props.avance[/** @type {'entregado'} */ (paso.paso)],
  }))
    .filter((tramo) => tramo.cantidad > 0)
    .map((tramo) => ({
      ...tramo,
      texto: `${tramo.cantidad} ${tramo.cantidad === 1 ? tramo.singular : tramo.plural}`,
    })),
);

const descripcion = computed(() =>
  [`${props.avance.total} platos`, ...tramos.value.map((tramo) => tramo.texto)].join(', '),
);
</script>

<template>
  <div>
    <div class="flex h-2 w-full gap-0.5" aria-hidden="true">
      <span
        v-for="tramo in tramos"
        :key="tramo.paso"
        class="tramo h-full min-w-1.5 rounded-full"
        :class="tramo.clase"
        :style="{ '--peso': tramo.cantidad }"
      />
    </div>
    <ul
      v-if="conLeyenda"
      class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-toned"
      aria-hidden="true"
    >
      <li v-for="tramo in tramos" :key="tramo.paso" class="inline-flex items-center gap-1.5">
        <span class="size-2.5 rounded-full" :class="tramo.clase" />
        {{ tramo.texto }}
      </li>
    </ul>
    <span class="sr-only">{{ descripcion }}</span>
  </div>
</template>

<style scoped>
/* Cada tramo ocupa lo que le toca según sus platos y se acomoda al cambiar. */
.tramo {
  flex: var(--peso) 1 0;
  transition: flex-grow 300ms ease-out;
}
/* Un paso que aparece (el primer plato listo, por ejemplo) crece desde cero. */
@starting-style {
  .tramo {
    flex-grow: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tramo {
    transition: none;
  }
}
</style>
