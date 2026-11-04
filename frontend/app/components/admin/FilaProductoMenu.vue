<!--
  Un producto en la administración del menú: nombre, precio, impuesto, sus grupos de
  opciones y su inventario. Al tocarlo se edita; el interruptor lo activa o desactiva.
-->
<script setup>
defineProps({
  /** Producto como lo entrega GET /productos. */
  producto: { type: /** @type {import('vue').PropType<any>} */ (Object), required: true },
  /** Nombres de sus grupos de opciones: "Término, Adiciones" (vacío si no tiene). */
  opciones: { type: String, default: '' },
});

const emit = defineEmits({ editar: () => true, alternar: () => true });
</script>

<template>
  <li
    class="flex items-center gap-3 rounded-xl bg-default p-3 ring-1 ring-default"
    :class="!producto.activo && 'opacity-60'"
  >
    <button
      type="button"
      class="min-w-0 flex-1 text-left"
      :aria-label="`Editar ${producto.nombre}`"
      @click="emit('editar')"
    >
      <span class="block truncate font-semibold text-highlighted">{{ producto.nombre }}</span>
      <span class="flex flex-wrap items-center gap-2 text-sm">
        <span class="cifra font-semibold text-primary">{{ formatearPesos(producto.precio) }}</span>
        <UBadge
          color="neutral"
          variant="subtle"
          size="sm"
          :label="TIPOS_IMPUESTO[producto.tipoImpuesto].etiqueta"
        />
        <UBadge
          v-if="opciones"
          color="primary"
          variant="subtle"
          size="sm"
          icon="i-lucide-list-checks"
          :label="opciones"
        />
        <UBadge
          v-if="producto.controlaStock"
          color="info"
          variant="subtle"
          size="sm"
          icon="i-lucide-package"
          :label="`Stock ${formatearCantidad(producto.stock)}`"
        />
      </span>
    </button>
    <USwitch
      :model-value="producto.activo"
      :aria-label="`${producto.activo ? 'Desactivar' : 'Activar'} ${producto.nombre}`"
      @update:model-value="emit('alternar')"
    />
  </li>
</template>
