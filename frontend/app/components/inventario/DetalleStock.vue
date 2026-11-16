<!--
  Detalle del stock de un producto, el mismo en la vista rápida (tablet horizontal y PC) y en
  la hoja de abajo (celular):
  - El stock en grande, con su estado y qué hacer (por ejemplo, contar y ajustar si quedó
    negativo).
  - Lo vendido y lo comprado en los últimos 7 días.
  - La gráfica de cómo ha cambiado (GraficaStock) y el historial por día (HistorialStock).
  Trae los movimientos al abrirse y otra vez cuando el stock cambia (una compra, un ajuste o
  una venta en vivo), así el historial siempre cuadra con el número de arriba.
-->
<script setup>
const props = defineProps({
  producto: {
    type: /** @type {import('vue').PropType<import('~/utils/inventario.js').ProductoDeInventario>} */ (
      Object
    ),
    required: true,
  },
});

const estado = computed(() => estadoDeStock(props.producto.stock));
const apariencia = computed(() => ESTADOS_STOCK[estado.value]);
const stockAnimable = computed(() => aDecimal(props.producto.stock).toNumber());

// Fondo del bloque del stock y color del número. Clases completas para Tailwind.
const FONDO = Object.freeze({
  revisar: 'border-error/25 bg-error/10',
  agotado: 'border-dashed border-accented bg-elevated/60',
  bajo: 'border-warning/25 bg-warning/10',
  con_stock: 'border-success/25 bg-success/10',
});
const COLOR_NUMERO = Object.freeze({
  revisar: 'text-error',
  agotado: 'text-dimmed',
  bajo: 'text-warning',
  con_stock: 'text-highlighted',
});

// ── Movimientos ──
const movimientos = ref(
  /** @type {import('~/utils/inventario.js').MovimientoDeInventario[]} */ ([]),
);
/** cargando · listo · error */
const estadoMovimientos = ref('cargando');
/** Para no pisar los movimientos de un producto con los de otro que se pidió antes. */
let ultimaPeticion = 0;

async function cargarMovimientos() {
  const peticion = ++ultimaPeticion;
  // Al cambiar de producto se muestra el esqueleto; al cambiar solo el stock, lo de antes.
  if (estadoMovimientos.value !== 'listo') estadoMovimientos.value = 'cargando';
  try {
    const respuesta = await useApi().get(`/inventario/${props.producto.id}/movimientos`);
    if (peticion !== ultimaPeticion) return;
    movimientos.value = respuesta;
    estadoMovimientos.value = 'listo';
  } catch {
    if (peticion === ultimaPeticion) estadoMovimientos.value = 'error';
  }
}
watch(
  () => props.producto.id,
  () => {
    estadoMovimientos.value = 'cargando';
    movimientos.value = [];
    cargarMovimientos();
  },
  { immediate: true },
);
watch(
  () => props.producto.stock,
  () => cargarMovimientos(),
);

const historial = computed(() => historialConStock(movimientos.value, props.producto.stock));
const puntos = computed(() => puntosDeStock(historial.value, props.producto.stock));
const semana = computed(() => resumenDeLaSemana(movimientos.value));
</script>

<template>
  <div class="space-y-5">
    <!-- El stock en grande y qué hacer. -->
    <section class="rounded-xl border p-4" :class="FONDO[estado]">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-medium text-toned">Stock actual</h3>
        <ChipEstado :apariencia="apariencia" tamano="sm" />
      </div>
      <p class="mt-1 flex items-baseline gap-2">
        <NumeroAnimado
          :valor="stockAnimable"
          :formato="formatearCantidad"
          class="text-5xl leading-none font-bold tracking-tight"
          :class="COLOR_NUMERO[estado]"
        />
        <span class="text-muted">{{ stockAnimable === 1 ? 'unidad' : 'unidades' }}</span>
      </p>
      <p v-if="apariencia.ayuda" class="mt-2 text-sm text-toned">{{ apariencia.ayuda }}</p>
    </section>

    <div v-if="estadoMovimientos === 'cargando'" class="space-y-3" aria-busy="true">
      <USkeleton class="h-14 rounded-lg" />
      <USkeleton class="h-24 rounded-lg" />
      <USkeleton v-for="n in 3" :key="n" class="h-10 rounded-lg" />
    </div>

    <UAlert
      v-else-if="estadoMovimientos === 'error'"
      color="error"
      variant="subtle"
      icon="i-lucide-wifi-off"
      title="No pudimos traer el historial"
      :actions="[{ label: 'Reintentar', icon: 'i-lucide-rotate-cw', onClick: cargarMovimientos }]"
    />

    <UEmpty
      v-else-if="!movimientos.length"
      variant="naked"
      icon="i-lucide-history"
      title="Sin movimientos todavía"
      description="Aquí aparecen las ventas, las compras y los ajustes."
    />

    <template v-else>
      <dl class="grid grid-cols-2 gap-3">
        <div class="rounded-lg bg-elevated/60 p-3">
          <dt class="text-xs text-muted">Vendidas en 7 días</dt>
          <dd class="cifra mt-0.5 text-xl font-bold text-highlighted">
            <span v-if="semana.incompleto" class="text-sm font-medium text-muted">al menos </span
            >{{ formatearCantidad(semana.vendidas) }}
          </dd>
        </div>
        <div class="rounded-lg bg-elevated/60 p-3">
          <dt class="text-xs text-muted">Compradas en 7 días</dt>
          <dd class="cifra mt-0.5 text-xl font-bold text-highlighted">
            {{ formatearCantidad(semana.compradas) }}
          </dd>
        </div>
      </dl>

      <section v-if="puntos.length > 1" class="space-y-2">
        <h3 class="text-sm font-semibold text-highlighted">Cómo ha cambiado</h3>
        <GraficaStock :key="producto.id" :puntos="puntos" />
      </section>

      <section class="space-y-2">
        <h3 class="text-sm font-semibold text-highlighted">
          Movimientos
          <span class="cifra font-normal text-muted">· {{ movimientos.length }}</span>
        </h3>
        <HistorialStock :historial="historial" />
      </section>
    </template>
  </div>
</template>
