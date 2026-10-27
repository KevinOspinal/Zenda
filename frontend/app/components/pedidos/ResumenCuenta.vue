<!--
  La cuenta de un pedido: cada producto con su cantidad, notas, estado de cocina y valor.
  Los ítems tienen la forma que envía el API (GET /pedidos/:id).
  Un ítem se puede quitar mientras la cocina no haya empezado a prepararlo.
-->
<script setup>
/**
 * Ítem de un pedido tal como lo envía el API.
 * @typedef {{ id: string, cantidad: string, precioUnitario: string, notas?: string | null,
 *   estadoCocina: 'pendiente' | 'preparando' | 'listo' | 'entregado',
 *   producto: { nombre: string } }} ItemPedido
 */

defineProps({
  items: { type: /** @type {import('vue').PropType<ItemPedido[]>} */ (Array), required: true },
  /** Sin el botón de quitar (por ejemplo, en el detalle de la caja). */
  soloLectura: { type: Boolean, default: false },
});

const emit = defineEmits({
  /** @param {ItemPedido} _item */
  quitar: (_item) => true,
});

/**
 * Valor de la línea (precio × cantidad), solo para mostrar.
 * @param {ItemPedido} item
 */
function valorDeLinea(item) {
  return aDecimal(item.precioUnitario).times(item.cantidad);
}
</script>

<template>
  <TransitionGroup
    tag="ul"
    class="divide-y divide-default"
    enter-from-class="opacity-0 -translate-y-1"
    enter-active-class="transition duration-200 motion-reduce:transition-none"
    leave-to-class="opacity-0 translate-x-4"
    leave-active-class="transition duration-200 motion-reduce:transition-none"
  >
    <li v-for="item in items" :key="item.id" class="flex items-start gap-3 py-3">
      <span
        class="cifra grid size-9 shrink-0 place-items-center rounded-lg bg-elevated font-bold text-highlighted"
      >
        {{ formatearCantidad(item.cantidad) }}
      </span>

      <div class="min-w-0 flex-1 space-y-1.5">
        <p class="leading-snug font-medium text-highlighted">{{ item.producto.nombre }}</p>
        <p v-if="item.notas" class="flex items-start gap-1 text-sm font-medium text-warning">
          <UIcon name="i-lucide-message-square-text" class="mt-0.5 size-4 shrink-0" />
          {{ item.notas }}
        </p>
        <ChipEstado :apariencia="ESTADOS_COCINA[item.estadoCocina]" tamano="sm" />
      </div>

      <div class="flex flex-col items-end gap-1">
        <span class="cifra font-semibold text-highlighted">
          {{ formatearPesos(valorDeLinea(item)) }}
        </span>
        <UButton
          v-if="!soloLectura && item.estadoCocina === 'pendiente'"
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          class="size-11 justify-center"
          :aria-label="`Quitar ${item.producto.nombre}`"
          @click="emit('quitar', item)"
        />
      </div>
    </li>
  </TransitionGroup>
</template>
