<!--
  Darle acceso a Zenda a un domiciliario (solo el dueño): el correo y la contraseña con que
  entrará desde su celular, con el NIT del negocio. Así ve sus entregas con el mapa y las marca
  como entregadas. Si ya tuvo acceso y se le quitó, se reactiva con estos datos.
-->
<script setup>
import { z } from 'zod';

const props = defineProps({
  /** Domiciliario al que se le da acceso. */
  domiciliario: { type: /** @type {import('vue').PropType<any>} */ (Object), default: null },
});
const abierto = defineModel('abierto', { type: Boolean, default: false });
const emit = defineEmits({ guardado: () => true });

const sesion = useSesionStore();

const esquema = z.object({
  email: z.email('Escribe un correo válido'),
  contrasena: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Za-zÁÉÍÓÚáéíóúÑñ]/, 'Debe tener al menos una letra')
    .regex(/\d/, 'Debe tener al menos un número'),
});

const datos = reactive({ email: '', contrasena: '' });
const verContrasena = ref(false);
const error = ref('');

// Al abrir, el formulario empieza con el correo que tuvo (si ya tuvo acceso).
watch(
  abierto,
  (estaAbierto) => {
    if (!estaAbierto) return;
    Object.assign(datos, { email: props.domiciliario?.acceso?.email ?? '', contrasena: '' });
    verContrasena.value = false;
    error.value = '';
  },
  { immediate: true },
);

async function guardar() {
  if (!props.domiciliario) return;
  error.value = '';
  try {
    await useApi().post(`/domiciliarios/${props.domiciliario.id}/acceso`, {
      email: datos.email.trim().toLowerCase(),
      contrasena: datos.contrasena,
    });
    emit('guardado');
    abierto.value = false;
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  }
}
</script>

<template>
  <UModal
    v-model:open="abierto"
    :title="domiciliario ? `Acceso de ${domiciliario.nombre} a Zenda` : 'Acceso a Zenda'"
    description="Con estos datos entra desde su celular y ve sus entregas con el mapa."
  >
    <template #body>
      <UForm :schema="esquema" :state="datos" class="space-y-4" @submit="guardar">
        <UFormField label="Correo" name="email">
          <UInput
            v-model="datos.email"
            type="email"
            inputmode="email"
            size="lg"
            class="w-full"
            autocomplete="off"
            autofocus
          />
        </UFormField>
        <UFormField
          label="Contraseña"
          name="contrasena"
          help="Mínimo 8 caracteres, con letras y números. Él la puede cambiar en su perfil."
        >
          <UInput
            v-model="datos.contrasena"
            :type="verContrasena ? 'text' : 'password'"
            size="lg"
            class="w-full"
            autocomplete="new-password"
          >
            <template #trailing>
              <UButton
                color="neutral"
                variant="link"
                :icon="verContrasena ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :aria-label="verContrasena ? 'Ocultar contraseña' : 'Ver contraseña'"
                @click="verContrasena = !verContrasena"
              />
            </template>
          </UInput>
        </UFormField>
        <UAlert
          color="info"
          variant="subtle"
          icon="i-lucide-smartphone"
          title="Para entrar desde su celular"
          :description="`NIT ${sesion.negocio?.nit ?? ''}, este correo y esta contraseña.`"
        />
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="error"
          role="alert"
        />
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            size="lg"
            label="Cancelar"
            @click="abierto = false"
          />
          <UButton
            type="submit"
            size="lg"
            loading-auto
            icon="i-lucide-key-round"
            label="Dar acceso"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
