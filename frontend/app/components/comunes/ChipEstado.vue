<!--
  Chip de estado: color, ícono y etiqueta juntos (el color nunca va solo).
  Recibe una apariencia de utils/estados.js, por ejemplo ESTADOS_COCINA.preparando.
-->
<script setup>
/** @typedef {import('~/utils/estados.js').Apariencia} Apariencia */

defineProps({
  apariencia: {
    type: /** @type {import('vue').PropType<Apariencia>} */ (Object),
    required: true,
  },
  /** Tamaño del chip: sm, md o lg. */
  tamano: {
    type: /** @type {import('vue').PropType<'sm' | 'md' | 'lg'>} */ (String),
    default: 'md',
  },
  /** subtle: fondo suave con borde (por defecto); solid: relleno, para destacar. */
  variante: {
    type: /** @type {import('vue').PropType<'subtle' | 'solid' | 'soft' | 'outline'>} */ (String),
    default: 'subtle',
  },
});
</script>

<template>
  <UBadge
    :color="apariencia.color"
    :icon="apariencia.icono"
    :label="apariencia.etiqueta"
    :size="tamano"
    :variant="variante"
  />
</template>
