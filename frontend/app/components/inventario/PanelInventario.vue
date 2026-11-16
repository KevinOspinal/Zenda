<!--
  Vista rápida de un producto, al lado del inventario (tablet horizontal y PC): el inventario
  sigue a la vista y tocar otro producto cambia lo que se ve aquí. Arriba, el producto con su
  categoría; en el centro, su stock, la gráfica y el historial (DetalleStock); abajo, «Compra» y
  «Ajustar» para quien puede. Los movimientos los registra la página (evento
  `registrar`), con el mismo modal que usan las tarjetas.
-->
<script setup>
/** @typedef {import('~/utils/inventario.js').ProductoDeInventario} ProductoDeInventario */

const props = defineProps({
  producto: {
    type: /** @type {import('vue').PropType<ProductoDeInventario>} */ (Object),
    required: true,
  },
  categoria: {
    type: /** @type {import('vue').PropType<import('~/utils/inventario.js').CategoriaDeProducto | null>} */ (
      Object
    ),
    default: null,
  },
  puedeRegistrar: { type: Boolean, default: false },
});

const emit = defineEmits({
  cerrar: () => true,
  /** @param {'compra' | 'ajuste'} _tipo */
  registrar: (_tipo) => true,
});

const icono = computed(() => props.categoria?.apariencia ?? null);
const detalle = computed(() =>
  [props.categoria?.nombre ?? 'Sin categoría', props.producto.activo ? null : 'Inactivo']
    .filter(Boolean)
    .join(' · '),
);
</script>

<template>
  <!-- Alto máximo: la pantalla menos el encabezado y la explicación de arriba, para que
       «Compra» y «Ajustar» siempre se vean sin bajar. -->
  <aside
    class="flex max-h-[calc(100dvh-9.5rem)] flex-col overflow-hidden rounded-2xl border border-default bg-default shadow-xl"
    :aria-label="`Vista rápida de ${producto.nombre}`"
  >
    <header class="flex items-start gap-3 border-b border-default p-4">
      <span
        class="grid size-12 shrink-0 place-items-center rounded-xl"
        :class="icono ? [icono.fondo, icono.texto] : 'bg-elevated text-muted'"
      >
        <UIcon :name="icono?.icono ?? 'i-lucide-package'" class="size-7" />
      </span>
      <div class="min-w-0 flex-1">
        <h2 class="line-clamp-2 text-xl leading-tight font-bold text-highlighted">
          {{ producto.nombre }}
        </h2>
        <p class="mt-0.5 truncate text-sm text-muted">{{ detalle }}</p>
      </div>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="lg"
        aria-label="Cerrar la vista rápida"
        @click="emit('cerrar')"
      />
    </header>

    <div class="flex-1 overflow-y-auto p-4">
      <DetalleStock :producto="producto" />
    </div>

    <footer v-if="puedeRegistrar" class="grid grid-cols-2 gap-2 border-t border-default p-4">
      <UButton
        block
        size="xl"
        icon="i-lucide-truck"
        label="Compra"
        @click="emit('registrar', 'compra')"
      />
      <UButton
        block
        size="xl"
        color="neutral"
        variant="soft"
        icon="i-lucide-scale"
        label="Ajustar"
        @click="emit('registrar', 'ajuste')"
      />
    </footer>
  </aside>
</template>
