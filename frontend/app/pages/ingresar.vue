<!--
  Ingreso con el NIT del negocio, el correo y la contraseña.
  El negocio se recuerda en el dispositivo: la segunda vez solo se piden correo y contraseña.
  Si hay demasiados intentos, una cuenta regresiva dice cuánto esperar.
-->
<script setup>
import { z } from 'zod';

definePageMeta({ layout: 'acceso', publica: true });
useHead({ title: 'Ingresar · Zenda' });

const sesion = useSesionStore();
const { registroHabilitado } = useRuntimeConfig().public;

const esquema = z.object({
  nit: z
    .string()
    .trim()
    .regex(/^\d{5,15}$/, 'Escribe solo los números del NIT, sin puntos ni dígito de verificación'),
  email: z.string().trim().toLowerCase().pipe(z.email('Escribe un correo válido')),
  password: z.string().min(1, 'Escribe tu contraseña'),
});

const datos = reactive({ nit: sesion.nitRecordado, email: '', password: '' });
// Con un negocio recordado se muestra su nombre en lugar del campo del NIT.
const cambiandoNegocio = ref(!sesion.nitRecordado);
const verContrasena = ref(false);
const error = ref('');

function cambiarNegocio() {
  cambiandoNegocio.value = true;
  datos.nit = '';
}

// Cuenta regresiva cuando el backend pide esperar (demasiados intentos).
const segundosDeEspera = ref(0);
/** @type {ReturnType<typeof setInterval> | undefined} */
let cuentaRegresiva;
/** @param {number} segundos */
function esperar(segundos) {
  segundosDeEspera.value = segundos;
  clearInterval(cuentaRegresiva);
  cuentaRegresiva = setInterval(() => {
    segundosDeEspera.value -= 1;
    if (segundosDeEspera.value <= 0) clearInterval(cuentaRegresiva);
  }, 1000);
}
onBeforeUnmount(() => clearInterval(cuentaRegresiva));

/** @param {import('@nuxt/ui').FormSubmitEvent<z.output<typeof esquema>>} evento */
async function ingresar(evento) {
  error.value = '';
  try {
    await sesion.ingresar(evento.data);
    await navigateTo(inicioDe(/** @type {import('~/utils/roles.js').Rol} */ (sesion.rol)), {
      replace: true,
    });
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
    if (fallo instanceof ErrorApi && fallo.reintentarEnSegundos) {
      esperar(fallo.reintentarEnSegundos);
    }
    // Por seguridad, la contraseña no se deja escrita después de un intento fallido.
    datos.password = '';
  }
}

// Si la sesión se perdió por falta de conexión, se puede reintentar sin escribir nada.
const reintentando = ref(false);
async function reintentarSesion() {
  reintentando.value = true;
  const recuperada = await sesion.restaurar({ reintentar: true });
  reintentando.value = false;
  if (recuperada)
    await navigateTo(inicioDe(/** @type {import('~/utils/roles.js').Rol} */ (sesion.rol)), {
      replace: true,
    });
}
const accionesDelAviso = computed(() =>
  sesion.motivoCierre === MENSAJE_SIN_CONEXION
    ? [
        {
          label: 'Reintentar',
          icon: 'i-lucide-rotate-cw',
          color: /** @type {const} */ ('warning'),
          variant: /** @type {const} */ ('outline'),
          loading: reintentando.value,
          onClick: reintentarSesion,
        },
      ]
    : [],
);
</script>

<template>
  <div class="space-y-6">
    <div class="space-y-1">
      <h1 class="text-2xl font-bold text-highlighted">Ingresar</h1>
      <p class="text-muted">Usa el correo y la contraseña que te dio el dueño del negocio.</p>
    </div>

    <UAlert
      v-if="sesion.motivoCierre && !error"
      color="warning"
      variant="subtle"
      icon="i-lucide-info"
      :title="sesion.motivoCierre"
      :actions="accionesDelAviso"
    />

    <UForm :schema="esquema" :state="datos" class="space-y-5" @submit="ingresar">
      <!-- Negocio recordado en este dispositivo. -->
      <div
        v-if="!cambiandoNegocio"
        class="flex items-center justify-between gap-3 rounded-xl bg-elevated px-4 py-3"
      >
        <div class="flex min-w-0 items-center gap-3">
          <UIcon name="i-lucide-store" class="size-5 shrink-0 text-primary" />
          <div class="min-w-0">
            <p class="truncate font-semibold text-highlighted">
              {{ sesion.negocioRecordado || 'Tu negocio' }}
            </p>
            <p class="text-sm text-muted">NIT {{ datos.nit }}</p>
          </div>
        </div>
        <UButton variant="link" label="Cambiar" @click="cambiarNegocio" />
      </div>
      <UFormField
        v-else
        label="NIT del negocio"
        name="nit"
        help="Solo números, sin puntos ni dígito de verificación."
      >
        <UInput
          v-model="datos.nit"
          size="xl"
          class="w-full"
          inputmode="numeric"
          placeholder="900123456"
          autofocus
        />
      </UFormField>

      <UFormField label="Correo" name="email">
        <UInput
          v-model="datos.email"
          type="email"
          size="xl"
          class="w-full"
          autocomplete="username"
          inputmode="email"
          placeholder="tu@correo.com"
          :autofocus="!cambiandoNegocio"
        />
      </UFormField>

      <UFormField label="Contraseña" name="password">
        <UInput
          v-model="datos.password"
          :type="verContrasena ? 'text' : 'password'"
          size="xl"
          class="w-full"
          autocomplete="current-password"
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
        block
        size="xl"
        loading-auto
        trailing-icon="i-lucide-arrow-right"
        :disabled="segundosDeEspera > 0"
        :label="segundosDeEspera > 0 ? `Espera ${segundosDeEspera} s` : 'Ingresar'"
      />
    </UForm>

    <p v-if="registroHabilitado" class="text-center text-sm text-muted">
      ¿Tu negocio aún no usa Zenda?
      <ULink to="/registro" class="font-semibold text-primary">Regístralo aquí</ULink>
    </p>
  </div>
</template>
