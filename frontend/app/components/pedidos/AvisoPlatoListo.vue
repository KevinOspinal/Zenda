<!--
  Aviso de un plato listo para llevar: mesa grande, producto, cantidad y notas, con el botón
  "Entregado" para quitarlo de la lista cuando el mesero lo lleve a la mesa.
-->
<script setup>
defineProps({
  /** Plato listo (ítem del pedido, forma del API). */
  item: { type: /** @type {import('vue').PropType<any>} */ (Object), required: true },
  /** Pedido al que pertenece el plato. */
  pedido: { type: /** @type {import('vue').PropType<any>} */ (Object), required: true },
  /** Se está marcando como entregado. */
  entregando: { type: Boolean, default: false },
});

const emit = defineEmits({ entregado: () => true });
</script>

<template>
  <div class="flex items-center gap-4 rounded-xl bg-info/10 p-4 ring-2 ring-info/40">
    <span class="grid size-12 shrink-0 place-items-center rounded-full bg-info text-inverted">
      <UIcon name="i-lucide-bell-ring" class="size-6" />
    </span>
    <div class="min-w-0 flex-1">
      <p class="truncate text-lg font-bold text-highlighted">
        {{ pedido.mesa?.nombre ?? 'Mostrador' }}
      </p>
      <p class="leading-snug text-default">
        <span class="cifra font-bold">{{ formatearCantidad(item.cantidad) }}×</span>
        {{ item.producto.nombre }}
      </p>
      <p v-if="item.notas" class="text-sm font-medium text-warning">{{ item.notas }}</p>
    </div>
    <UButton
      size="xl"
      color="info"
      icon="i-lucide-check-check"
      label="Entregado"
      :loading="entregando"
      @click="emit('entregado')"
    />
  </div>
</template>
