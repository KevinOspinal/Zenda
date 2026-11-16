<!--
  Número que cambia con una animación corta (cuenta hacia arriba o hacia abajo), por ejemplo
  los contadores del mapa de mesas o el stock del inventario. Para pesos se usa CifraAnimada.
  Mientras cuenta muestra enteros; al terminar, el valor exacto con `formato`.
  Si el sistema pide "reducir movimiento", cambia sin animación.
-->
<script setup>
import { TransitionPresets } from '@vueuse/core';

const props = defineProps({
  valor: { type: Number, required: true },
  /** Cómo se escribe el número (por ejemplo, formatearCantidad). Por defecto, tal cual. */
  formato: {
    type: /** @type {import('vue').PropType<(valor: number) => string>} */ (Function),
    default: String,
  },
});

const movimiento = usePreferredReducedMotion();
const animado = useTransition(
  computed(() => props.valor),
  {
    duration: 300,
    easing: TransitionPresets.easeOutCubic,
    disabled: computed(() => movimiento.value === 'reduce'),
  },
);
const mostrado = computed(() =>
  props.formato(animado.value === props.valor ? props.valor : Math.round(animado.value)),
);
</script>

<template>
  <span class="cifra">
    <!-- Los lectores de pantalla leen solo el valor final, no cada número intermedio. -->
    <span aria-hidden="true">{{ mostrado }}</span>
    <span class="sr-only">{{ formato(valor) }}</span>
  </span>
</template>
