<!--
  Las demás entregas que lleva el domiciliario (cuando lleva varias): una fila grande por cada
  una, con a quién va, la dirección y si debe cobrar. Al tocarla pasa a ser la entrega en curso.
-->
<script setup>
defineProps({
  /** Domicilios en camino, sin la entrega en curso (forma del API). */
  pedidos: { type: /** @type {import('vue').PropType<any[]>} */ (Array), required: true },
});

const emit = defineEmits({
  /** @param {string} _id */
  elegir: (_id) => true,
});
</script>

<template>
  <section class="space-y-2" aria-labelledby="titulo-otras-entregas">
    <h2 id="titulo-otras-entregas" class="px-1 text-sm font-semibold text-muted">También llevas</h2>
    <ul class="space-y-2">
      <li v-for="pedido in pedidos" :key="pedido.id">
        <button
          type="button"
          class="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-default p-4 text-left ring-1 ring-default transition focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.98] motion-reduce:transition-none"
          :aria-label="`Entregar ahora ${nombreDelPedido(pedido)}`"
          @click="emit('elegir', pedido.id)"
        >
          <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10">
            <UIcon name="i-lucide-map-pin" class="size-5 text-primary" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold text-highlighted">
              {{ nombreDelPedido(pedido) }}
            </span>
            <span class="block truncate text-sm text-muted">{{ pedido.entrega.direccion }}</span>
          </span>
          <span
            v-if="porCobrarAlEntregar(pedido).isZero()"
            class="shrink-0 text-sm font-semibold text-success"
          >
            Pagado
          </span>
          <span v-else class="cifra shrink-0 font-semibold text-highlighted">
            {{ formatearPesos(porCobrarAlEntregar(pedido)) }}
          </span>
          <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0 text-muted" />
        </button>
      </li>
    </ul>
  </section>
</template>
