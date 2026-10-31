<!--
  Negocio recordado en este dispositivo, en el ingreso: sus iniciales, su nombre y su NIT,
  con "Cambiar" para entrar a otro negocio.
-->
<script setup>
defineProps({
  /** Nombre del negocio; si no se conoce, "Tu negocio". */
  nombre: { type: String, default: '' },
  nit: { type: String, required: true },
});
const emit = defineEmits({ cambiar: () => true });
</script>

<template>
  <div
    class="flex items-center justify-between gap-3 rounded-xl bg-elevated p-3 ring-1 ring-default"
  >
    <div class="flex min-w-0 items-center gap-3">
      <!-- UAvatar saca las iniciales del nombre: "La Industria" → "LI". -->
      <UAvatar
        :alt="nombre || 'Tu negocio'"
        size="lg"
        :ui="{ root: 'rounded-lg bg-primary', fallback: 'font-bold text-inverted' }"
      />
      <div class="min-w-0">
        <p class="truncate font-semibold text-highlighted">{{ nombre || 'Tu negocio' }}</p>
        <p class="cifra text-sm text-muted">NIT {{ nit }}</p>
      </div>
    </div>
    <UButton variant="link" label="Cambiar" @click="emit('cambiar')" />
  </div>
</template>
