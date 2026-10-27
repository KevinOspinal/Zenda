<!--
  Aviso de una mesa con platos listos para llevar: la mesa en grande, sus platos listos (con
  cantidad y notas) y "Entregar todo". Si son varios, cada plato conserva su "Entregado" por
  si se llevan por partes. Si algo sigue en la cocina, lo dice: se avisa cuando esté listo.
-->
<script setup>
const props = defineProps({
  /** Pedido de la mesa (forma del API). */
  pedido: { type: /** @type {import('vue').PropType<any>} */ (Object), required: true },
  /** Sus platos listos para llevar. */
  items: { type: /** @type {import('vue').PropType<any[]>} */ (Array), required: true },
  /** Ids de los platos que se están entregando. */
  entregando: {
    type: /** @type {import('vue').PropType<Set<string>>} */ (Set),
    default: () => new Set(),
  },
});

const emit = defineEmits({
  /** @param {any} _item */
  entregar: (_item) => true,
  entregarTodo: () => true,
});

/** Platos de la mesa que todavía se están preparando. */
const enLaCocina = computed(
  () =>
    (props.pedido.items ?? []).filter(
      (/** @type {any} */ item) =>
        item.estadoCocina === 'pendiente' || item.estadoCocina === 'preparando',
    ).length,
);
const entregandoTodo = computed(() =>
  props.items.every((/** @type {any} */ item) => props.entregando.has(item.id)),
);
</script>

<template>
  <article class="space-y-3 rounded-xl bg-info/10 p-4 ring-2 ring-info/40">
    <header class="flex items-center gap-3">
      <span class="grid size-12 shrink-0 place-items-center rounded-full bg-info text-inverted">
        <UIcon name="i-lucide-bell-ring" class="size-6" />
      </span>
      <div class="min-w-0 flex-1">
        <h2 class="truncate text-xl font-bold text-highlighted">{{ nombreDelPedido(pedido) }}</h2>
        <p class="text-sm text-default">
          {{ items.length }} {{ items.length === 1 ? 'plato listo' : 'platos listos' }}
          <span v-if="enLaCocina" class="text-muted">· {{ enLaCocina }} aún en la cocina</span>
        </p>
      </div>
    </header>

    <ul class="divide-y divide-default rounded-lg bg-default ring-1 ring-default">
      <li v-for="item in items" :key="item.id" class="flex items-center gap-3 p-3">
        <div class="min-w-0 flex-1">
          <p class="leading-snug text-highlighted">
            <span class="cifra font-bold">{{ formatearCantidad(item.cantidad) }}×</span>
            {{ item.producto.nombre }}
          </p>
          <p v-if="item.notas" class="text-sm font-medium text-warning">{{ item.notas }}</p>
        </div>
        <UButton
          v-if="items.length > 1"
          color="neutral"
          variant="soft"
          icon="i-lucide-check"
          label="Entregado"
          :aria-label="`Entregado: ${item.producto.nombre}`"
          :loading="entregando.has(item.id)"
          @click="emit('entregar', item)"
        />
      </li>
    </ul>

    <UButton
      block
      size="xl"
      color="info"
      icon="i-lucide-check-check"
      :label="items.length === 1 ? 'Entregado' : `Entregar todo (${items.length})`"
      :loading="entregandoTodo"
      @click="emit('entregarTodo')"
    />
  </article>
</template>
