<!--
  Detalle de una cuenta, en la vista rápida (tablet horizontal y PC) y en la hoja de abajo del
  celular:
  - Su estado explicado: si puede ingresar, hasta cuándo está bloqueada y cómo desbloquearla,
    o que está desactivada.
  - Su rol con lo que hace, y las pantallas a las que entra.
  - Su correo y desde cuándo existe.
  - Por qué algo no se puede hacer desde aquí (su propia cuenta, un domiciliario, una cuenta de
    Zenda o el único dueño), con el camino para hacerlo.
-->
<script setup>
/** @typedef {import('~/utils/usuarios.js').Cuenta} Cuenta */

const props = defineProps({
  cuenta: { type: /** @type {import('vue').PropType<Cuenta>} */ (Object), required: true },
  estado: {
    type: /** @type {import('vue').PropType<import('~/utils/usuarios.js').EstadoCuenta>} */ (
      String
    ),
    required: true,
  },
  finBloqueo: { type: /** @type {import('vue').PropType<Date | null>} */ (Date), default: null },
  /** Por qué no se le puede dar o quitar el acceso desde aquí (ver permisosSobreCuenta). */
  motivo: {
    type: /** @type {import('vue').PropType<import('~/utils/usuarios.js').MotivoSinAcceso | null>} */ (
      String
    ),
    default: null,
  },
});

const rol = computed(() => ROLES[props.cuenta.rol]);
const tono = computed(() => TONOS_DE_ROL[props.cuenta.rol]);
const pantallas = computed(() => pantallasDeRol(props.cuenta.rol));
const { copy, copied, isSupported } = useClipboard({ legacy: true, copiedDuring: 2000 });

/** Explicación de cada motivo, con el camino para hacerlo (si lo hay). */
const NOTAS = Object.freeze({
  propia: {
    icono: 'i-lucide-circle-user',
    texto: 'Es tu cuenta: tu contraseña se cambia en Perfil.',
    accion: { label: 'Ir a Perfil', to: '/perfil' },
  },
  domiciliario: {
    icono: 'i-lucide-bike',
    texto: 'Su acceso a Zenda (activarlo o quitarlo) se maneja en Domiciliarios.',
    accion: { label: 'Ir a Domiciliarios', to: '/admin/domiciliarios' },
  },
  zenda: {
    icono: 'i-lucide-shield-user',
    texto: 'Las cuentas de Zenda no se desactivan ni cambian de rol: solo cambian de nombre.',
    accion: null,
  },
  unico_dueno: {
    icono: 'i-lucide-crown',
    texto: 'Es el único dueño activo: para quitarle el acceso, crea primero al nuevo dueño.',
    accion: null,
  },
});
const nota = computed(() => (props.motivo ? NOTAS[props.motivo] : null));
</script>

<template>
  <div class="space-y-5">
    <!-- 1. Estado -->
    <UAlert
      v-if="estado === 'bloqueado'"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      :title="finBloqueo ? `Bloqueado hasta las ${formatearHora(finBloqueo)}` : 'Bloqueado'"
      description="Se equivocó varias veces de contraseña. Se desbloquea solo, o ya mismo si le restableces la contraseña."
    />
    <UAlert
      v-else-if="estado === 'inactivo'"
      color="neutral"
      variant="subtle"
      icon="i-lucide-user-x"
      title="No puede ingresar"
      description="Su cuenta está desactivada. Actívala si vuelve a trabajar en el negocio."
    />
    <p v-else class="flex items-center gap-2 text-sm font-medium text-success">
      <UIcon name="i-lucide-circle-check" class="size-5 shrink-0" />
      Puede ingresar a Zenda
    </p>

    <!-- 2. Rol y pantallas -->
    <section class="space-y-3">
      <h3 class="text-xs font-semibold tracking-wide text-muted uppercase">Rol</h3>
      <div class="flex items-start gap-3 rounded-xl bg-elevated/50 p-3 ring-1 ring-default">
        <span
          class="grid size-10 shrink-0 place-items-center rounded-lg"
          :class="[tono.fondo, tono.texto]"
        >
          <UIcon :name="rol.icono" class="size-5" />
        </span>
        <div class="min-w-0">
          <p class="font-semibold text-highlighted">{{ rol.etiqueta }}</p>
          <p class="text-sm text-muted">{{ DESCRIPCION_DE_ROL[cuenta.rol] }}</p>
        </div>
      </div>
      <div v-if="pantallas.length" class="space-y-2">
        <p class="text-sm text-toned">Entra a:</p>
        <ul class="flex flex-wrap gap-1.5">
          <li
            v-for="pantalla in pantallas"
            :key="pantalla.id"
            class="inline-flex items-center gap-1.5 rounded-full bg-elevated px-2.5 py-1 text-xs font-medium text-toned"
          >
            <UIcon :name="pantalla.icono" class="size-3.5 text-muted" />
            {{ pantalla.etiqueta }}
          </li>
        </ul>
      </div>
    </section>

    <!-- 3. Datos -->
    <section class="space-y-2">
      <h3 class="text-xs font-semibold tracking-wide text-muted uppercase">Datos</h3>
      <dl class="divide-y divide-default rounded-xl ring-1 ring-default">
        <div class="flex items-center gap-3 px-3 py-2">
          <dt class="sr-only">Correo</dt>
          <UIcon name="i-lucide-mail" class="size-4 shrink-0 text-muted" />
          <dd class="min-w-0 flex-1 truncate text-sm text-highlighted">{{ cuenta.email }}</dd>
          <UButton
            v-if="isSupported"
            color="neutral"
            variant="ghost"
            square
            :aria-label="copied ? 'Correo copiado' : 'Copiar el correo'"
            @click="copy(cuenta.email)"
          >
            <UIcon
              :key="String(copied)"
              :name="copied ? 'i-lucide-check' : 'i-lucide-copy'"
              class="size-4"
              :class="copied && 'text-success motion-safe:animate-marcar'"
            />
          </UButton>
        </div>
        <div v-if="cuenta.creadoEn" class="flex items-center gap-3 px-3 py-2.5">
          <dt class="sr-only">En Zenda desde</dt>
          <UIcon name="i-lucide-calendar-check" class="size-4 shrink-0 text-muted" />
          <dd class="text-sm text-toned">
            En Zenda desde <span class="font-medium">{{ formatearMesYAnio(cuenta.creadoEn) }}</span>
          </dd>
        </div>
      </dl>
    </section>

    <!-- 4. Lo que no se hace desde aquí -->
    <div
      v-if="nota"
      class="flex items-start gap-3 rounded-xl bg-primary/5 p-3 ring-1 ring-primary/15"
    >
      <UIcon :name="nota.icono" class="mt-0.5 size-5 shrink-0 text-primary" />
      <div class="min-w-0 space-y-1.5">
        <p class="text-sm text-toned">{{ nota.texto }}</p>
        <UButton
          v-if="nota.accion"
          :to="nota.accion.to"
          :label="nota.accion.label"
          variant="link"
          trailing-icon="i-lucide-arrow-right"
          class="-ms-2.5 px-2.5"
        />
      </div>
    </div>
  </div>
</template>
