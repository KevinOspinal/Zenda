<!--
  Restablecer la contraseña de un empleado que la olvidó (o que quedó bloqueado), en dos pasos:
  1. Escribir o generar la contraseña nueva (CampoContrasenaNueva). El backend cierra sus sesiones
     y le quita el bloqueo.
  2. Listo: la contraseña en grande, para dictársela o copiarla, y el recordatorio de
     entregársela en persona. Al cerrar, se olvida.
-->
<script setup>
/** @typedef {import('~/utils/usuarios.js').Cuenta} Cuenta */

const props = defineProps({
  /** La cuenta a la que se le restablece. */
  cuenta: { type: /** @type {import('vue').PropType<Cuenta | null>} */ (Object), default: null },
  /** Restablece la contraseña (la página llama al API); si falla, lanza el error. */
  restablecer: {
    type: /** @type {import('vue').PropType<(cuenta: Cuenta, contrasena: string) => Promise<void>>} */ (
      Function
    ),
    required: true,
  },
});

const abierto = defineModel('abierto', { type: Boolean, default: false });

const contrasena = ref('');
const error = ref('');
const lista = ref(false);
const { copy, copied, isSupported } = useClipboard({ legacy: true, copiedDuring: 2000 });

// Cada vez que se abre empieza de cero; al cerrarse, la contraseña se olvida.
watch(abierto, (estaAbierto) => {
  if (!estaAbierto) return;
  contrasena.value = '';
  error.value = '';
  lista.value = false;
});

const primerNombre = computed(() => props.cuenta?.nombre.split(/\s+/)[0] ?? '');

async function confirmar() {
  if (!props.cuenta) return;
  error.value = '';
  try {
    await props.restablecer(props.cuenta, contrasena.value);
    lista.value = true;
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  }
}

function cerrar() {
  abierto.value = false;
  contrasena.value = '';
}
</script>

<template>
  <UModal
    v-model:open="abierto"
    :title="
      lista ? 'Contraseña restablecida' : `Restablecer la contraseña de ${cuenta?.nombre ?? ''}`
    "
    :description="
      lista
        ? `Entrégasela a ${primerNombre} en persona. Ya puede ingresar con ella.`
        : 'Se cerrará su sesión en todos sus dispositivos y, si estaba bloqueado, se desbloquea.'
    "
    @after:leave="contrasena = ''"
  >
    <template #body>
      <Transition name="paso" mode="out-in">
        <!-- Paso 1: la contraseña nueva. -->
        <form v-if="!lista" key="escribir" class="space-y-3" @submit.prevent="confirmar">
          <UFormField label="Contraseña nueva" name="contrasenaNueva">
            <CampoContrasenaNueva v-model="contrasena" />
          </UFormField>
          <UAlert
            v-if="error"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="error"
            role="alert"
          />
        </form>

        <!-- Paso 2: lista, para dictarla o copiarla. -->
        <div v-else key="lista" class="space-y-4 text-center">
          <span
            class="mx-auto grid size-14 place-items-center rounded-full bg-success/10 text-success"
          >
            <UIcon name="i-lucide-key-round" class="size-7 motion-safe:animate-marcar" />
          </span>
          <p
            class="cifra rounded-xl bg-elevated px-4 py-3 font-mono text-2xl font-bold tracking-wider break-all text-highlighted select-all"
          >
            {{ contrasena }}
          </p>
          <UButton
            v-if="isSupported"
            color="neutral"
            variant="soft"
            size="lg"
            :label="copied ? 'Copiada' : 'Copiar la contraseña'"
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
      </Transition>
    </template>

    <template #footer>
      <div v-if="!lista" class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" size="lg" label="Cancelar" @click="cerrar" />
        <UButton
          size="lg"
          icon="i-lucide-key-round"
          label="Restablecer"
          loading-auto
          :disabled="!contrasenaValida(contrasena)"
          @click="confirmar"
        />
      </div>
      <UButton v-else block size="lg" icon="i-lucide-check" label="Listo" @click="cerrar" />
    </template>
  </UModal>
</template>
