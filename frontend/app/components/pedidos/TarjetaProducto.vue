<!--
  Producto del menú para tomar pedidos.
  - Tocar la tarjeta agrega una unidad (con una vibración leve en celulares Android).
  - El botón de nota abre las opciones: cantidad y notas para la cocina.
  - Un contador muestra cuántas van en el pedido y salta un poco al cambiar.
  Los productos no tienen foto: se muestra el ícono y el tono de su categoría.
-->
<script setup>
/** @typedef {{ id: string, nombre: string, descripcion?: string | null, precio: string }} Producto */
/** @typedef {{ icono: string, fondo: string, texto: string }} AparienciaCategoria */

const props = defineProps({
  producto: { type: /** @type {import('vue').PropType<Producto>} */ (Object), required: true },
  apariencia: {
    type: /** @type {import('vue').PropType<AparienciaCategoria>} */ (Object),
    required: true,
  },
  /** Unidades de este producto que ya están en el pedido. */
  cantidad: { type: Number, default: 0 },
});

const emit = defineEmits({
  /** @param {Producto} _producto */
  agregar: (_producto) => true,
  /** @param {Producto} _producto */
  personalizar: (_producto) => true,
});

// Vibración muy corta al agregar: confirma el toque sin mirar la pantalla.
const { vibrate, isSupported } = useVibrate({ pattern: [12] });

function agregar() {
  if (isSupported.value) vibrate();
  emit('agregar', props.producto);
}
</script>

<template>
  <div
    class="relative flex items-stretch rounded-xl bg-default ring-1 ring-default transition hover:ring-accented"
  >
    <button
      type="button"
      class="flex min-h-20 flex-1 items-center gap-3 rounded-xl p-3 text-left transition focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.98] motion-reduce:transition-none"
      :aria-label="`Agregar ${producto.nombre}, ${formatearPesos(producto.precio)}`"
      @click="agregar"
    >
      <span class="grid size-14 shrink-0 place-items-center rounded-lg" :class="apariencia.fondo">
        <UIcon :name="apariencia.icono" class="size-7" :class="apariencia.texto" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block leading-snug font-semibold text-highlighted">{{ producto.nombre }}</span>
        <span v-if="producto.descripcion" class="line-clamp-2 text-sm text-muted">
          {{ producto.descripcion }}
        </span>
        <span class="cifra mt-1 block font-semibold text-primary">
          {{ formatearPesos(producto.precio) }}
        </span>
      </span>
    </button>

    <div class="flex items-center pe-2">
      <UButton
        icon="i-lucide-message-square-plus"
        color="neutral"
        variant="ghost"
        class="size-11 justify-center"
        :aria-label="`Agregar ${producto.nombre} con nota o cantidad`"
        @click="emit('personalizar', producto)"
      />
    </div>

    <!-- Cuántas van en el pedido. El :key reinicia la animación de entrada en cada cambio. -->
    <Transition
      enter-from-class="scale-150 opacity-0"
      enter-active-class="transition duration-200 motion-reduce:transition-none"
    >
      <span
        v-if="cantidad > 0"
        :key="cantidad"
        class="cifra absolute -top-2 -left-2 grid h-7 min-w-7 place-items-center rounded-full bg-primary px-1.5 text-sm font-bold text-inverted shadow-md"
        aria-hidden="true"
      >
        ×{{ formatearCantidad(cantidad) }}
      </span>
    </Transition>
  </div>
</template>
