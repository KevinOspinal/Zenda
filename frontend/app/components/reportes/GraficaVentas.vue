<!--
  Gráfica de ventas de una sola serie (en el esmeralda de la marca): por hora en barras o
  por día en área. Trae su información al pasar el dedo o el mouse y, debajo, la misma
  información en una tabla para quien no puede ver la gráfica.
-->
<script setup>
const props = defineProps({
  titulo: { type: String, required: true },
  descripcion: { type: String, default: '' },
  tipo: {
    type: /** @type {import('vue').PropType<'bar' | 'area'>} */ (String),
    default: 'bar',
  },
  /** Filas: { etiqueta, ventas, total } (total en número, solo para dibujar). */
  filas: {
    type: /** @type {import('vue').PropType<{ etiqueta: string, ventas: number, total: number }[]>} */ (
      Array
    ),
    required: true,
  },
});

/** Valores del eje y del cuadro de información, en pesos. */
const formatearValor = (/** @type {number} */ valor) => formatearPesos(Math.round(valor));
const totalDeFilas = computed(() => props.filas.reduce((suma, fila) => suma + fila.ventas, 0));
</script>

<template>
  <section class="space-y-3 rounded-xl bg-default p-5 ring-1 ring-default">
    <header>
      <h2 class="text-lg font-semibold text-highlighted">{{ titulo }}</h2>
      <p v-if="descripcion" class="text-sm text-muted">{{ descripcion }}</p>
    </header>

    <UChart
      :type="tipo"
      :data="filas"
      index="etiqueta"
      :categories="[{ key: 'total', label: 'Ventas' }]"
      :format="formatearValor"
      :height="260"
      :curve="tipo === 'area' ? 'monotone' : 'linear'"
      :aria-label="titulo"
      :aria-description="`${totalDeFilas} ventas en el periodo`"
    />

    <details class="text-sm">
      <summary class="cursor-pointer text-muted hover:text-default">
        Ver los datos en una tabla
      </summary>
      <table class="mt-2 w-full text-left">
        <thead class="text-muted">
          <tr>
            <th class="py-1 font-medium">{{ tipo === 'bar' ? 'Hora' : 'Día' }}</th>
            <th class="py-1 text-right font-medium">Ventas</th>
            <th class="py-1 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody class="cifra divide-y divide-default">
          <tr v-for="fila in filas" :key="fila.etiqueta">
            <td class="py-1">{{ fila.etiqueta }}</td>
            <td class="py-1 text-right">{{ fila.ventas }}</td>
            <td class="py-1 text-right">{{ formatearValor(fila.total) }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </section>
</template>
