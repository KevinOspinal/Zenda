<!--
  Sección del muestrario visual (temporal, Fase 0): título, explicación y contenido.
  El id permite saltar a la sección desde la navegación de arriba.
-->
<script setup>
defineProps({
  id: { type: String, required: true },
  titulo: { type: String, required: true },
  descripcion: { type: String, default: '' },
});
</script>

<template>
  <section :id="id" class="scroll-mt-32 space-y-5" :aria-labelledby="`${id}-titulo`">
    <header class="space-y-1">
      <h2 :id="`${id}-titulo`" class="text-xl font-bold text-highlighted sm:text-2xl">
        {{ titulo }}
      </h2>
      <p v-if="descripcion" class="max-w-2xl text-muted">{{ descripcion }}</p>
    </header>
    <slot />
  </section>
</template>
