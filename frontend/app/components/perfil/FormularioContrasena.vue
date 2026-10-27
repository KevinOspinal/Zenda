<!--
  Cambiar la contraseña propia. Las reglas copian las del backend: entre 8 y 128 caracteres,
  con al menos una letra y un número, y distinta de la actual. Al cambiarla, el backend
  cierra las sesiones de los demás dispositivos; este sigue adentro.
-->
<script setup>
import { z } from 'zod';

const sesion = useSesionStore();
const toast = useToast();

const esquema = z
  .object({
    contrasenaActual: z.string().min(1, 'Escribe tu contraseña actual'),
    contrasenaNueva: z
      .string()
      .min(8, 'Debe tener al menos 8 caracteres')
      .max(128)
      .regex(/[A-Za-zÁÉÍÓÚáéíóúÑñ]/, 'Debe tener al menos una letra')
      .regex(/\d/, 'Debe tener al menos un número'),
    confirmacion: z.string(),
  })
  .refine((datos) => datos.contrasenaNueva !== datos.contrasenaActual, {
    path: ['contrasenaNueva'],
    message: 'Debe ser distinta de la actual',
  })
  .refine((datos) => datos.confirmacion === datos.contrasenaNueva, {
    path: ['confirmacion'],
    message: 'Las contraseñas no coinciden',
  });

const datos = reactive({ contrasenaActual: '', contrasenaNueva: '', confirmacion: '' });
const error = ref('');

async function cambiar() {
  error.value = '';
  try {
    await sesion.cambiarContrasena({
      contrasenaActual: datos.contrasenaActual,
      contrasenaNueva: datos.contrasenaNueva,
    });
    Object.assign(datos, { contrasenaActual: '', contrasenaNueva: '', confirmacion: '' });
    toast.add({
      title: 'Contraseña actualizada',
      description: 'Por seguridad, cerramos tu sesión en los demás dispositivos.',
      icon: 'i-lucide-shield-check',
      color: 'success',
    });
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  }
}
</script>

<template>
  <section class="space-y-5 rounded-xl bg-default p-5 ring-1 ring-default">
    <div>
      <h2 class="text-lg font-semibold text-highlighted">Cambiar contraseña</h2>
      <p class="text-sm text-muted">Mínimo 8 caracteres, con al menos una letra y un número.</p>
    </div>

    <UForm :schema="esquema" :state="datos" class="space-y-4" @submit="cambiar">
      <UFormField label="Contraseña actual" name="contrasenaActual">
        <UInput
          v-model="datos.contrasenaActual"
          type="password"
          size="xl"
          class="w-full"
          autocomplete="current-password"
        />
      </UFormField>
      <UFormField label="Contraseña nueva" name="contrasenaNueva">
        <UInput
          v-model="datos.contrasenaNueva"
          type="password"
          size="xl"
          class="w-full"
          autocomplete="new-password"
        />
      </UFormField>
      <UFormField label="Repite la contraseña nueva" name="confirmacion">
        <UInput
          v-model="datos.confirmacion"
          type="password"
          size="xl"
          class="w-full"
          autocomplete="new-password"
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

      <UButton
        type="submit"
        size="xl"
        loading-auto
        icon="i-lucide-key-round"
        label="Cambiar contraseña"
      />
    </UForm>
  </section>
</template>
