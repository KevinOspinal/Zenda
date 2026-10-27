<!--
  Indicador discreto de la conexión con el servidor: en vivo, reconectando o sin conexión.
  En la Fase 1 lo alimenta el store `conexion`; por ahora recibe el estado por prop.
-->
<script setup>
const props = defineProps({
  estado: {
    type: /** @type {import('vue').PropType<'en_vivo' | 'reconectando' | 'sin_conexion'>} */ (
      String
    ),
    default: 'en_vivo',
  },
});

/** Punto de color, animación y texto de cada estado (clases completas para Tailwind). */
const ESTADOS = Object.freeze({
  en_vivo: { etiqueta: 'En vivo', punto: 'bg-success', animacion: 'motion-safe:animate-ping' },
  reconectando: {
    etiqueta: 'Reconectando…',
    punto: 'bg-warning',
    animacion: 'motion-safe:animate-pulse',
  },
  sin_conexion: { etiqueta: 'Sin conexión', punto: 'bg-neutral-400', animacion: '' },
});

const actual = computed(() => ESTADOS[props.estado]);
</script>

<template>
  <span
    role="status"
    class="inline-flex items-center gap-2 rounded-full bg-default px-3 py-1 text-sm font-medium text-toned ring-1 ring-default"
  >
    <span class="relative flex size-2.5">
      <span
        v-if="actual.animacion"
        class="absolute inline-flex size-full rounded-full opacity-60"
        :class="[actual.punto, actual.animacion]"
      />
      <span class="relative inline-flex size-2.5 rounded-full" :class="actual.punto" />
    </span>
    {{ actual.etiqueta }}
  </span>
</template>
