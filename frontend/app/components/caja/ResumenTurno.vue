<!--
  Resumen del turno abierto en tarjetas: lo vendido (en cuántas ventas y el promedio), el
  efectivo que debería haber en el cajón (y de dónde sale), lo que falta por cobrar y las
  propinas. Se actualiza en vivo.
  El promedio y lo que falta por cobrar son ayuda visual: se calculan aquí con Decimal.
-->
<script setup>
const props = defineProps({
  /** Resumen del turno (GET /caja/actual). */
  resumen: {
    type: /** @type {import('vue').PropType<import('~/stores/caja.js').ResumenTurno>} */ (Object),
    required: true,
  },
  /** Efectivo con el que se abrió el turno. */
  montoInicial: { type: String, required: true },
  /** Pedidos abiertos de la caja: de aquí sale cuánto falta por cobrar. */
  porCobrar: { type: /** @type {import('vue').PropType<any[]>} */ (Array), required: true },
});

const ventas = computed(() => props.resumen.pedidos.pagados);
const promedio = computed(() =>
  ventas.value > 0
    ? aDecimal(props.resumen.totalVendido).dividedBy(ventas.value).toDecimalPlaces(0)
    : null,
);
const totalPorCobrar = computed(() => sumar(props.porCobrar.map((pedido) => pedido.total)));
const cuentasAbiertas = computed(() => props.porCobrar.length);

const tarjetas = computed(() => [
  {
    titulo: 'Vendido en el turno',
    valor: props.resumen.totalVendido,
    icono: 'i-lucide-trending-up',
    detalle:
      promedio.value === null
        ? 'Aún no hay ventas'
        : `${ventas.value} ${ventas.value === 1 ? 'venta' : 'ventas'} · promedio ${formatearPesos(promedio.value)}`,
    pendiente: false,
  },
  {
    titulo: 'Efectivo en el cajón',
    valor: props.resumen.efectivoEsperado,
    icono: 'i-lucide-banknote',
    detalle: `Base ${formatearPesos(props.montoInicial)} + ${formatearPesos(props.resumen.ventasPorMetodo.efectivo)} cobrados`,
    pendiente: false,
  },
  {
    titulo: 'Por cobrar',
    valor: totalPorCobrar.value,
    icono: 'i-lucide-receipt',
    detalle:
      cuentasAbiertas.value === 0
        ? 'Todo cobrado'
        : `${cuentasAbiertas.value} ${cuentasAbiertas.value === 1 ? 'cuenta abierta' : 'cuentas abiertas'}`,
    // Se resalta mientras haya cuentas abiertas: no se puede cerrar la caja con ellas.
    pendiente: cuentasAbiertas.value > 0,
  },
  {
    titulo: 'Propinas',
    valor: props.resumen.propinas,
    icono: 'i-lucide-hand-coins',
    detalle: 'Para repartir al cierre',
    pendiente: false,
  },
]);
</script>

<template>
  <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
    <div
      v-for="tarjeta in tarjetas"
      :key="tarjeta.titulo"
      class="flex flex-col gap-3 rounded-xl p-4 ring-1"
      :class="tarjeta.pendiente ? 'bg-warning/5 ring-warning/40' : 'bg-default ring-default'"
    >
      <div class="flex items-center gap-2">
        <span
          class="grid size-8 shrink-0 place-items-center rounded-lg"
          :class="tarjeta.pendiente ? 'bg-warning/15' : 'bg-primary/10'"
        >
          <UIcon
            :name="tarjeta.icono"
            class="size-4"
            :class="tarjeta.pendiente ? 'text-warning' : 'text-primary'"
          />
        </span>
        <p class="truncate text-sm font-medium text-muted">{{ tarjeta.titulo }}</p>
      </div>
      <div class="min-w-0">
        <CifraAnimada
          :valor="tarjeta.valor"
          class="block truncate text-2xl font-bold text-highlighted"
        />
        <p class="cifra mt-0.5 truncate text-xs text-muted">{{ tarjeta.detalle }}</p>
      </div>
    </div>
  </div>
</template>
