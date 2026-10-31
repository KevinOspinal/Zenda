<!--
  Campo de contraseña del ingreso: botón para verla y aviso cuando Bloq Mayús está activado,
  el error más común al escribirla sin verla.
  Va dentro de un UFormField, que le pone la etiqueta y los errores.
-->
<script setup>
const valor = defineModel({ type: String, default: '' });

defineProps({
  /** Autocompletado del navegador: current-password al ingresar, new-password al crearla. */
  autocompletar: { type: String, default: 'current-password' },
});

const ver = ref(false);
const mayusculasActivas = ref(false);

/**
 * Revisa Bloq Mayús en cada tecla. Algunos eventos (los del autocompletado, por ejemplo) no
 * traen getModifierState: en ese caso no se cambia nada.
 * @param {KeyboardEvent} evento
 */
function revisarMayusculas(evento) {
  if (typeof evento.getModifierState === 'function') {
    mayusculasActivas.value = evento.getModifierState('CapsLock');
  }
}
</script>

<template>
  <div class="space-y-1.5">
    <UInput
      v-model="valor"
      :type="ver ? 'text' : 'password'"
      size="xl"
      class="w-full"
      :autocomplete="autocompletar"
      :ui="{ trailing: 'pe-1' }"
      @keydown="revisarMayusculas"
      @keyup="revisarMayusculas"
      @blur="mayusculasActivas = false"
    >
      <template #trailing>
        <UButton
          color="neutral"
          variant="link"
          size="lg"
          :icon="ver ? 'i-lucide-eye-off' : 'i-lucide-eye'"
          :aria-label="ver ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          :aria-pressed="ver"
          @click="ver = !ver"
        />
      </template>
    </UInput>
    <p
      v-if="mayusculasActivas"
      class="flex items-center gap-1.5 text-sm font-medium text-warning"
      role="status"
    >
      <UIcon name="i-lucide-arrow-big-up" class="size-4" />
      Bloq Mayús está activado
    </p>
  </div>
</template>
