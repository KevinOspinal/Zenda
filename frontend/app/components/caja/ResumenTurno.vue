<!--
  Resumen del turno abierto en tarjetas pequeñas: lo vendido, las propinas, el efectivo que
  debería haber en el cajón y los pedidos que faltan por cobrar. Se actualiza en vivo.
-->
<script setup>
const props = defineProps({
  /** Resumen del turno (GET /caja/actual). */
  resumen: {
    type: /** @type {import('vue').PropType<import('~/stores/caja.js').ResumenTurno>} */ (Object),
    required: true,
  },
});

const tarjetas = computed(() => [
  {
    titulo: 'Vendido',
    valor: props.resumen.totalVendido,
    icono: 'i-lucide-trending-up',
    dinero: true,
  },
  { titulo: 'Propinas', valor: props.resumen.propinas, icono: 'i-lucide-hand-coins', dinero: true },
  {
    titulo: 'Efectivo en caja',
    valor: props.resumen.efectivoEsperado,
    icono: 'i-lucide-banknote',
    dinero: true,
  },
  {
    titulo: 'Por cobrar',
    valor: String(props.resumen.pedidos.abiertos),
    icono: 'i-lucide-receipt',
    dinero: false,
  },
]);
</script>

<template>
  <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
    <div
      v-for="tarjeta in tarjetas"
      :key="tarjeta.titulo"
      class="flex items-center gap-3 rounded-xl bg-default p-4 ring-1 ring-default"
    >
      <span class="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10">
        <UIcon :name="tarjeta.icono" class="size-5 text-primary" />
      </span>
      <div class="min-w-0">
        <p class="truncate text-sm text-muted">{{ tarjeta.titulo }}</p>
        <CifraAnimada
          v-if="tarjeta.dinero"
          :valor="tarjeta.valor"
          class="block truncate text-lg font-bold text-highlighted"
        />
        <p v-else class="cifra text-lg font-bold text-highlighted">{{ tarjeta.valor }}</p>
      </div>
    </div>
  </div>
</template>
