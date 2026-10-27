<!--
  Cuánto se cobró con cada método de pago: una barra apilada al 100 % (cada método con su
  color de la paleta validada, separados por 2 px) y debajo la lista con el valor y el
  porcentaje de cada uno, que hace de leyenda. Incluye las propinas, porque se pagan junto
  con la cuenta.
-->
<script setup>
const props = defineProps({
  /** Métodos del reporte (GET /reportes/por-metodo-pago): siempre los 4, en orden fijo. */
  metodos: { type: /** @type {import('vue').PropType<any[]>} */ (Array), required: true },
  total: { type: String, required: true },
});

/** Solo los métodos que tuvieron cobros, para la barra (sin segmentos vacíos). */
const conCobros = computed(() => props.metodos.filter((m) => aDecimal(m.total).greaterThan(0)));
</script>

<template>
  <section class="space-y-4 rounded-xl bg-default p-5 ring-1 ring-default">
    <header class="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h2 class="text-lg font-semibold text-highlighted">Métodos de pago</h2>
        <p class="text-sm text-muted">Lo cobrado con cada uno, propinas incluidas.</p>
      </div>
      <span class="cifra text-lg font-bold text-highlighted">{{ formatearPesos(total) }}</span>
    </header>

    <!-- Barra apilada: los segmentos se separan con el fondo de la tarjeta (2 px). -->
    <div
      class="flex h-4 gap-0.5 overflow-hidden rounded bg-default"
      role="img"
      :aria-label="
        conCobros
          .map((m) => `${METODOS_PAGO[m.metodo].etiqueta} ${formatearPorcentaje(m.participacion)}`)
          .join(', ')
      "
    >
      <div
        v-for="metodo in conCobros"
        :key="metodo.metodo"
        class="h-full first:rounded-s last:rounded-e"
        :style="{ width: `${metodo.participacion}%`, background: COLOR_METODO[metodo.metodo] }"
      />
    </div>

    <ul class="grid gap-2 sm:grid-cols-2">
      <li
        v-for="metodo in metodos"
        :key="metodo.metodo"
        class="flex items-center gap-3 rounded-lg p-2"
      >
        <span
          class="size-3 shrink-0 rounded-sm"
          :style="{ background: COLOR_METODO[metodo.metodo] }"
          aria-hidden="true"
        />
        <UIcon :name="METODOS_PAGO[metodo.metodo].icono" class="size-4 text-muted" />
        <span class="min-w-0 flex-1">
          <span class="block font-medium text-highlighted">{{
            METODOS_PAGO[metodo.metodo].etiqueta
          }}</span>
          <span class="text-xs text-muted"
            >{{ metodo.pagos }} {{ metodo.pagos === 1 ? 'pago' : 'pagos' }}</span
          >
        </span>
        <span class="cifra text-right">
          <span class="block font-semibold text-highlighted">{{
            formatearPesos(metodo.total)
          }}</span>
          <span class="text-xs text-muted">{{ formatearPorcentaje(metodo.participacion) }}</span>
        </span>
      </li>
    </ul>
  </section>
</template>
