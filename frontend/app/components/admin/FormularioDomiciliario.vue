<!--
  Registrar o editar un domiciliario: nombre y teléfono (a ese número la caja le manda los
  datos de cada domicilio por WhatsApp). Al editar se puede desactivar: ya no se le asignan
  pedidos, pero se conserva su historial.
-->
<script setup>
import { z } from 'zod';

const props = defineProps({
  /** Domiciliario que se edita; null para registrar uno nuevo. */
  domiciliario: { type: /** @type {import('vue').PropType<any>} */ (Object), default: null },
});
const emit = defineEmits({ guardado: () => true, cancelar: () => true });

const esquema = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre').max(80),
  telefono: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{7,20}$/, 'Escribe un teléfono válido'),
  activo: z.boolean(),
});

const datos = reactive({
  nombre: props.domiciliario?.nombre ?? '',
  telefono: props.domiciliario?.telefono ?? '',
  activo: props.domiciliario?.activo ?? true,
});
const error = ref('');

async function guardar() {
  error.value = '';
  const cuerpo = { nombre: datos.nombre.trim(), telefono: datos.telefono.trim() };
  try {
    if (props.domiciliario) {
      await useApi().patch(`/domiciliarios/${props.domiciliario.id}`, {
        ...cuerpo,
        activo: datos.activo,
      });
    } else {
      await useApi().post('/domiciliarios', cuerpo);
    }
    emit('guardado');
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  }
}
</script>

<template>
  <UForm :schema="esquema" :state="datos" class="space-y-4" @submit="guardar">
    <UFormField label="Nombre" name="nombre">
      <UInput v-model="datos.nombre" size="lg" class="w-full" autofocus />
    </UFormField>
    <UFormField
      label="Celular"
      name="telefono"
      help="A este número se le envían los datos de cada domicilio por WhatsApp."
    >
      <UInput
        v-model="datos.telefono"
        type="tel"
        inputmode="tel"
        size="lg"
        class="w-full"
        autocomplete="off"
      />
    </UFormField>
    <UFormField v-if="domiciliario" name="activo">
      <USwitch
        v-model="datos.activo"
        label="Activo"
        description="Si lo desactivas, ya no se le asignan domicilios."
      />
    </UFormField>

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
        @click="emit('cancelar')"
      />
      <UButton type="submit" size="lg" loading-auto icon="i-lucide-check" label="Guardar" />
    </div>
  </UForm>
</template>
