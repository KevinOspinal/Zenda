<!--
  Tarjeta de una mesa en el mapa: nombre, estado (color + ícono + texto), capacidad y, si
  está ocupada, cuánto tiempo lleva y su total. Toda la tarjeta es un botón grande.

  Una mesa ocupada con platos listos se resalta en azul con un punto que late.
  Cuando cambia por un evento en vivo, `resaltada` la marca con un anillo por un momento.
-->
<script setup>
/**
 * Mesa tal como la envía el API (GET /mesas).
 * @typedef {{ id: string, nombre: string, zona?: string | null, capacidad: number,
 *   estado: 'libre' | 'ocupada' }} Mesa
 */

const props = defineProps({
  mesa: { type: /** @type {import('vue').PropType<Mesa>} */ (Object), required: true },
  /** La mesa tiene platos listos para llevar. */
  tienePlatosListos: { type: Boolean, default: false },
  /** Minutos desde que se abrió su pedido (solo si está ocupada). */
  minutosAbierta: { type: Number, default: null },
  /** Total actual de su pedido, en pesos (texto del API). */
  total: { type: String, default: null },
  /** Cambió hace un instante por un evento en vivo. */
  resaltada: { type: Boolean, default: false },
});

const emit = defineEmits({
  /** @param {Mesa} _mesa */
  seleccionar: (_mesa) => true,
});

const estadoVisual = computed(() => estadoVisualDeMesa(props.mesa.estado, props.tienePlatosListos));
const apariencia = computed(() => ESTADOS_MESA[estadoVisual.value]);

// Fondo y borde según el estado. Clases completas para que Tailwind las encuentre.
const FONDO = Object.freeze({
  libre: 'bg-default',
  ocupada: 'bg-warning/10',
  con_platos_listos: 'bg-info/10',
});
const ANILLO = Object.freeze({
  libre: 'ring-1 ring-success/30 hover:ring-success/60',
  ocupada: 'ring-1 ring-warning/40 hover:ring-warning/70',
  con_platos_listos: 'ring-2 ring-info/60 hover:ring-info',
});

/** Resumen para lectores de pantalla: "Mesa 4, Ocupada, 32 min, $ 38.000". */
const descripcionAccesible = computed(() =>
  [
    props.mesa.nombre,
    apariencia.value.etiqueta,
    props.minutosAbierta !== null ? duracionCorta(props.minutosAbierta) : null,
    props.total ? formatearPesos(props.total) : null,
  ]
    .filter(Boolean)
    .join(', '),
);
</script>

<template>
  <button
    type="button"
    class="relative flex min-h-32 flex-col justify-between gap-3 rounded-xl p-4 text-left transition duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98] motion-reduce:transition-none"
    :class="[FONDO[estadoVisual], resaltada ? 'ring-4 ring-info/50' : ANILLO[estadoVisual]]"
    :aria-label="descripcionAccesible"
    @click="emit('seleccionar', mesa)"
  >
    <span class="flex items-start justify-between gap-2">
      <span class="text-lg font-bold text-highlighted">{{ mesa.nombre }}</span>
      <!-- Punto que late: hay platos listos para llevar a esta mesa. -->
      <span v-if="estadoVisual === 'con_platos_listos'" class="relative mt-1.5 flex size-3">
        <span
          class="absolute inline-flex size-full rounded-full bg-info opacity-75 motion-safe:animate-ping"
        />
        <span class="relative inline-flex size-3 rounded-full bg-info" />
      </span>
    </span>

    <ChipEstado :apariencia="apariencia" />

    <span class="flex items-center justify-between gap-2 text-sm text-muted">
      <span class="inline-flex items-center gap-1">
        <UIcon name="i-lucide-users" class="size-4" />
        {{ mesa.capacidad }}
      </span>
      <span v-if="minutosAbierta !== null" class="cifra inline-flex items-center gap-1">
        <UIcon name="i-lucide-timer" class="size-4" />
        {{ duracionCorta(minutosAbierta) }}
      </span>
    </span>

    <span v-if="total" class="cifra font-semibold text-highlighted">
      {{ formatearPesos(total) }}
    </span>
  </button>
</template>
