<!--
  Detalle del pedido elegido en la caja: sus productos, la base y el impuesto, el total y
  las acciones: cobrar (la principal), dividir la cuenta, agregar productos y anular.
-->
<script setup>
const props = defineProps({
  pedido: { type: /** @type {import('vue').PropType<any>} */ (Object), required: true },
});

const emit = defineEmits({ cobrar: () => true, dividir: () => true, anular: () => true });

const sesion = useSesionStore();
const puedeAnular = computed(() => puede(sesion.rol, 'anularPedidos'));
const sePuedeDividir = computed(() =>
  sumar(props.pedido.items.map((/** @type {any} */ i) => i.cantidad)).greaterThan(1),
);
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="truncate text-xl font-bold text-highlighted">
          {{ pedido.mesa?.nombre ?? 'Mostrador' }}
        </h2>
        <p class="text-sm text-muted">Abierto {{ haceCuanto(pedido.abiertoEn) }}</p>
      </div>
      <ChipEstado :apariencia="ESTADOS_PEDIDO[pedido.estado]" />
    </div>

    <ResumenCuenta :items="pedido.items ?? []" solo-lectura />

    <dl class="cifra space-y-1 border-t border-default pt-3 text-sm">
      <div class="flex justify-between text-muted">
        <dt>Base</dt>
        <dd>{{ formatearPesos(pedido.subtotal, { conCentavos: true }) }}</dd>
      </div>
      <div class="flex justify-between text-muted">
        <dt>Impuesto</dt>
        <dd>{{ formatearPesos(pedido.impuestos, { conCentavos: true }) }}</dd>
      </div>
      <div class="flex items-baseline justify-between pt-1">
        <dt class="text-base font-semibold text-toned">Total</dt>
        <dd>
          <CifraAnimada :valor="pedido.total" class="text-3xl font-bold text-highlighted" />
        </dd>
      </div>
    </dl>

    <UButton block size="xl" icon="i-lucide-banknote" @click="emit('cobrar')">
      Cobrar {{ formatearPesos(pedido.total) }}
      <UKbd value="C" class="ms-2 hidden lg:inline-flex" />
    </UButton>
    <div class="grid grid-cols-2 gap-2" :class="puedeAnular && 'sm:grid-cols-3'">
      <UButton
        color="neutral"
        variant="soft"
        size="lg"
        icon="i-lucide-split"
        label="Dividir"
        block
        :disabled="!sePuedeDividir"
        @click="emit('dividir')"
      />
      <UButton
        color="neutral"
        variant="soft"
        size="lg"
        icon="i-lucide-plus"
        label="Agregar"
        block
        :to="`/pedidos/${pedido.id}`"
      />
      <UButton
        v-if="puedeAnular"
        color="error"
        variant="soft"
        size="lg"
        icon="i-lucide-ban"
        label="Anular"
        block
        class="col-span-2 sm:col-span-1"
        @click="emit('anular')"
      />
    </div>
  </div>
</template>
