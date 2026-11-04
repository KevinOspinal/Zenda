<!--
  Lo que más piden con los platos (GET /reportes/por-opcion):
  - Adiciones con precio: barras de un solo tono por el dinero extra que dejaron.
  - Opciones sin costo (término, quitar ingredientes): cuántas veces se pidió cada una.
  El orden viene del backend: primero lo que más dinero dejó y luego lo más pedido.
-->
<script setup>
const props = defineProps({
  /** Opciones del reporte: { grupo, nombre, cantidad, total }. */
  opciones: { type: /** @type {import('vue').PropType<any[]>} */ (Array), required: true },
  /** Dinero extra que dejaron las adiciones en el periodo. */
  total: { type: String, required: true },
});

/** Cuántas se muestran de cada parte. */
const LIMITE_ADICIONES = 8;
const LIMITE_SIN_COSTO = 12;

const adiciones = computed(() =>
  props.opciones.filter((opcion) => aDecimal(opcion.total).gt(0)).slice(0, LIMITE_ADICIONES),
);
const sinCosto = computed(() =>
  props.opciones
    .filter((opcion) => aDecimal(opcion.total).isZero())
    .sort((a, b) => aDecimal(b.cantidad).comparedTo(a.cantidad))
    .slice(0, LIMITE_SIN_COSTO),
);

/** Largo de la barra frente a la adición que más dejó (esa llena la barra). */
const largo = (/** @type {string} */ total) => {
  const maximo = adiciones.value[0]?.total ?? '0';
  return aDecimal(maximo).isZero() ? 0 : aDecimal(total).dividedBy(maximo).times(100).toNumber();
};
</script>

<template>
  <section class="space-y-4 rounded-xl bg-default p-5 ring-1 ring-default">
    <header>
      <h2 class="text-lg font-semibold text-highlighted">Adiciones y opciones</h2>
      <p class="text-sm text-muted">
        Lo que más piden con los platos.
        <template v-if="adiciones.length">
          Las adiciones dejaron
          <span class="cifra font-semibold text-highlighted">{{ formatearPesos(total) }}</span>
          extra.
        </template>
      </p>
    </header>

    <ol v-if="adiciones.length" class="space-y-3" aria-label="Adiciones con precio">
      <li
        v-for="adicion in adiciones"
        :key="`${adicion.grupo}·${adicion.nombre}`"
        class="space-y-1.5"
      >
        <div class="flex items-baseline gap-3">
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium text-highlighted">{{ adicion.nombre }}</span>
            <span class="text-xs text-muted">
              {{ adicion.grupo }} · {{ formatearCantidad(adicion.cantidad) }}
              {{ aDecimal(adicion.cantidad).equals(1) ? 'vez' : 'veces' }}
            </span>
          </span>
          <span class="cifra font-semibold text-highlighted">
            +{{ formatearPesos(adicion.total) }}
          </span>
        </div>
        <!-- Barra: cuadrada en el inicio y redondeada al final, como pide la guía de gráficas. -->
        <div class="h-2.5 rounded-e bg-elevated" aria-hidden="true">
          <div class="h-full rounded-e bg-primary" :style="{ width: `${largo(adicion.total)}%` }" />
        </div>
      </li>
    </ol>

    <div v-if="sinCosto.length" class="space-y-2">
      <h3 class="text-sm font-medium text-toned">Sin costo extra</h3>
      <ul class="flex flex-wrap gap-2">
        <li
          v-for="opcion in sinCosto"
          :key="`${opcion.grupo}·${opcion.nombre}`"
          class="rounded-md bg-elevated px-2.5 py-1 text-sm"
          :title="opcion.grupo"
        >
          <span class="text-highlighted">{{ opcion.nombre }}</span>
          <span class="cifra ms-1 text-muted">× {{ formatearCantidad(opcion.cantidad) }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>
