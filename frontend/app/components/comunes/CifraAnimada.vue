<!--
  Valor en pesos que cambia con una animación corta (cuenta hacia arriba o hacia abajo),
  por ejemplo el total de la cuenta al agregar un producto.

  Durante la animación se muestran pesos redondos aproximados; al terminar, el valor exacto.
  Si el sistema pide "reducir movimiento", cambia sin animación.
-->
<script setup>
import { TransitionPresets } from '@vueuse/core';

const props = defineProps({
  /** Valor en pesos: texto del API ("38000") o un Decimal. */
  valor: {
    type: /** @type {import('vue').PropType<import('~/utils/dinero.js').ValorDinero>} */ ([
      String,
      Number,
      Object,
    ]),
    required: true,
  },
  /** Mostrar siempre centavos (bases e impuestos). */
  conCentavos: { type: Boolean, default: false },
});

const movimiento = usePreferredReducedMotion();

// El número de la animación es solo visual: pasa por valores intermedios aproximados.
// Nunca se usa para cuentas; al final se muestra el valor exacto con Decimal.
const destino = computed(() => aDecimal(props.valor).toNumber());
const animado = useTransition(destino, {
  duration: 450,
  easing: TransitionPresets.easeOutCubic,
  disabled: computed(() => movimiento.value === 'reduce'),
});

const exacto = computed(() => formatearPesos(props.valor, { conCentavos: props.conCentavos }));
const visible = computed(() =>
  animado.value === destino.value ? exacto.value : formatearPesos(Math.round(animado.value)),
);
</script>

<template>
  <span class="cifra">
    <!-- Los lectores de pantalla leen solo el valor final, no cada número intermedio. -->
    <span aria-hidden="true">{{ visible }}</span>
    <span class="sr-only">{{ exacto }}</span>
  </span>
</template>
