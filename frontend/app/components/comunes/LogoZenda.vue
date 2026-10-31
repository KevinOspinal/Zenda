<!--
  Logo provisional de Zenda: una hoja sobre un cuadro del color de la marca y el nombre.
  Se reemplaza cuando el usuario entregue el logo oficial.
-->
<script setup>
defineProps({
  /** Solo el ícono, sin el nombre (para espacios pequeños). */
  compacto: { type: Boolean, default: false },
  /** Para usarlo sobre el fondo índigo de la marca (panel del ingreso): cuadro claro y nombre claro. */
  sobreMarca: { type: Boolean, default: false },
});
</script>

<template>
  <span class="inline-flex items-center gap-2">
    <span
      class="grid size-9 place-items-center rounded-lg shadow-sm"
      :class="sobreMarca ? 'bg-primary-50 text-primary-700' : 'bg-primary text-inverted'"
    >
      <UIcon name="i-lucide-leaf" class="size-5" />
    </span>
    <span
      v-if="!compacto"
      class="text-lg font-bold tracking-tight"
      :class="sobreMarca ? 'text-primary-50' : 'text-highlighted'"
    >
      Zenda
    </span>
  </span>
</template>
