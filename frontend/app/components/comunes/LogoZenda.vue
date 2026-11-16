<!--
  Logo de Zenda: un tiquete de comanda con la Z, sobre un cuadro índigo a violeta, y el nombre.
  El borde en zigzag del tiquete repite la forma de la Z.
  El degradado del cuadro va en CSS y no dentro del SVG: un degradado con id se rompe cuando
  hay varios logos en la página y el primero está oculto (por ejemplo, con lg:hidden).
  Los mismos trazos están en public/favicon.svg (el ícono de la pestaña).
-->
<script setup>
defineProps({
  /** Solo el ícono, sin el nombre (para espacios pequeños). */
  compacto: { type: Boolean, default: false },
  /** Para usarlo sobre el fondo índigo de la marca (panel del ingreso): borde claro y nombre claro. */
  sobreMarca: { type: Boolean, default: false },
});
</script>

<template>
  <span class="inline-flex items-center gap-2">
    <span
      class="size-9 shrink-0 overflow-hidden rounded-lg bg-linear-to-br from-primary-600 to-secondary-600 shadow-sm"
      :class="sobreMarca && 'ring-1 ring-primary-50/25'"
    >
      <!-- El tiquete, inclinado, con la Z encima. Coordenadas en una cuadrícula de 512. -->
      <svg
        viewBox="0 0 512 512"
        class="size-full drop-shadow-sm"
        aria-hidden="true"
        focusable="false"
      >
        <g transform="rotate(-8 256 256)">
          <path
            fill="#fff"
            d="M180 112H332Q360 112 360 140V392l-26-20l-26 20l-26-20l-26 20l-26-20l-26 20l-26-20l-26 20V140Q152 112 180 112Z"
          />
          <path
            class="fill-primary-700 stroke-primary-700"
            stroke-width="10"
            stroke-linejoin="round"
            d="M200 180H312V210L242 290H312V320H200V290L270 210H200Z"
          />
        </g>
      </svg>
    </span>
    <span
      v-if="!compacto"
      class="text-lg font-extrabold tracking-tight"
      :class="sobreMarca ? 'text-primary-50' : 'text-highlighted'"
    >
      Zenda
    </span>
  </span>
</template>
