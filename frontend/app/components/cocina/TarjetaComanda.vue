<!--
  Comanda en el tablero de cocina: mesa, hora, tiempo de espera con el color de su urgencia
  y los platos por entregar con cantidad grande y notas resaltadas.
  - Tocar un plato lo avanza un paso (pendiente → preparando → listo).
  - "Todo listo" termina de una vez lo que falta.
  - Cuando todo está listo: en mostrador, "Ya salió" la quita del tablero; en una mesa, la
    quita el mesero al marcar los platos como entregados.
  - Si el cliente ya pagó (comidas rápidas), lo dice: la comanda sigue hasta que salga.
  Pensada para leerse a 2 metros, en modo oscuro.
-->
<script setup>
const props = defineProps({
  /** Comanda armada por armarTablero (utils/cocina.js). */
  comanda: {
    type: /** @type {import('vue').PropType<import('~/utils/cocina.js').ComandaDelTablero>} */ (
      Object
    ),
    required: true,
  },
  /** Ids de los platos que se están actualizando: no se pueden tocar dos veces. */
  ocupados: {
    type: /** @type {import('vue').PropType<Set<string>>} */ (Set),
    default: () => new Set(),
  },
});

const emit = defineEmits({
  /** @param {any} _item */
  avanzar: (_item) => true,
  todoListo: () => true,
  entregar: () => true,
});

const urgencia = computed(() => urgenciaDeEspera(props.comanda.minutos));
/** Llegó hace menos de un minuto. */
const nueva = computed(() => props.comanda.minutos < 1);
const faltanPlatos = computed(() =>
  props.comanda.items.some((item) => ['pendiente', 'preparando'].includes(item.estadoCocina)),
);
const nombreMesa = computed(() => props.comanda.pedido.mesa?.nombre ?? 'Mostrador');
/** En una mesa, el mesero confirma la entrega; en mostrador la entrega la cocina. */
const enMesa = computed(() => Boolean(props.comanda.pedido.mesa));
const pagado = computed(() => props.comanda.pedido.estado === 'pagado');

// Clases completas para que Tailwind las encuentre.
const BORDE_POR_URGENCIA = Object.freeze({
  normal: 'ring-default',
  atencion: 'ring-warning/60',
  urgente: 'ring-error/70',
});
const TIEMPO_POR_URGENCIA = Object.freeze({
  normal: 'bg-default text-toned ring-default',
  atencion: 'bg-warning/15 text-warning ring-warning/40',
  urgente: 'bg-error/15 text-error ring-error/50',
});
const PLATO_POR_ESTADO = Object.freeze({
  pendiente: 'bg-default ring-default hover:ring-accented',
  preparando: 'bg-warning/10 ring-warning/40 hover:ring-warning/70',
  listo: 'bg-success/10 ring-success/40',
  entregado: 'bg-default ring-default',
});
</script>

<template>
  <article
    class="space-y-3 rounded-xl bg-elevated p-4 ring-2 transition"
    :class="BORDE_POR_URGENCIA[urgencia.nivel]"
    :aria-label="`Comanda de ${nombreMesa}, esperando ${duracionCorta(comanda.minutos)}`"
  >
    <header class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="truncate text-2xl font-bold text-highlighted">{{ nombreMesa }}</h3>
        <p class="text-sm text-muted">
          Pedido de las {{ formatearHora(comanda.pedido.abiertoEn) }}
        </p>
      </div>
      <div class="flex shrink-0 flex-col items-end gap-1.5">
        <span
          class="cifra inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xl font-bold ring-1"
          :class="[
            TIEMPO_POR_URGENCIA[urgencia.nivel],
            urgencia.late && 'motion-safe:animate-pulse',
          ]"
        >
          <UIcon name="i-lucide-timer" class="size-5" />
          {{ duracionCorta(comanda.minutos) }}
        </span>
        <UBadge v-if="nueva" color="info" variant="solid" icon="i-lucide-sparkles" label="Nueva" />
        <UBadge
          v-if="pagado"
          color="success"
          variant="subtle"
          icon="i-lucide-circle-check"
          label="Pagado"
        />
      </div>
    </header>

    <ul class="space-y-2">
      <li v-for="item in comanda.items" :key="item.id">
        <button
          type="button"
          class="flex w-full items-start gap-3 rounded-lg p-3 text-left ring-1 transition active:scale-[0.99] disabled:cursor-default motion-reduce:transition-none"
          :class="PLATO_POR_ESTADO[item.estadoCocina]"
          :disabled="item.estadoCocina === 'listo' || ocupados.has(item.id)"
          :aria-label="`${formatearCantidad(item.cantidad)} ${item.producto.nombre}, ${ESTADOS_COCINA[item.estadoCocina].etiqueta}`"
          @click="emit('avanzar', item)"
        >
          <span class="cifra min-w-9 text-3xl leading-none font-bold text-highlighted">
            {{ formatearCantidad(item.cantidad) }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-xl leading-snug font-semibold text-highlighted">
              {{ item.producto.nombre }}
              <UBadge
                v-if="esAgregadoDespues(item, comanda.pedido.items)"
                color="info"
                variant="subtle"
                label="Agregado"
                class="ms-1 align-middle"
              />
            </span>
            <span
              v-if="item.notas"
              class="mt-1 flex items-start gap-1 text-base font-semibold text-warning"
            >
              <UIcon name="i-lucide-message-square-text" class="mt-0.5 size-4 shrink-0" />
              {{ item.notas }}
            </span>
          </span>
          <UIcon
            v-if="ocupados.has(item.id)"
            name="i-lucide-loader-circle"
            class="size-6 shrink-0 animate-spin text-muted"
          />
          <ChipEstado v-else :apariencia="ESTADOS_COCINA[item.estadoCocina]" tamano="lg" />
        </button>
      </li>
    </ul>

    <UButton
      v-if="faltanPlatos"
      block
      size="xl"
      color="success"
      icon="i-lucide-check-check"
      label="Todo listo"
      @click="emit('todoListo')"
    />
    <p
      v-else-if="enMesa"
      class="flex items-center justify-center gap-2 rounded-lg bg-default py-3 text-base font-medium text-muted"
    >
      <UIcon name="i-lucide-hand-platter" class="size-5" />
      Esperando al mesero
    </p>
    <UButton
      v-else
      block
      size="lg"
      color="neutral"
      variant="soft"
      icon="i-lucide-hand-platter"
      label="Ya salió"
      @click="emit('entregar')"
    />
  </article>
</template>
