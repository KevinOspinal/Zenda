<!--
  Inventario: el stock de los productos que lo controlan, en rojo si quedó negativo y en
  ámbar si está bajo. Se registran compras y ajustes, y se ve el historial de cada producto.
-->
<script setup>
definePageMeta({ seccion: 'inventario' });

const sesion = useSesionStore();
const pantallaGrande = useMediaQuery('(min-width: 1024px)');
const toast = useToast();
const puedeRegistrar = computed(() => puede(sesion.rol, 'registrarInventario'));

/** Desde cuántas unidades (o menos) el stock se considera bajo. */
const STOCK_BAJO = 5;

const productos = ref(/** @type {any[]} */ ([]));
const cargando = ref(true);
const error = ref('');
async function cargar() {
  error.value = '';
  try {
    productos.value = await useApi().get('/inventario');
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  } finally {
    cargando.value = false;
  }
}
cargar();

/** Apariencia del stock: negativo (rojo), bajo (ámbar) o normal (verde). */
function aparienciaDeStock(/** @type {string} */ stock) {
  const valor = aDecimal(stock);
  if (valor.isNegative())
    return { etiqueta: `${formatearCantidad(stock)} · revisar`, color: 'error' };
  if (valor.lessThanOrEqualTo(STOCK_BAJO))
    return { etiqueta: `${formatearCantidad(stock)} · bajo`, color: 'warning' };
  return { etiqueta: formatearCantidad(stock), color: 'success' };
}

// Registrar compras y ajustes.
const movimientoAbierto = ref(false);
const tipoMovimiento = ref(/** @type {'compra' | 'ajuste'} */ ('compra'));
const productoElegido = ref(/** @type {any} */ (null));
/**
 * @param {any} producto
 * @param {'compra' | 'ajuste'} tipo
 */
function registrarMovimiento(producto, tipo) {
  productoElegido.value = producto;
  tipoMovimiento.value = tipo;
  movimientoAbierto.value = true;
}
function alRegistrar() {
  toast.add({ title: 'Inventario actualizado', icon: 'i-lucide-circle-check', color: 'success' });
  cargar();
}

// Historial de un producto.
const historialAbierto = ref(false);
const movimientos = ref(/** @type {any[]} */ ([]));
const cargandoHistorial = ref(false);
/** @param {any} producto */
async function verHistorial(producto) {
  productoElegido.value = producto;
  historialAbierto.value = true;
  cargandoHistorial.value = true;
  try {
    movimientos.value = await useApi().get(`/inventario/${producto.id}/movimientos`);
  } catch {
    movimientos.value = [];
  } finally {
    cargandoHistorial.value = false;
  }
}

const TIPOS_MOVIMIENTO = Object.freeze({
  venta: { etiqueta: 'Venta', icono: 'i-lucide-shopping-cart' },
  compra: { etiqueta: 'Compra', icono: 'i-lucide-truck' },
  ajuste: { etiqueta: 'Ajuste', icono: 'i-lucide-scale' },
});
</script>

<template>
  <div class="space-y-5">
    <p class="text-muted">
      Productos que descuentan inventario al venderse (actívalo en cada producto del menú).
    </p>

    <div v-if="cargando" class="space-y-2">
      <USkeleton v-for="n in 4" :key="n" class="h-16 rounded-xl" />
    </div>
    <UEmpty
      v-else-if="error"
      icon="i-lucide-wifi-off"
      title="No pudimos cargar el inventario"
      :description="error"
      :actions="[{ label: 'Reintentar', icon: 'i-lucide-rotate-cw', onClick: cargar }]"
    />
    <UEmpty
      v-else-if="!productos.length"
      icon="i-lucide-package"
      title="Ningún producto controla inventario"
      description="En el menú, activa «Controla inventario» en los productos que quieras contar (por ejemplo, bebidas)."
      :actions="[{ label: 'Ir al menú', icon: 'i-lucide-book-open-text', to: '/admin/menu' }]"
    />

    <ul v-else class="space-y-2">
      <li
        v-for="producto in productos"
        :key="producto.id"
        class="flex flex-wrap items-center gap-3 rounded-xl bg-default p-3 ring-1 ring-default"
      >
        <UIcon name="i-lucide-package" class="size-6 shrink-0 text-muted" />
        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold text-highlighted">{{ producto.nombre }}</p>
          <UBadge
            :color="/** @type {any} */ (aparienciaDeStock(producto.stock).color)"
            variant="subtle"
            class="cifra"
            :label="`Stock: ${aparienciaDeStock(producto.stock).etiqueta}`"
          />
        </div>
        <div class="flex gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-history"
            :aria-label="`Historial de ${producto.nombre}`"
            @click="verHistorial(producto)"
          />
          <template v-if="puedeRegistrar">
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-scale"
              label="Ajustar"
              @click="registrarMovimiento(producto, 'ajuste')"
            />
            <UButton
              icon="i-lucide-truck"
              label="Compra"
              @click="registrarMovimiento(producto, 'compra')"
            />
          </template>
        </div>
      </li>
    </ul>

    <MovimientoInventario
      v-model:abierto="movimientoAbierto"
      :producto="productoElegido"
      :tipo="tipoMovimiento"
      @registrado="alRegistrar"
    />

    <USlideover
      v-model:open="historialAbierto"
      :side="pantallaGrande ? 'right' : 'bottom'"
      :title="`Historial de ${productoElegido?.nombre ?? ''}`"
    >
      <template #body>
        <div v-if="cargandoHistorial" class="space-y-2">
          <USkeleton v-for="n in 5" :key="n" class="h-12 rounded-lg" />
        </div>
        <UEmpty
          v-else-if="!movimientos.length"
          variant="naked"
          icon="i-lucide-history"
          title="Sin movimientos"
        />
        <ul v-else class="divide-y divide-default">
          <li
            v-for="movimiento in movimientos"
            :key="movimiento.id"
            class="flex items-center gap-3 py-3"
          >
            <UIcon
              :name="TIPOS_MOVIMIENTO[movimiento.tipo]?.icono ?? 'i-lucide-package'"
              class="size-5 text-muted"
            />
            <div class="min-w-0 flex-1">
              <p class="font-medium text-highlighted">
                {{ TIPOS_MOVIMIENTO[movimiento.tipo]?.etiqueta ?? movimiento.tipo }}
              </p>
              <p class="text-sm text-muted">{{ fechaRelativa(movimiento.fecha) }}</p>
            </div>
            <span
              class="cifra font-bold"
              :class="aDecimal(movimiento.cantidad).isNegative() ? 'text-error' : 'text-success'"
            >
              {{ aDecimal(movimiento.cantidad).isNegative() ? '' : '+'
              }}{{ formatearCantidad(movimiento.cantidad) }}
            </span>
          </li>
        </ul>
      </template>
    </USlideover>
  </div>
</template>
