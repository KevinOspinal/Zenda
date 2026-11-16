<!--
  Historial de un producto como línea de tiempo, agrupado por día (Hoy, Ayer, lun 26 oct): cada
  movimiento con su ícono (venta, compra, ajuste o anulación de una venta), la hora, cuánto
  entró o salió y cuánto quedó después. Los días aparecen en cascada al abrirlo.
-->
<script setup>
const props = defineProps({
  /** Movimientos del más reciente al más antiguo, con su stock después (historialConStock). */
  historial: {
    type: /** @type {import('vue').PropType<(import('~/utils/inventario.js').MovimientoDeInventario & { stockDespues: string })[]>} */ (
      Array
    ),
    required: true,
  },
});

const dias = computed(() => agruparPorDia(props.historial));

/** "+12" para las entradas, "-3" para las salidas. */
function cantidadConSigno(/** @type {string} */ cantidad) {
  const valor = aDecimal(cantidad);
  return `${valor.greaterThan(0) ? '+' : ''}${formatearCantidad(valor)}`;
}
</script>

<template>
  <ol class="space-y-4">
    <li
      v-for="(dia, indice) in dias"
      :key="dia.dia"
      class="motion-safe:animate-aparecer"
      :style="{ animationDelay: `${Math.min(indice, 5) * 40}ms` }"
    >
      <h4 class="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
        {{ dia.etiqueta }}
      </h4>
      <!-- La línea vertical une los movimientos del día. -->
      <ol
        class="relative before:absolute before:inset-y-3 before:left-4 before:w-px before:bg-(--ui-border)"
      >
        <li
          v-for="movimiento in dia.movimientos"
          :key="movimiento.id"
          class="relative flex items-center gap-3 py-1.5"
        >
          <span
            class="relative grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-(--ui-bg)"
            :class="TIPOS_MOVIMIENTO[claseDeMovimiento(movimiento)].tono"
          >
            <UIcon :name="TIPOS_MOVIMIENTO[claseDeMovimiento(movimiento)].icono" class="size-4" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-highlighted">
              {{ TIPOS_MOVIMIENTO[claseDeMovimiento(movimiento)].etiqueta }}
            </p>
            <p class="cifra text-xs text-muted">{{ formatearHora(movimiento.fecha) }}</p>
          </div>
          <div class="cifra text-right">
            <p
              class="text-sm font-bold"
              :class="aDecimal(movimiento.cantidad).lessThan(0) ? 'text-error' : 'text-success'"
            >
              {{ cantidadConSigno(movimiento.cantidad) }}
            </p>
            <p class="text-xs text-muted">quedó {{ formatearCantidad(movimiento.stockDespues) }}</p>
          </div>
        </li>
      </ol>
    </li>
  </ol>
</template>
