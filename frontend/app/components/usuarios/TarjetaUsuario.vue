<!--
  Tarjeta de una cuenta del negocio.

  - El avatar con sus iniciales en el tono de su rol, el nombre (con «Tú» si es la propia) y
    el correo, con lo buscado resaltado.
  - Abajo, su estado con ícono y texto: activo, bloqueado (hasta qué hora) o inactivo, y desde
    cuándo existe, y su rol con el color de su avatar.
  - A la derecha, el menú de opciones (si hay algo que hacer con ella).

  Toda la tarjeta abre la vista rápida (el nombre es un botón que la cubre entera), menos el
  menú, que va por encima. Se eleva un poco al pasar el mouse y, cuando la cuenta cambia
  (`resaltado`), sale una onda desde el borde. Inactiva, se ve como un puesto vacío: borde
  punteado y en gris. Bloqueada, en ámbar.
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
  /** Hasta cuándo está bloqueada, si lo está. */
  finBloqueo: { type: /** @type {import('vue').PropType<Date | null>} */ (Date), default: null },
  /** Es la cuenta de la sesión. */
  propia: { type: Boolean, default: false },
  busqueda: { type: String, default: '' },
  /** Opciones del menú, como las recibe UDropdownMenu. */
  opciones: { type: /** @type {import('vue').PropType<any[]>} */ (Array), default: () => [] },
  resaltado: { type: Boolean, default: false },
  seleccionado: { type: Boolean, default: false },
});

const emit = defineEmits({
  /** @param {Cuenta} _cuenta */
  seleccionar: (_cuenta) => true,
});

const preferencias = usePreferenciasStore();
const { vibrate, isSupported: puedeVibrar } = useVibrate({ pattern: [12] });

const apariencia = computed(() => ESTADOS_CUENTA[props.estado]);
const rol = computed(() => ROLES[props.cuenta.rol]);
const tono = computed(() => TONOS_DE_ROL[props.cuenta.rol]);

// Fondo y borde según el estado. Clases completas para que Tailwind las encuentre.
const ESTILO = Object.freeze({
  activo: 'border-default bg-default hover:border-primary/40',
  bloqueado: 'border-warning/40 bg-warning/5 hover:border-warning/70',
  inactivo: 'border-dashed border-accented bg-default/60 hover:border-inverted/40',
});

/** Para lectores de pantalla: "Laura, Mesero, Bloqueado hasta las 4:15 p. m., tu cuenta". */
const descripcionAccesible = computed(() =>
  [
    props.cuenta.nombre,
    rol.value.etiqueta,
    props.finBloqueo
      ? `${apariencia.value.etiqueta} hasta las ${formatearHora(props.finBloqueo)}`
      : apariencia.value.etiqueta,
    props.propia ? 'tu cuenta' : null,
  ]
    .filter(Boolean)
    .join(', '),
);

function tocar() {
  if (preferencias.vibracion && puedeVibrar.value) vibrate();
  emit('seleccionar', props.cuenta);
}
</script>

<template>
  <article
    class="group relative flex items-start gap-3 rounded-xl border p-3 transition-[background-color,border-color,box-shadow,translate,scale] duration-200 ease-out hover:shadow-md has-[.principal:active]:scale-[0.98] motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none sm:p-4"
    :class="[ESTILO[estado], seleccionado && 'shadow-lg outline-2 outline-primary']"
  >
    <!-- Onda: la cuenta acaba de cambiar. -->
    <span
      v-if="resaltado"
      aria-hidden="true"
      class="pointer-events-none absolute -inset-px rounded-xl ring-2 ring-primary motion-safe:animate-onda"
    />

    <AvatarCuenta :nombre="cuenta.nombre" :rol="cuenta.rol" :estado="estado" />

    <div class="min-w-0 flex-1">
      <h3 class="flex min-w-0 items-center gap-1.5 leading-tight font-semibold text-highlighted">
        <!-- Botón que cubre la tarjeta entera (su ::after): tocar en cualquier lado la abre. -->
        <button
          type="button"
          class="principal truncate text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-primary"
          :class="estado === 'inactivo' && 'text-toned'"
          :aria-label="descripcionAccesible"
          @click="tocar"
        >
          <TextoResaltado :texto="cuenta.nombre" :busqueda="busqueda" />
        </button>
        <UBadge
          v-if="propia"
          color="primary"
          variant="solid"
          size="sm"
          label="Tú"
          class="shrink-0 rounded-full"
        />
      </h3>
      <p class="mt-0.5 truncate text-sm text-muted">
        <TextoResaltado :texto="cuenta.email" :busqueda="busqueda" />
      </p>

      <div class="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span
          class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold"
          :class="[tono.fondo, tono.texto]"
        >
          <UIcon :name="rol.icono" class="size-3.5 shrink-0" />
          {{ rol.etiqueta }}
        </span>
        <ChipEstado :apariencia="apariencia" tamano="sm" />
        <span v-if="finBloqueo" class="cifra text-xs font-semibold text-warning">
          hasta las {{ formatearHora(finBloqueo) }}
        </span>
        <span v-else-if="cuenta.creadoEn" class="text-xs text-dimmed">
          Desde {{ formatearMesYAnio(cuenta.creadoEn) }}
        </span>
      </div>
    </div>

    <!-- relative z-10: por encima del botón que cubre la tarjeta. -->
    <UDropdownMenu v-if="opciones.length" :items="[opciones]" :content="{ align: 'end' }">
      <UButton
        color="neutral"
        variant="ghost"
        size="lg"
        icon="i-lucide-ellipsis-vertical"
        class="relative z-10 -my-1 -me-1.5 shrink-0"
        :aria-label="`Opciones de ${cuenta.nombre}`"
      />
    </UDropdownMenu>
  </article>
</template>
