<!--
  Registro de un negocio nuevo en dos pasos: 1) el negocio y 2) la cuenta del dueño.
  Al terminar, el dueño queda con la sesión iniciada y entra directo a Zenda.
  Las reglas copian las del backend (POST /negocios/registro).
-->
<script setup>
import { z } from 'zod';

definePageMeta({ layout: 'acceso', publica: true });
useHead({ title: 'Registrar mi negocio · Zenda' });

const sesion = useSesionStore();
const toast = useToast();

const PASOS = [
  { title: 'Tu negocio', icon: 'i-lucide-store' },
  { title: 'Tu cuenta', icon: 'i-lucide-user-round' },
];
const paso = ref(0);

/** Régimen de impuesto: define qué cobra el negocio. */

const esquemaNegocio = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre del negocio').max(120),
  nit: z
    .string()
    .trim()
    .regex(/^\d{5,15}$/, 'Escribe solo los números del NIT, sin puntos ni dígito de verificación'),
  ciudad: z.string().trim().max(80).optional(),
  regimenImpuesto: z.enum(['responsable_inc', 'franquicia_iva', 'no_responsable']),
});

const esquemaDueno = z.object({
  nombre: z.string().trim().min(1, 'Escribe tu nombre').max(120),
  email: z.string().trim().toLowerCase().pipe(z.email('Escribe un correo válido')),
  contrasena: z
    .string()
    .min(8, 'Debe tener al menos 8 caracteres')
    .max(128)
    .regex(/[A-Za-zÁÉÍÓÚáéíóúÑñ]/, 'Debe tener al menos una letra')
    .regex(/\d/, 'Debe tener al menos un número'),
});

const negocio = reactive({ nombre: '', nit: '', ciudad: '', regimenImpuesto: 'responsable_inc' });
const dueno = reactive({ nombre: '', email: '', contrasena: '' });
const verContrasena = ref(false);
const error = ref('');
const formularioNegocio = useTemplateRef('formularioNegocio');

/** Requisitos de la contraseña, que se marcan mientras se escribe. */
const requisitos = computed(() => [
  { texto: 'Al menos 8 caracteres', cumple: dueno.contrasena.length >= 8 },
  { texto: 'Una letra', cumple: /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(dueno.contrasena) },
  { texto: 'Un número', cumple: /\d/.test(dueno.contrasena) },
]);

async function registrar() {
  error.value = '';
  try {
    // 1. Crear el negocio y su dueño (el NIT es único en todo el sistema).
    const respuesta = await peticionAlApi('/negocios/registro', {
      metodo: 'POST',
      cuerpo: {
        negocio: { ...negocio, ciudad: negocio.ciudad.trim() || undefined },
        dueno,
      },
    });

    // 2. El dueño queda con la sesión iniciada.
    sesion.iniciarConRegistro(respuesta);
    toast.add({
      title: `¡Bienvenido a Zenda, ${respuesta.usuario.nombre}!`,
      description: `${respuesta.negocio.nombre} ya está registrado.`,
      icon: 'i-lucide-party-popper',
      color: 'success',
    });
    await navigateTo(inicioDe('dueno'), { replace: true });
  } catch (fallo) {
    // 3. NIT repetido: volver al primer paso y marcar el campo.
    if (fallo instanceof ErrorApi && fallo.codigo === 'NIT_YA_REGISTRADO') {
      paso.value = 0;
      await nextTick();
      formularioNegocio.value?.setErrors([{ name: 'nit', message: fallo.message }]);
      return;
    }
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="space-y-1">
      <h1 class="text-2xl font-bold text-highlighted">Registrar mi negocio</h1>
      <p class="text-muted">En dos pasos tu restaurante o cafetería queda listo para vender.</p>
    </div>

    <UStepper v-model="paso" :items="PASOS" disabled class="w-full" />

    <!-- Paso 1: el negocio. -->
    <UForm
      v-if="paso === 0"
      ref="formularioNegocio"
      :schema="esquemaNegocio"
      :state="negocio"
      class="space-y-5"
      @submit="paso = 1"
    >
      <UFormField label="Nombre del negocio" name="nombre">
        <UInput
          v-model="negocio.nombre"
          size="xl"
          class="w-full"
          placeholder="Café La Esquina"
          autofocus
        />
      </UFormField>
      <UFormField
        label="NIT"
        name="nit"
        help="Solo números, sin puntos ni dígito de verificación. Con él ingresarán tus empleados."
      >
        <UInput
          v-model="negocio.nit"
          size="xl"
          class="w-full"
          inputmode="numeric"
          placeholder="901234567"
        />
      </UFormField>
      <UFormField label="Ciudad" name="ciudad" hint="Opcional">
        <UInput v-model="negocio.ciudad" size="xl" class="w-full" placeholder="Cali" />
      </UFormField>
      <UFormField
        label="¿Cómo factura tu negocio?"
        name="regimenImpuesto"
        help="Si no estás seguro, confírmalo con tu contador."
      >
        <URadioGroup v-model="negocio.regimenImpuesto" :items="OPCIONES_REGIMEN" variant="card" />
      </UFormField>
      <UButton
        type="submit"
        block
        size="xl"
        label="Continuar"
        trailing-icon="i-lucide-arrow-right"
      />
    </UForm>

    <!-- Paso 2: la cuenta del dueño. -->
    <UForm v-else :schema="esquemaDueno" :state="dueno" class="space-y-5" @submit="registrar">
      <UFormField label="Tu nombre" name="nombre">
        <UInput v-model="dueno.nombre" size="xl" class="w-full" autocomplete="name" autofocus />
      </UFormField>
      <UFormField label="Tu correo" name="email" help="Con él ingresarás a Zenda.">
        <UInput
          v-model="dueno.email"
          type="email"
          size="xl"
          class="w-full"
          autocomplete="email"
          inputmode="email"
        />
      </UFormField>
      <UFormField label="Contraseña" name="contrasena">
        <UInput
          v-model="dueno.contrasena"
          :type="verContrasena ? 'text' : 'password'"
          size="xl"
          class="w-full"
          autocomplete="new-password"
          :ui="{ trailing: 'pe-1' }"
        >
          <template #trailing>
            <UButton
              color="neutral"
              variant="link"
              size="lg"
              :icon="verContrasena ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              :aria-label="verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              :aria-pressed="verContrasena"
              @click="verContrasena = !verContrasena"
            />
          </template>
        </UInput>
        <ul class="mt-2 space-y-1 text-sm" aria-label="Requisitos de la contraseña">
          <li
            v-for="requisito in requisitos"
            :key="requisito.texto"
            class="flex items-center gap-1.5"
            :class="requisito.cumple ? 'text-success' : 'text-muted'"
          >
            <UIcon
              :name="requisito.cumple ? 'i-lucide-circle-check' : 'i-lucide-circle'"
              class="size-4"
            />
            {{ requisito.texto }}
          </li>
        </ul>
      </UFormField>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="error"
        role="alert"
      />

      <div class="flex gap-3">
        <UButton
          color="neutral"
          variant="outline"
          size="xl"
          icon="i-lucide-arrow-left"
          aria-label="Volver al paso anterior"
          @click="paso = 0"
        />
        <UButton
          type="submit"
          block
          size="xl"
          loading-auto
          label="Crear mi negocio"
          icon="i-lucide-check"
          class="flex-1"
        />
      </div>
    </UForm>

    <p class="text-center text-sm text-muted">
      ¿Ya tienes cuenta?
      <ULink to="/ingresar" class="font-semibold text-primary">Ingresa aquí</ULink>
    </p>
  </div>
</template>
