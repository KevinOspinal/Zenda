<!--
  Ranking de productos más vendidos: barras horizontales de un solo tono (el esmeralda de la
  marca), del que más vendió al que menos, con su cantidad, su total y su participación.
  Los tres primeros llevan el número destacado. Se ven los 10 primeros y un botón abre la
  lista completa.
-->
<script setup>
const props = defineProps({
  /** Productos del reporte (GET /reportes/por-producto), ya ordenados. */
  productos: { type: /** @type {import('vue').PropType<any[]>} */ (Array), required: true },
  /** Cuántos se muestran. */
  limite: { type: Number, default: 10 },
});

/** El dueño puede abrir la lista completa de lo vendido en el periodo. */
const mostrarTodos = ref(false);
const visibles = computed(() =>
  mostrarTodos.value ? props.productos : props.productos.slice(0, props.limite),
);
const maximo = computed(() => visibles.value[0]?.total ?? '0');

/** Largo de la barra frente al primero (el primero llena la barra). */
const largo = (/** @type {string} */ total) =>
  aDecimal(maximo.value).isZero()
    ? 0
    : aDecimal(total).dividedBy(maximo.value).times(100).toNumber();
</script>

<template>
  <section class="space-y-4 rounded-xl bg-default p-5 ring-1 ring-default">
    <header>
      <h2 class="text-lg font-semibold text-highlighted">Productos más vendidos</h2>
      <p class="text-sm text-muted">Por lo vendido, con el precio con que se vendió cada uno.</p>
    </header>

    <ol class="space-y-3">
      <li v-for="(producto, posicion) in visibles" :key="producto.productoId" class="space-y-1.5">
        <div class="flex items-baseline gap-3">
          <span
            class="cifra grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold"
            :class="posicion < 3 ? 'bg-primary text-inverted' : 'bg-elevated text-toned'"
          >
            {{ posicion + 1 }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium text-highlighted">{{ producto.producto }}</span>
            <span class="text-xs text-muted">
              {{ producto.categoria }} · {{ formatearCantidad(producto.cantidad) }} vendidos
            </span>
          </span>
          <span class="cifra text-right">
            <span class="block font-semibold text-highlighted">{{
              formatearPesos(producto.total)
            }}</span>
            <span class="text-xs text-muted">{{
              formatearPorcentaje(producto.participacion)
            }}</span>
          </span>
        </div>
        <!-- Barra: cuadrada en el inicio y redondeada al final, como pide la guía de gráficas. -->
        <div class="ms-9 h-2.5 rounded-e bg-elevated" aria-hidden="true">
          <div
            class="h-full rounded-e bg-primary"
            :style="{ width: `${largo(producto.total)}%` }"
          />
        </div>
      </li>
    </ol>

    <UButton
      v-if="productos.length > limite"
      :label="
        mostrarTodos ? `Ver solo los ${limite} primeros` : `Ver los ${productos.length} productos`
      "
      :icon="mostrarTodos ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
      color="neutral"
      variant="ghost"
      block
      @click="mostrarTodos = !mostrarTodos"
    />
  </section>
</template>
