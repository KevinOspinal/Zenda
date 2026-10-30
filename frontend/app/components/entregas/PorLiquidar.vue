<!--
  Lo que el domiciliario debe entregar en la caja: sus domicilios contra entrega ya entregados,
  con el total en grande. Cuando la caja recibe el dinero, salen de aquí solos (en vivo).
-->
<script setup>
defineProps({
  /** Domicilios entregados y sin liquidar (forma del API). */
  pedidos: { type: /** @type {import('vue').PropType<any[]>} */ (Array), required: true },
  /** Suma de sus totales. */
  total: {
    type: /** @type {import('vue').PropType<import('~/utils/dinero.js').ValorDinero>} */ ([
      String,
      Object,
    ]),
    required: true,
  },
});
</script>

<template>
  <section
    class="rounded-2xl bg-secondary/5 p-5 ring-1 ring-secondary/25"
    aria-labelledby="titulo-por-liquidar"
  >
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 id="titulo-por-liquidar" class="flex items-center gap-2 font-semibold text-highlighted">
          <UIcon name="i-lucide-hand-coins" class="size-5 text-secondary" />
          Por entregar en la caja
        </h2>
        <p class="mt-0.5 text-sm text-muted">
          {{ pedidos.length }}
          {{ pedidos.length === 1 ? 'domicilio cobrado' : 'domicilios cobrados' }}
        </p>
      </div>
      <CifraAnimada :valor="total" class="text-2xl font-bold text-highlighted" />
    </div>
    <ul class="mt-4 divide-y divide-default">
      <li
        v-for="pedido in pedidos"
        :key="pedido.id"
        class="flex items-center justify-between gap-3 py-2.5"
      >
        <span class="min-w-0">
          <span class="block truncate font-medium text-highlighted">
            {{ nombreDelPedido(pedido) }}
          </span>
          <span class="cifra text-xs text-muted">
            Entregado {{ formatearHora(pedido.entrega.entregadoEn) }}
          </span>
        </span>
        <span class="cifra shrink-0 font-semibold text-highlighted">
          {{ formatearPesos(pedido.total) }}
        </span>
      </li>
    </ul>
  </section>
</template>
