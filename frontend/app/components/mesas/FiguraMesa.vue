<!--
  Dibujo de una mesa vista desde arriba, con una silla por puesto (ver figuraDeMesa en
  utils/mesas.js) y el ícono del estado en el centro.

  - Libre: la mesa y las sillas solo con el contorno.
  - Ocupada o con platos listos: las sillas se llenan, una tras otra alrededor de la mesa,
    cuando la mesa cambia de estado; al liberarse, se vacían.
  Es decorativo: el estado ya lo dicen el texto y el chip de la tarjeta.
-->
<script setup>
const props = defineProps({
  /** Puestos de la mesa. */
  capacidad: { type: Number, required: true },
  /** Estado visual: libre, ocupada o con_platos_listos (ver estadoVisualDeMesa). */
  estado: {
    type: /** @type {import('vue').PropType<'libre' | 'ocupada' | 'con_platos_listos'>} */ (String),
    default: 'libre',
  },
  /** Ícono del centro de la mesa. */
  icono: { type: String, default: '' },
});

const figura = computed(() => figuraDeMesa(props.capacidad));
const ocupada = computed(() => props.estado !== 'libre');

// Color del dibujo según el estado. Clases completas para que Tailwind las encuentre.
const COLOR = Object.freeze({
  libre: 'text-success',
  ocupada: 'text-warning',
  con_platos_listos: 'text-info',
});
</script>

<template>
  <div class="relative transition-colors duration-300" :class="COLOR[estado]" aria-hidden="true">
    <svg
      :viewBox="`0 0 ${LIENZO_MESA.ancho} ${LIENZO_MESA.alto}`"
      class="block h-auto w-full overflow-visible"
    >
      <rect
        v-for="(silla, i) in figura.sillas"
        :key="i"
        class="silla"
        :style="{ '--orden': i }"
        :x="silla.x"
        :y="silla.y"
        :width="silla.ancho"
        :height="silla.alto"
        :rx="silla.radio"
        fill="currentColor"
        stroke="currentColor"
        stroke-width="1.5"
        :fill-opacity="ocupada ? 0.85 : 0"
        :stroke-opacity="ocupada ? 0 : 0.6"
      />
      <rect
        class="mesa"
        :x="figura.mesa.x"
        :y="figura.mesa.y"
        :width="figura.mesa.ancho"
        :height="figura.mesa.alto"
        :rx="figura.mesa.radio"
        fill="currentColor"
        stroke="currentColor"
        stroke-width="2"
        :fill-opacity="ocupada ? 0.2 : 0.06"
        :stroke-opacity="ocupada ? 0.9 : 0.55"
      />
    </svg>
    <UIcon
      v-if="icono"
      :name="icono"
      class="absolute top-1/2 left-1/2 size-5 -translate-1/2"
      :class="estado === 'con_platos_listos' && 'origin-top motion-safe:animate-campana'"
    />
    <span
      v-if="figura.sillasDeMas"
      class="cifra absolute right-0 bottom-0 rounded-full bg-elevated px-1.5 text-[11px] font-bold text-toned"
    >
      +{{ figura.sillasDeMas }}
    </span>
  </div>
</template>

<style scoped>
/* Las sillas se llenan una tras otra alrededor de la mesa (--orden), y la mesa a la vez. */
.silla {
  transition:
    fill-opacity 200ms ease-out,
    stroke-opacity 200ms ease-out;
  transition-delay: calc(var(--orden) * 30ms);
}
.mesa {
  transition:
    fill-opacity 250ms ease-out,
    stroke-opacity 250ms ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .silla {
    transition-delay: 0ms;
  }
}
</style>
