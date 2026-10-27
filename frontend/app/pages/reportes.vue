<!--
  Tablero del dueño: cómo va el negocio en el periodo elegido.
  - Indicadores: ventas, número de ventas, ticket promedio, propinas y anulaciones.
  - Ventas por hora (con la hora pico) y, si el periodo tiene varios días, por día.
  - Productos más vendidos, métodos de pago y ventas por canal (tipo de pedido y origen).
  Las cifras las calcula el backend (GET /reportes/*); aquí solo se muestran.
-->
<script setup>
definePageMeta({ seccion: 'reportes' });

const rango = ref(rangoDePeriodo('hoy'));
const resumen = ref(/** @type {any} */ (null));
const porProducto = ref(/** @type {any} */ (null));
const porMetodo = ref(/** @type {any} */ (null));
const cargando = ref(true);
const error = ref('');

// Cada carga lleva un número. Si el dueño cambia de periodo antes de que llegue una
// respuesta, esa respuesta se descarta para no mostrar cifras de otro periodo.
let ultimaCarga = 0;

async function cargar() {
  const estaCarga = ++ultimaCarga;
  cargando.value = true;
  error.value = '';
  try {
    const api = useApi();
    const consulta = { desde: rango.value.desde, hasta: rango.value.hasta };
    const respuestas = await Promise.all([
      api.get('/reportes/resumen', consulta),
      api.get('/reportes/por-producto', consulta),
      api.get('/reportes/por-metodo-pago', consulta),
    ]);
    if (estaCarga !== ultimaCarga) return;
    [resumen.value, porProducto.value, porMetodo.value] = respuestas;
  } catch (fallo) {
    if (estaCarga !== ultimaCarga) return;
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  } finally {
    if (estaCarga === ultimaCarga) cargando.value = false;
  }
}
watch(rango, cargar, { immediate: true, deep: true });

const hayVentas = computed(() => (resumen.value?.ventas ?? 0) > 0);
const variosDias = computed(() => diasDelRango(rango.value) > 1);
const pico = computed(() => horaPico(resumen.value?.porHora ?? []));
const porHora = computed(() => completarHoras(resumen.value?.porHora ?? []));
const porDia = computed(() =>
  (resumen.value?.porDia ?? []).map((/** @type {any} */ dia) => ({
    etiqueta: formatearFechaCorta(`${dia.fecha}T12:00:00-05:00`),
    ventas: dia.ventas,
    total: aDecimal(dia.total).toNumber(),
  })),
);
</script>

<template>
  <div class="space-y-6">
    <SelectorPeriodo v-model="rango" />

    <div v-if="cargando && !resumen" class="space-y-4">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <USkeleton v-for="n in 5" :key="n" class="h-28 rounded-xl" />
      </div>
      <USkeleton class="h-80 rounded-xl" />
    </div>

    <UEmpty
      v-else-if="error"
      icon="i-lucide-wifi-off"
      title="No pudimos cargar los reportes"
      :description="error"
      :actions="[{ label: 'Reintentar', icon: 'i-lucide-rotate-cw', onClick: cargar }]"
    />

    <template v-else-if="resumen">
      <div
        class="grid grid-cols-2 gap-3 transition-opacity lg:grid-cols-5"
        :class="cargando && 'opacity-60'"
      >
        <TarjetaIndicador
          class="col-span-2 lg:col-span-1"
          destacada
          titulo="Ventas"
          icono="i-lucide-trending-up"
          :valor="resumen.total"
          :detalle="`Base ${formatearPesos(resumen.subtotal)} · impuesto ${formatearPesos(resumen.impuestos)}`"
        />
        <TarjetaIndicador
          titulo="Número de ventas"
          icono="i-lucide-receipt"
          :texto="String(resumen.ventas)"
          :detalle="pico ? `Hora pico: ${etiquetaDeHora(pico.hora)}` : ''"
        />
        <TarjetaIndicador
          titulo="Ticket promedio"
          icono="i-lucide-scale"
          :valor="resumen.ticketPromedio"
        />
        <TarjetaIndicador
          titulo="Propinas"
          icono="i-lucide-hand-coins"
          :valor="resumen.propinas"
          detalle="Para los trabajadores; no suman a las ventas"
        />
        <TarjetaIndicador
          titulo="Anulaciones"
          icono="i-lucide-ban"
          :texto="String(resumen.anulaciones.cantidad)"
          :detalle="`Por ${formatearPesos(resumen.anulaciones.total)}`"
        />
      </div>

      <UEmpty
        v-if="!hayVentas"
        icon="i-lucide-chart-column"
        title="Aún no hay ventas en este periodo"
        description="Cuando se cobren pedidos, aquí verás cómo va el negocio."
      />

      <template v-else>
        <div class="grid gap-5 xl:grid-cols-2">
          <GraficaVentas
            titulo="Ventas por hora"
            :descripcion="pico ? `La hora pico fue a la(s) ${etiquetaDeHora(pico.hora)}.` : ''"
            tipo="bar"
            :filas="porHora"
          />
          <GraficaVentas
            v-if="variosDias"
            titulo="Ventas por día"
            descripcion="Cómo se movieron las ventas en el periodo."
            tipo="area"
            :filas="porDia"
          />
          <MetodosDePago v-else :metodos="porMetodo.metodos" :total="porMetodo.total" />
        </div>

        <div class="grid gap-5 xl:grid-cols-2">
          <TopProductos :productos="porProducto.productos" />
          <MetodosDePago v-if="variosDias" :metodos="porMetodo.metodos" :total="porMetodo.total" />
          <VentasPorCanal
            v-if="resumen.porTipo && resumen.porOrigen"
            :por-tipo="resumen.porTipo"
            :por-origen="resumen.porOrigen"
          />
        </div>
      </template>
    </template>
  </div>
</template>
