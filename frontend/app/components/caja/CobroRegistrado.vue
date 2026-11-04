<!--
  Lo que se ve al registrar un cobro: el cambio en grande y, si el negocio no factura
  electrónicamente, su recibo.
  Si el pedido se cobró sin pasar por la cocina, falta decidir qué pasa con él y la ventana no
  se cierra hasta hacerlo (así ningún pedido cobrado se queda sin preparar):
  - "Enviar a cocina": la cocina lo prepara aunque ya esté pagado.
  - "No va a cocina": no hay nada que preparar (por ejemplo, unas gaseosas). Un domicilio no
    tiene esta opción: solo sale cuando la cocina lo tiene listo.
-->
<script setup>
const props = defineProps({
  /** Respuesta del cobro (POST /pedidos/:id/cobrar): el pedido pagado y el cambio. */
  resultado: {
    type: /** @type {import('vue').PropType<{ pedido: any, cambio: string }>} */ (Object),
    required: true,
  },
});

const emit = defineEmits({
  /** Ya se decidió qué pasa con la cocina: la ventana se puede cerrar. */
  decidido: () => true,
});

const { imprimir } = useImpresionDeRecibo();
const { decidiendo, decidir } = useDecisionDeCocina();

const pedido = computed(() => props.resultado.pedido);
const faltaCocina = computed(() => faltaDecidirCocina(pedido.value));
/** Qué falta y por qué (el mismo aviso que se ve en el pedido cobrado). */
const aviso = computed(() => avisoDelPedidoCerrado(pedido.value));
const esDomicilio = computed(() => tipoDelPedido(pedido.value) === 'domicilio');

/** @param {import('~/composables/useDecisionDeCocina.js').DecisionDeCocina} decision */
async function elegir(decision) {
  if (await decidir(pedido.value, decision)) emit('decidido');
}
</script>

<template>
  <div class="space-y-5 py-4 text-center">
    <div class="mx-auto grid size-20 place-items-center rounded-full bg-success/15">
      <UIcon name="i-lucide-circle-check" class="size-12 text-success motion-safe:animate-bounce" />
    </div>
    <div
      v-if="aDecimal(resultado.cambio).greaterThan(0)"
      class="mx-auto max-w-sm rounded-2xl bg-success/10 p-6 ring-1 ring-success/30"
    >
      <p class="font-medium text-toned">Devuelve</p>
      <p class="cifra text-6xl font-bold tracking-tight text-success">
        {{ formatearPesos(resultado.cambio) }}
      </p>
    </div>
    <p v-else class="text-lg text-muted">No hay cambio para devolver.</p>
    <!-- Negocio sin factura electrónica: su recibo de venta, si el cliente lo quiere. -->
    <UButton
      v-if="pedido.recibo"
      size="xl"
      color="neutral"
      variant="outline"
      icon="i-lucide-printer"
      :label="`Imprimir recibo No. ${numeroDeRecibo(pedido.recibo.numero)}`"
      @click="imprimir(pedido)"
    />

    <!-- Cobrado antes de ir a la cocina: hay que decidir antes de cerrar. -->
    <section
      v-if="faltaCocina"
      class="space-y-4 rounded-2xl bg-warning/10 p-5 text-left ring-1 ring-warning/40"
      role="alert"
    >
      <div class="flex items-start gap-3">
        <UIcon name="i-lucide-chef-hat" class="mt-0.5 size-6 shrink-0 text-warning" />
        <div class="space-y-1">
          <h3 class="font-semibold text-highlighted">{{ aviso.titulo }}</h3>
          <p class="text-sm text-toned">{{ aviso.descripcion }}</p>
        </div>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row-reverse">
        <UButton
          size="xl"
          icon="i-lucide-chef-hat"
          label="Enviar a cocina"
          class="justify-center sm:flex-1"
          :loading="decidiendo === 'cocina'"
          :disabled="Boolean(decidiendo)"
          @click="elegir('cocina')"
        />
        <UButton
          v-if="!esDomicilio"
          size="xl"
          color="neutral"
          variant="outline"
          icon="i-lucide-cup-soda"
          label="No va a cocina"
          class="justify-center sm:flex-1"
          :loading="decidiendo === 'sin_cocina'"
          :disabled="Boolean(decidiendo)"
          @click="elegir('sin_cocina')"
        />
      </div>
    </section>
  </div>
</template>
