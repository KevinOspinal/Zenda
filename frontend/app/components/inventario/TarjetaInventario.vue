<!--
  Tarjeta de un producto del inventario.

  - Arriba, el ícono y el tono de su categoría de la carta (los productos no tienen foto), el
    nombre y la categoría (o «Inactivo», si ya no se vende).
  - En el centro, el stock en grande con el chip de su estado: por revisar (negativo), agotado,
    bajo o con stock. Si quedó negativo, cuántas se vendieron sin stock registrado.
  - Abajo, «Compra» y «Ajustar», para quien puede registrar movimientos.

  Toda la tarjeta abre la vista rápida (el nombre es un botón que la cubre entera), menos los
  botones de abajo, que van por encima. Movimiento: se eleva un poco al pasar el mouse y, cuando
  su stock cambia (`resaltado`), el número cuenta hasta el nuevo y sale una onda desde el borde.
  Agotado se ve como un estante vacío: borde punteado y número en gris.
-->
<script setup>
/** @typedef {import('~/utils/inventario.js').ProductoDeInventario} ProductoDeInventario */

const props = defineProps({
  producto: {
    type: /** @type {import('vue').PropType<ProductoDeInventario>} */ (Object),
    required: true,
  },
  /** Su categoría de la carta, o null si no se conoce. */
  categoria: {
    type: /** @type {import('vue').PropType<import('~/utils/inventario.js').CategoriaDeProducto | null>} */ (
      Object
    ),
    default: null,
  },
  /** Su stock cambió hace un instante. */
  resaltado: { type: Boolean, default: false },
  /** Es el producto de la vista rápida. */
  seleccionado: { type: Boolean, default: false },
  /** Muestra «Compra» y «Ajustar». */
  puedeRegistrar: { type: Boolean, default: false },
});

const emit = defineEmits({
  /** @param {ProductoDeInventario} _producto */
  seleccionar: (_producto) => true,
  /**
   * @param {ProductoDeInventario} _producto
   * @param {'compra' | 'ajuste'} _tipo
   */
  registrar: (_producto, _tipo) => true,
});

const preferencias = usePreferenciasStore();
const { vibrate, isSupported: puedeVibrar } = useVibrate({ pattern: [12] });

const estado = computed(() => estadoDeStock(props.producto.stock));
const apariencia = computed(() => ESTADOS_STOCK[estado.value]);
const icono = computed(() => props.categoria?.apariencia ?? null);
/** El stock como número, solo para animarlo (el valor exacto lo escribe formatearCantidad). */
const stockAnimable = computed(() => aDecimal(props.producto.stock).toNumber());
/** Cuántas se vendieron sin stock registrado (solo si quedó negativo). */
const vendidasDeMas = computed(() =>
  estado.value === 'revisar' ? aDecimal(props.producto.stock).negated() : null,
);

// Fondo y borde según el estado. Clases completas para que Tailwind las encuentre.
const ESTILO = Object.freeze({
  revisar: 'border-error/40 bg-error/5 hover:border-error/70',
  agotado: 'border-dashed border-accented bg-default hover:border-inverted/40',
  bajo: 'border-warning/40 bg-warning/5 hover:border-warning/70',
  con_stock: 'border-default bg-default hover:border-success/50',
});
const COLOR_NUMERO = Object.freeze({
  revisar: 'text-error',
  agotado: 'text-dimmed',
  bajo: 'text-warning',
  con_stock: 'text-highlighted',
});

/** Para lectores de pantalla: "Agua, Bebidas, stock -24, Revisar". */
const descripcionAccesible = computed(() =>
  [
    props.producto.nombre,
    props.categoria?.nombre,
    props.producto.activo ? null : 'inactivo',
    `stock ${formatearCantidad(props.producto.stock)}`,
    apariencia.value.etiqueta,
  ]
    .filter(Boolean)
    .join(', '),
);

function tocar() {
  if (preferencias.vibracion && puedeVibrar.value) vibrate();
  emit('seleccionar', props.producto);
}
</script>

<template>
  <article
    class="group relative flex flex-col gap-3 rounded-xl border p-3 transition-[background-color,border-color,box-shadow,translate,scale] duration-200 ease-out hover:shadow-md has-[.principal:active]:scale-[0.98] motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none sm:p-4"
    :class="[ESTILO[estado], seleccionado && 'shadow-lg outline-2 outline-primary']"
  >
    <!-- Onda: su stock acaba de cambiar. -->
    <span
      v-if="resaltado"
      aria-hidden="true"
      class="pointer-events-none absolute -inset-px rounded-xl ring-2 ring-primary motion-safe:animate-onda"
    />

    <div class="flex items-start gap-3">
      <span
        class="grid size-11 shrink-0 place-items-center rounded-xl"
        :class="icono ? [icono.fondo, icono.texto] : 'bg-elevated text-muted'"
      >
        <UIcon :name="icono?.icono ?? 'i-lucide-package'" class="size-6" />
      </span>
      <div class="min-w-0 flex-1">
        <h3 class="leading-tight font-bold text-highlighted">
          <!-- Botón que cubre la tarjeta entera (su ::after): tocar en cualquier lado la abre. -->
          <button
            type="button"
            class="principal line-clamp-2 text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-primary"
            :aria-label="descripcionAccesible"
            @click="tocar"
          >
            {{ producto.nombre }}
          </button>
        </h3>
        <p class="mt-0.5 truncate text-xs text-muted">
          {{ categoria?.nombre ?? 'Sin categoría' }}
          <template v-if="!producto.activo"> · Inactivo</template>
        </p>
      </div>
    </div>

    <div class="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
      <p class="flex items-baseline gap-1.5">
        <NumeroAnimado
          :valor="stockAnimable"
          :formato="formatearCantidad"
          class="text-4xl leading-none font-bold tracking-tight"
          :class="COLOR_NUMERO[estado]"
        />
        <span class="text-sm text-muted">{{ stockAnimable === 1 ? 'unidad' : 'unidades' }}</span>
      </p>
      <ChipEstado :apariencia="apariencia" tamano="sm" />
    </div>

    <p
      v-if="vendidasDeMas"
      class="-mt-1 inline-flex items-center gap-1 text-xs font-semibold text-error"
    >
      <UIcon name="i-lucide-circle-alert" class="size-3.5 shrink-0" />
      <span class="truncate">
        {{ formatearCantidad(vendidasDeMas) }}
        {{ vendidasDeMas.equals(1) ? 'vendida' : 'vendidas' }} sin stock registrado
      </span>
    </p>

    <!-- relative z-10: por encima del botón que cubre la tarjeta. -->
    <div v-if="puedeRegistrar" class="relative z-10 mt-auto grid grid-cols-2 gap-2">
      <UButton
        size="lg"
        :color="estado === 'con_stock' ? 'neutral' : 'primary'"
        variant="soft"
        icon="i-lucide-truck"
        label="Compra"
        class="min-h-11 justify-center"
        :aria-label="`Registrar una compra de ${producto.nombre}`"
        @click="emit('registrar', producto, 'compra')"
      />
      <UButton
        size="lg"
        color="neutral"
        variant="ghost"
        icon="i-lucide-scale"
        label="Ajustar"
        class="min-h-11 justify-center"
        :aria-label="`Ajustar el stock de ${producto.nombre}`"
        @click="emit('registrar', producto, 'ajuste')"
      />
    </div>
  </article>
</template>
