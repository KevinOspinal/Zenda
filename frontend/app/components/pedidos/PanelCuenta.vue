<!--
  Panel de la cuenta: los productos del pedido, el total y el botón de enviar a cocina.
  En tablet y PC va fijo a la derecha del menú; en el celular, dentro de un panel que sube
  desde abajo. El total lo calcula el backend: aquí solo se muestra.
-->
<script setup>
defineProps({
  items: { type: /** @type {import('vue').PropType<any[]>} */ (Array), required: true },
  /** Total del pedido en pesos (texto del API o Decimal). */
  total: {
    type: /** @type {import('vue').PropType<import('~/utils/dinero.js').ValorDinero>} */ ([
      String,
      Object,
    ]),
    required: true,
  },
  /** Estado del pedido: nuevo (aún no existe), abierto o enviado_a_cocina. */
  estadoPedido: {
    type: /** @type {import('vue').PropType<'nuevo' | 'abierto' | 'enviado_a_cocina'>} */ (String),
    default: 'nuevo',
  },
  /** Hay cambios en camino: el total se actualiza al responder el API. */
  procesando: { type: Boolean, default: false },
  /** Se está enviando a la cocina. */
  enviando: { type: Boolean, default: false },
  /** Quien toma el pedido también puede cobrarlo (cajero, administrador o dueño). */
  puedeCobrar: { type: Boolean, default: false },
});

const emit = defineEmits({
  /** @param {object} _item Ítem del pedido que se quiere quitar. */
  quitar: (_item) => true,
  enviar: () => true,
  cobrar: () => true,
});
</script>

<template>
  <div class="flex h-full flex-col gap-4">
    <div class="min-h-0 flex-1 overflow-y-auto">
      <ResumenCuenta v-if="items.length" :items="items" @quitar="emit('quitar', $event)" />
      <UEmpty
        v-else
        variant="naked"
        icon="i-lucide-receipt"
        title="La cuenta está vacía"
        description="Toca un producto del menú para agregarlo."
      />
    </div>

    <div class="space-y-3 border-t border-default pt-4">
      <div class="flex items-baseline justify-between gap-3">
        <span class="font-semibold text-toned">Total</span>
        <CifraAnimada
          :valor="total"
          class="text-3xl font-bold tracking-tight text-highlighted transition-opacity"
          :class="procesando && 'animate-pulse opacity-60'"
        />
      </div>

      <UButton
        v-if="puedeCobrar"
        block
        size="xl"
        icon="i-lucide-banknote"
        :label="`Cobrar ${formatearPesos(total)}`"
        :disabled="!items.length || procesando"
        @click="emit('cobrar')"
      />
      <UAlert
        v-if="estadoPedido === 'enviado_a_cocina'"
        color="info"
        variant="subtle"
        icon="i-lucide-chef-hat"
        title="La cocina ya tiene este pedido"
        description="Lo que agregues le llega al instante."
      />
      <UButton
        v-else
        block
        :size="puedeCobrar ? 'lg' : 'xl'"
        :variant="puedeCobrar ? 'outline' : 'solid'"
        :color="puedeCobrar ? 'neutral' : 'primary'"
        icon="i-lucide-chef-hat"
        label="Enviar a cocina"
        :loading="enviando"
        :disabled="!items.length || procesando"
        @click="emit('enviar')"
      />
    </div>
  </div>
</template>
