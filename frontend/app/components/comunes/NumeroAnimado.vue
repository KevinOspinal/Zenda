<!--
  Número entero que cambia con una animación corta (cuenta hacia arriba o hacia abajo), por
  ejemplo los contadores del mapa de mesas. Para pesos se usa CifraAnimada.
  Si el sistema pide "reducir movimiento", cambia sin animación.
-->
<script setup>
import { TransitionPresets } from '@vueuse/core';

const props = defineProps({
  valor: { type: Number, required: true },
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
</script>

<template>
  <span class="cifra">
    <!-- Los lectores de pantalla leen solo el valor final, no cada número intermedio. -->
    <span aria-hidden="true">{{ Math.round(animado) }}</span>
    <span class="sr-only">{{ valor }}</span>
  </span>
</template>
