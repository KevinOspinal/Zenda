<!--
  Campo de una contraseña nueva (la inicial de una cuenta o una restablecida):
  - Los requisitos (8 caracteres, una letra, un número) se marcan mientras se escribe, en vez
    de un error al final.
  - El ojo la muestra u oculta; «Generar una segura» la crea al azar en grupos fáciles de
    dictar (y la deja a la vista), y «Copiar» la copia.
  Va dentro de un UFormField: el campo toma su nombre (por ejemplo, name="contrasena").
-->
<script setup>
const contrasena = defineModel({ type: String, default: '' });

defineProps({
  /** Tamaño del campo, como en UInput. */
  tamano: {
    type: /** @type {import('vue').PropType<'lg' | 'xl'>} */ (String),
    default: 'lg',
  },
});

const visible = ref(false);
const requisitos = computed(() => requisitosDe(contrasena.value));
const { copy, copied, isSupported } = useClipboard({ legacy: true, copiedDuring: 2000 });

function generar() {
  contrasena.value = generarContrasena();
  visible.value = true;
}
</script>

<template>
  <div class="space-y-2.5">
    <UInput
      v-model="contrasena"
      :type="visible ? 'text' : 'password'"
      :size="tamano"
      class="w-full"
      :ui="{ base: 'font-medium tracking-wide', trailing: 'pe-1' }"
      autocomplete="new-password"
      autocapitalize="off"
      spellcheck="false"
      :maxlength="LARGO_MAXIMO_CONTRASENA"
    >
      <template #trailing>
        <UButton
          color="neutral"
          variant="ghost"
          square
          :icon="visible ? 'i-lucide-eye-off' : 'i-lucide-eye'"
          :aria-label="visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'"
          :aria-pressed="visible"
          @click="visible = !visible"
        />
      </template>
    </UInput>

    <div class="flex flex-wrap gap-2">
      <UButton
        color="neutral"
        variant="soft"
        icon="i-lucide-sparkles"
        label="Generar una segura"
        class="min-h-10"
        @click="generar"
      />
      <UButton
        v-if="isSupported && contrasena"
        color="neutral"
        variant="ghost"
        class="min-h-10"
        :label="copied ? 'Copiada' : 'Copiar'"
        @click="copy(contrasena)"
      >
        <template #leading>
          <UIcon
            :key="String(copied)"
            :name="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            class="size-5"
            :class="copied && 'text-success motion-safe:animate-marcar'"
          />
        </template>
      </UButton>
    </div>

    <!-- Lo que falta se lee como lista; cada requisito dice con ícono y texto si ya se cumple. -->
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Requisitos de la contraseña">
      <li
        v-for="requisito in requisitos"
        :key="requisito.id"
        class="flex items-center gap-1.5 transition-colors duration-200"
        :class="requisito.cumplido ? 'font-medium text-success' : 'text-muted'"
      >
        <UIcon
          :key="String(requisito.cumplido)"
          :name="requisito.cumplido ? 'i-lucide-circle-check' : 'i-lucide-circle-dashed'"
          class="size-4 shrink-0"
          :class="requisito.cumplido && 'motion-safe:animate-marcar'"
        />
        {{ requisito.etiqueta }}
        <span class="sr-only">{{ requisito.cumplido ? '(listo)' : '(falta)' }}</span>
      </li>
    </ul>
  </div>
</template>
