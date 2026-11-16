<!--
  Tarjeta de una mesa en el mapa. Toda la tarjeta es un botón grande.

  - Arriba, el nombre y quién la atiende (o los puestos, si está libre).
  - En el centro, la mesa vista desde arriba con sus sillas (FiguraMesa): vacías si está libre,
    llenas si está ocupada. En el centro de la mesa, un "+" para empezar un pedido (un candado
    si la caja está cerrada), los cubiertos si está ocupada o la campana si hay platos listos.
  - Si está ocupada: el estado y cuánto lleva, cómo va la cocina (BarraCocina), una línea con
    lo más importante (sin enviar a la cocina, esperando mucho, platos listos o cuántos van
    servidos) y el total, o «Pagada» si ya se cobró y espera sus platos.
  - Si está libre: abajo, «Nuevo pedido» (o «Caja cerrada»), a la altura del total de las demás.

  Movimiento: se eleva un poco al pasar el mouse y se hunde al tocarla (con una vibración leve
  en el celular). Con platos listos, la tarjeta respira con un halo azul y la campana se mece.
  Cuando cambia por un evento en vivo (`resaltada`), sale una onda desde el borde.
  La mesa de la vista rápida (`seleccionada`) lleva un marco índigo: es un contorno (outline) y
  no un anillo, porque el anillo es una sombra y el halo de los platos listos la taparía.
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
  /** Ya se cobró: la mesa sigue ocupada hasta que se entreguen sus platos. */
  pagada: { type: Boolean, default: false },
  /** Cambió hace un instante por un evento en vivo. */
  resaltada: { type: Boolean, default: false },
  /** Platos de su pedido en cada paso de la cocina (ver avanceDeCocina). */
  avance: {
    type: /** @type {import('vue').PropType<import('~/utils/mesas.js').AvanceDeCocina | null>} */ (
      Object
    ),
    default: null,
  },
  /** Minutos que llevan esperando la cocina sus platos (ver minutosEsperandoCocina). */
  minutosEsperando: { type: Number, default: null },
  /** Su pedido tiene productos que no se han enviado a la cocina. */
  sinEnviar: { type: Boolean, default: false },
  /** Nombre de quien tomó el pedido. */
  mesero: { type: String, default: null },
  /** Es la mesa que se ve en la vista rápida. */
  seleccionada: { type: Boolean, default: false },
  /** No se puede empezar un pedido aquí (la caja está cerrada). */
  bloqueada: { type: Boolean, default: false },
});

const emit = defineEmits({
  /** @param {Mesa} _mesa */
  seleccionar: (_mesa) => true,
});

const preferencias = usePreferenciasStore();
const { vibrate, isSupported: puedeVibrar } = useVibrate({ pattern: [12] });

const estadoVisual = computed(() => estadoVisualDeMesa(props.mesa.estado, props.tienePlatosListos));
const apariencia = computed(() => ESTADOS_MESA[estadoVisual.value]);
const urgencia = computed(() =>
  props.minutosEsperando === null ? null : urgenciaDeEspera(props.minutosEsperando),
);

/** Ícono del centro de la mesa. */
const icono = computed(() => {
  if (estadoVisual.value === 'libre') return props.bloqueada ? 'i-lucide-lock' : 'i-lucide-plus';
  if (estadoVisual.value === 'con_platos_listos') return 'i-lucide-bell-ring';
  return props.pagada ? 'i-lucide-circle-check' : 'i-lucide-utensils';
});

// Fondo y borde según el estado. Clases completas para que Tailwind las encuentre.
const ESTILO = Object.freeze({
  libre: 'border-default bg-default hover:border-success/50',
  ocupada: 'border-warning/30 bg-warning/5 hover:border-warning/60',
  con_platos_listos: 'border-info/50 bg-info/10 hover:border-info motion-safe:animate-respirar',
});
const COLOR_TEXTO = Object.freeze({
  neutral: 'text-muted',
  warning: 'text-warning',
  error: 'text-error',
});

/**
 * Lo más importante que pasa en una mesa ocupada, en una línea: falta enviar el pedido a la
 * cocina, los platos llevan mucho esperando, hay platos listos o cuántos van servidos.
 */
const linea = computed(() => {
  const { avance } = props;
  if (props.sinEnviar) {
    return { texto: 'Sin enviar a cocina', icono: 'i-lucide-send', clase: 'text-primary' };
  }
  if (urgencia.value && urgencia.value.nivel !== 'normal') {
    return {
      texto: `Esperando ${duracionCorta(/** @type {number} */ (props.minutosEsperando))}`,
      icono: 'i-lucide-alarm-clock',
      clase: COLOR_TEXTO[/** @type {'warning' | 'error'} */ (urgencia.value.color)],
      late: urgencia.value.late,
    };
  }
  if (avance?.listo) {
    const texto = `${avance.listo} ${avance.listo === 1 ? 'listo' : 'listos'} para llevar`;
    return { texto, icono: 'i-lucide-bell-ring', clase: 'text-info' };
  }
  if (avance?.total) {
    const texto = `${avance.entregado} de ${avance.total} servidos`;
    return { texto, icono: 'i-lucide-check-check', clase: 'text-muted' };
  }
  return null;
});

/**
 * Resumen para lectores de pantalla, por ejemplo: "Mesa 4, Ocupada, 32 min, $ 38.000,
 * 2 de 5 platos servidos, atiende Laura".
 */
const descripcionAccesible = computed(() =>
  [
    props.mesa.nombre,
    apariencia.value.etiqueta,
    props.minutosAbierta !== null ? duracionCorta(props.minutosAbierta) : null,
    props.pagada ? 'Pagada' : null,
    props.total ? formatearPesos(props.total) : null,
    props.sinEnviar ? 'sin enviar a cocina' : null,
    urgencia.value && urgencia.value.nivel !== 'normal'
      ? `esperando la cocina ${duracionCorta(/** @type {number} */ (props.minutosEsperando))}`
      : null,
    props.avance?.total
      ? `${props.avance.entregado} de ${props.avance.total} platos servidos`
      : null,
    props.mesero ? `atiende ${props.mesero}` : null,
  ]
    .filter(Boolean)
    .join(', '),
);

function tocar() {
  if (preferencias.vibracion && puedeVibrar.value) vibrate();
  emit('seleccionar', props.mesa);
}
</script>

<template>
  <button
    type="button"
    class="group relative flex flex-col gap-2 rounded-xl border p-3 text-left transition-[background-color,border-color,box-shadow,translate,scale] duration-200 ease-out hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none sm:p-4"
    :class="[
      ESTILO[estadoVisual],
      urgencia?.nivel === 'urgente' && 'border-error/60',
      seleccionada && 'shadow-lg outline-2 outline-primary',
    ]"
    :aria-label="descripcionAccesible"
    @click="tocar"
  >
    <!-- Onda: la mesa acaba de cambiar por un evento en vivo. -->
    <span
      v-if="resaltada"
      aria-hidden="true"
      class="pointer-events-none absolute -inset-px rounded-xl ring-2 ring-primary motion-safe:animate-onda"
    />

    <!-- min-h-7: el nombre queda a la misma altura con avatar (ocupada) o sin él (libre). -->
    <span class="flex min-h-7 items-center justify-between gap-2">
      <span class="min-w-0 truncate text-lg leading-tight font-bold text-highlighted">
        {{ mesa.nombre }}
      </span>
      <UAvatar v-if="mesero" :alt="mesero" size="sm" class="shrink-0" />
      <span v-else class="inline-flex shrink-0 items-center gap-1 text-sm text-muted">
        <UIcon name="i-lucide-users" class="size-4" />
        {{ mesa.capacidad }}
      </span>
    </span>

    <FiguraMesa
      :capacidad="mesa.capacidad"
      :estado="estadoVisual"
      :icono="icono"
      class="mx-auto my-1 w-full max-w-28"
    />

    <!-- En tarjetas angostas, el tiempo baja completo a otra línea en vez de partirse. -->
    <span class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <ChipEstado :apariencia="apariencia" tamano="sm" />
      <span
        v-if="minutosAbierta !== null"
        class="cifra inline-flex items-center gap-1 text-sm whitespace-nowrap text-muted"
      >
        <UIcon name="i-lucide-timer" class="size-4" />
        {{ duracionCorta(minutosAbierta) }}
      </span>
    </span>

    <BarraCocina v-if="avance?.total && !sinEnviar" :avance="avance" class="mt-1" />

    <span
      v-if="linea"
      class="inline-flex items-center gap-1 text-xs font-semibold"
      :class="linea.clase"
    >
      <UIcon
        :name="linea.icono"
        class="size-3.5 shrink-0"
        :class="linea.late && 'motion-safe:animate-pulse'"
      />
      <span class="truncate">{{ linea.texto }}</span>
    </span>

    <span
      v-if="pagada"
      class="mt-auto inline-flex items-center gap-1 pt-1 font-semibold text-success"
    >
      <UIcon name="i-lucide-circle-check" class="size-4" />
      Pagada
    </span>
    <CifraAnimada
      v-else-if="total"
      :valor="total"
      class="mt-auto pt-1 text-base font-bold text-highlighted"
    />
    <span
      v-else-if="estadoVisual === 'libre'"
      class="mt-auto inline-flex items-center gap-1.5 pt-1 text-sm font-semibold"
      :class="bloqueada ? 'text-muted' : 'text-success'"
    >
      <template v-if="bloqueada">
        <UIcon name="i-lucide-lock" class="size-4" />
        Caja cerrada
      </template>
      <template v-else>
        Nuevo pedido
        <UIcon
          name="i-lucide-arrow-right"
          class="size-4 transition-[translate] duration-200 motion-safe:group-hover:translate-x-0.5"
        />
      </template>
    </span>
  </button>
</template>
