<!--
  Cómo va el turno, para cuando no hay un pedido elegido: lo cobrado con cada método de pago
  (barra apilada con los colores de los reportes y su leyenda), cuántos pedidos se cobraron y
  se anularon, y los atajos de teclado de la caja.
-->
<script setup>
const props = defineProps({
  /** Resumen del turno (GET /caja/actual). */
  resumen: {
    type: /** @type {import('vue').PropType<import('~/stores/caja.js').ResumenTurno>} */ (Object),
    required: true,
  },
  /** El negocio entrega recibos de venta: se muestra su atajo. */
  conRecibos: { type: Boolean, default: false },
});

/** @typedef {keyof typeof METODOS_PAGO} MetodoPago */
const ORDEN_METODOS = /** @type {MetodoPago[]} */ ([
  'efectivo',
  'tarjeta',
  'transferencia',
  'otro',
]);

const total = computed(() => aDecimal(props.resumen.totalCobrado));
const metodos = computed(() =>
  ORDEN_METODOS.map((metodo) => {
    const monto = aDecimal(props.resumen.ventasPorMetodo[metodo] ?? 0);
    return {
      metodo,
      monto,
      participacion: total.value.greaterThan(0) ? monto.dividedBy(total.value).times(100) : null,
    };
  }),
);
/** Solo los métodos con cobros van en la barra (sin segmentos vacíos). */
const conCobros = computed(() => metodos.value.filter((m) => m.monto.greaterThan(0)));

const atajos = computed(() => [
  { tecla: 'N', accion: 'Venta de mostrador' },
  { tecla: 'D', accion: 'Nuevo domicilio' },
  { tecla: 'C', accion: 'Cobrar el pedido elegido' },
  ...(props.conRecibos ? [{ tecla: 'R', accion: 'Últimos recibos' }] : []),
]);
</script>

<template>
  <section class="space-y-5">
    <header class="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h2 class="text-lg font-semibold text-highlighted">Cómo va el turno</h2>
        <p class="text-sm text-muted">Lo cobrado con cada método, propinas incluidas.</p>
      </div>
      <span class="cifra text-lg font-bold text-highlighted">{{ formatearPesos(total) }}</span>
    </header>

    <p v-if="!conCobros.length" class="rounded-lg bg-elevated p-4 text-center text-sm text-muted">
      Aún no hay cobros en este turno.
    </p>

    <template v-else>
      <!-- Barra apilada: los segmentos se separan con el fondo de la tarjeta (2 px). -->
      <div
        class="flex h-4 gap-0.5 overflow-hidden rounded bg-default"
        role="img"
        :aria-label="
          conCobros
            .map(
              (m) =>
                `${METODOS_PAGO[m.metodo].etiqueta} ${formatearPorcentaje(m.participacion ?? 0)}`,
            )
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
        <li v-for="metodo in metodos" :key="metodo.metodo" class="flex items-center gap-3 p-1">
          <span
            class="size-3 shrink-0 rounded-sm"
            :style="{ background: COLOR_METODO[metodo.metodo] }"
            aria-hidden="true"
          />
          <UIcon :name="METODOS_PAGO[metodo.metodo].icono" class="size-4 text-muted" />
          <span class="min-w-0 flex-1 font-medium text-highlighted">
            {{ METODOS_PAGO[metodo.metodo].etiqueta }}
          </span>
          <span class="cifra text-right">
            <span class="block font-semibold text-highlighted">
              {{ formatearPesos(metodo.monto) }}
            </span>
            <span class="text-xs text-muted">
              {{ formatearPorcentaje(metodo.participacion ?? 0) }}
            </span>
          </span>
        </li>
      </ul>
    </template>

    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-lg bg-elevated p-3">
        <p class="cifra text-xl font-bold text-highlighted">{{ resumen.pedidos.pagados }}</p>
        <p class="text-sm text-muted">
          {{ resumen.pedidos.pagados === 1 ? 'Pedido cobrado' : 'Pedidos cobrados' }}
        </p>
      </div>
      <div class="rounded-lg bg-elevated p-3">
        <p class="cifra text-xl font-bold text-highlighted">{{ resumen.pedidos.anulados }}</p>
        <p class="text-sm text-muted">
          {{ resumen.pedidos.anulados === 1 ? 'Pedido anulado' : 'Pedidos anulados' }}
        </p>
      </div>
    </div>

    <!-- Los atajos solo sirven con teclado: en PC. -->
    <div class="hidden border-t border-default pt-4 lg:block">
      <p class="mb-2 text-sm font-medium text-muted">Atajos de teclado</p>
      <ul class="grid gap-2 sm:grid-cols-2">
        <li v-for="atajo in atajos" :key="atajo.tecla" class="flex items-center gap-2 text-sm">
          <UKbd :value="atajo.tecla" />
          <span class="text-toned">{{ atajo.accion }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>
