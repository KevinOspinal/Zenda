<!--
  Ingreso con el NIT del negocio, el correo y la contraseña.
  El negocio se recuerda en el dispositivo: la segunda vez saluda ("¡Hola de nuevo!") y solo
  pide correo y contraseña. Al entrar, el botón confirma con el nombre de la persona; si los
  datos no coinciden, el formulario se sacude y la contraseña se borra. Si hay demasiados
  intentos, una cuenta regresiva dice cuánto esperar.
-->
<script setup>
import { z } from 'zod';

definePageMeta({ layout: 'acceso', publica: true });
useHead({ title: 'Ingresar · Zenda' });

/** Lo que dura el ✓ de bienvenida antes de pasar a la pantalla del rol. */
const PAUSA_BIENVENIDA_MS = 350;

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
const error = ref('');
/** Primer nombre de quien acaba de entrar: el botón lo saluda antes de seguir. */
const bienvenida = ref('');
/** Sacude el formulario cuando los datos no coinciden (solo si se permite el movimiento). */
const sacudiendo = ref(false);

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

async function sacudir() {
  // Se quita y se vuelve a poner para que la animación arranque de nuevo en cada intento.
  sacudiendo.value = false;
  await nextTick();
  sacudiendo.value = true;
}

function irAlInicio() {
  return navigateTo(inicioDe(/** @type {import('~/utils/roles.js').Rol} */ (sesion.rol)), {
    replace: true,
  });
}

/** @param {import('@nuxt/ui').FormSubmitEvent<z.output<typeof esquema>>} evento */
async function ingresar(evento) {
  // Ya entró y está por pasar a su pantalla: un segundo toque no vuelve a enviar.
  if (bienvenida.value) return;
  error.value = '';
  try {
    await sesion.ingresar(evento.data);
    // 1. El envío termina (el botón deja de cargar) y saluda: se nota que entró.
    bienvenida.value = sesion.usuario?.nombre.split(' ')[0] ?? '';
    // 2. Un instante después, a la pantalla de inicio de su rol.
    setTimeout(irAlInicio, PAUSA_BIENVENIDA_MS);
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
    if (fallo instanceof ErrorApi && fallo.reintentarEnSegundos) {
      esperar(fallo.reintentarEnSegundos);
    }
    // Por seguridad, la contraseña no se deja escrita después de un intento fallido.
    datos.password = '';
    sacudir();
  }
}

// Si la sesión se perdió por falta de conexión, se puede reintentar sin escribir nada.
const reintentando = ref(false);
async function reintentarSesion() {
  reintentando.value = true;
  const recuperada = await sesion.restaurar({ reintentar: true });
  reintentando.value = false;
  if (recuperada) await irAlInicio();
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

/** Texto del botón: espera, bienvenida o "Ingresar". */
const textoDelBoton = computed(() => {
  if (bienvenida.value) return `¡Listo, ${bienvenida.value}!`;
  if (segundosDeEspera.value > 0) return `Espera ${segundosDeEspera.value} s`;
  return 'Ingresar';
});
</script>

<template>
  <div
    class="space-y-6"
    :class="{ 'motion-safe:animate-sacudir': sacudiendo }"
    @animationend="sacudiendo = false"
  >
    <div class="space-y-1">
      <h1 class="text-3xl font-bold tracking-tight text-highlighted">
        {{ cambiandoNegocio ? 'Ingresa a tu negocio' : '¡Hola de nuevo!' }}
      </h1>
      <p class="text-muted">Entra con tu correo y tu contraseña.</p>
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
      <NegocioRecordado
        v-if="!cambiandoNegocio"
        :nombre="sesion.negocioRecordado"
        :nit="datos.nit"
        @cambiar="cambiarNegocio"
      />
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
          icon="i-lucide-store"
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
          icon="i-lucide-mail"
          :autofocus="!cambiandoNegocio"
        />
      </UFormField>

      <UFormField label="Contraseña" name="password">
        <CampoContrasena v-model="datos.password" />
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
        :color="bienvenida ? 'success' : 'primary'"
        :icon="bienvenida ? 'i-lucide-check' : undefined"
        :trailing-icon="bienvenida ? undefined : 'i-lucide-arrow-right'"
        :disabled="segundosDeEspera > 0"
        :label="textoDelBoton"
        class="transition-colors"
      />
    </UForm>

    <div class="space-y-3 border-t border-default pt-5 text-center text-sm text-muted">
      <p class="flex items-start justify-center gap-2 text-pretty">
        <UIcon name="i-lucide-users" class="mt-0.5 size-4 shrink-0" />
        ¿Eres del equipo? Tu correo y tu contraseña te los da el dueño o el administrador.
      </p>
      <p v-if="registroHabilitado">
        ¿Tu negocio aún no usa Zenda?
        <ULink to="/registro" class="font-semibold text-primary">Regístralo aquí</ULink>
      </p>
    </div>
  </div>
</template>
