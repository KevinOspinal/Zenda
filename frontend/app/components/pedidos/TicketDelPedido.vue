<!--
  La cuenta de un pedido cerrado, como un recibo: cada producto con su cantidad y su valor,
  el domicilio y la propina si los hay, el total y cómo se pagó. Los valores vienen del API;
  aquí solo se multiplica cantidad por precio para mostrar cada línea.
-->
<script setup>
const props = defineProps({
  /** Pedido completo (forma del API). */
  pedido: { type: /** @type {import('vue').PropType<any>} */ (Object), required: true },
});

const lineas = computed(() =>
  (props.pedido.items ?? []).map((/** @type {any} */ item) => ({
    ...item,
    valor: aDecimal(item.precioUnitario).times(item.cantidad),
  })),
);
/** El estado de cocina de cada plato solo dice algo si el pedido pasó por la cocina. */
const pasoPorCocina = computed(() => Boolean(props.pedido.enviadoACocinaEn));
const valorDomicilio = computed(() => aDecimal(props.pedido.valorDomicilio ?? 0));
const propina = computed(() => aDecimal(props.pedido.propina ?? 0));
const pagos = computed(() => props.pedido.pagos ?? []);
</script>

<template>
  <section class="rounded-xl bg-default ring-1 ring-default">
    <header class="flex items-baseline justify-between gap-3 border-b border-default px-5 py-4">
      <h2 class="text-lg font-semibold text-highlighted">Cuenta</h2>
      <span class="text-sm text-muted">
        {{ lineas.length }} {{ lineas.length === 1 ? 'producto' : 'productos' }}
      </span>
    </header>

    <ul class="divide-y divide-default px-5">
      <li v-for="linea in lineas" :key="linea.id" class="flex items-start gap-3 py-3">
        <span
          class="cifra grid size-8 shrink-0 place-items-center rounded-lg bg-elevated text-sm font-bold text-highlighted"
        >
          {{ formatearCantidad(linea.cantidad) }}
        </span>
        <span class="min-w-0 flex-1 space-y-1">
          <span class="block font-medium text-highlighted">{{ linea.producto.nombre }}</span>
          <span v-if="linea.notas" class="block text-sm text-muted">{{ linea.notas }}</span>
          <ChipEstado
            v-if="pasoPorCocina"
            :apariencia="ESTADOS_COCINA[linea.estadoCocina]"
            tamano="sm"
          />
        </span>
        <span class="cifra font-semibold text-highlighted">{{ formatearPesos(linea.valor) }}</span>
      </li>
    </ul>

    <dl class="cifra space-y-1.5 border-t border-dashed border-accented px-5 py-4">
      <div v-if="valorDomicilio.greaterThan(0)" class="flex justify-between text-sm text-muted">
        <dt>Domicilio</dt>
        <dd>{{ formatearPesos(valorDomicilio) }}</dd>
      </div>
      <div class="flex items-baseline justify-between">
        <dt class="font-semibold text-toned">Total</dt>
        <dd class="text-2xl font-bold text-highlighted">{{ formatearPesos(pedido.total) }}</dd>
      </div>
      <div v-if="propina.greaterThan(0)" class="flex justify-between text-sm text-muted">
        <dt>Propina</dt>
        <dd>{{ formatearPesos(propina) }}</dd>
      </div>
    </dl>

    <div
      v-if="pagos.length"
      class="space-y-2 rounded-b-xl border-t border-default bg-elevated/60 px-5 py-4"
    >
      <p class="text-sm font-medium text-muted">Pagado con</p>
      <p v-for="pago in pagos" :key="pago.id" class="flex items-center gap-2">
        <UIcon :name="METODOS_PAGO[pago.metodo].icono" class="size-4 text-muted" />
        <span class="flex-1 text-default">{{ METODOS_PAGO[pago.metodo].etiqueta }}</span>
        <span class="cifra font-semibold text-highlighted">{{ formatearPesos(pago.monto) }}</span>
      </p>
    </div>
  </section>
</template>
