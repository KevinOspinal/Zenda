<!--
  Pagos del cobro. Por defecto un solo pago por el total; se elige el método con botones
  grandes. En efectivo se escribe (o se toca) con cuánto paga el cliente para calcular el
  cambio; en tarjeta o transferencia, la referencia es opcional. "Pagar con otro método
  también" reparte la cuenta en varios métodos (pago mixto).
-->
<script setup>
const props = defineProps({
  /** Lo que se debe pagar: total + propina. */
  aPagar: {
    type: /** @type {import('vue').PropType<import('~/utils/dinero.js').ValorDinero>} */ ([
      String,
      Object,
    ]),
    required: true,
  },
});

const pagos = defineModel({
  type: /** @type {import('vue').PropType<import('~/utils/caja.js').PagoEnPantalla[]>} */ (Array),
  required: true,
});

const METODOS = Object.entries(METODOS_PAGO).map(([valor, apariencia]) => ({
  valor,
  ...apariencia,
}));
/** Más de 4 pagos no tiene sentido en un restaurante (el backend acepta hasta 10). */
const MAXIMO_PAGOS = 4;

const mixto = computed(() => pagos.value.length > 1);

/**
 * @param {number} indice
 * @param {string} metodo
 */
function elegirMetodo(indice, metodo) {
  const pago = pagos.value[indice];
  if (!pago) return;
  pago.metodo = /** @type {any} */ (metodo);
  if (metodo !== 'efectivo') pago.recibido = '';
}

/** Agrega otro pago por lo que falta. */
function agregarPago() {
  const { faltante } = estadoDelCobro({ total: props.aPagar, propina: '0', pagos: pagos.value });
  pagos.value.push({
    metodo: 'tarjeta',
    monto: faltante.greaterThan(0) ? montoComoTexto(faltante) : '',
    recibido: '',
    referencia: '',
  });
}

/** @param {number} indice */
function quitarPago(indice) {
  pagos.value.splice(indice, 1);
  // Con un solo pago, vuelve a ser por el total.
  const unico = pagos.value[0];
  if (pagos.value.length === 1 && unico) unico.monto = montoComoTexto(props.aPagar);
}
</script>

<template>
  <fieldset class="space-y-3">
    <legend class="text-lg font-semibold text-highlighted">Pago</legend>

    <div
      v-for="(pago, indice) in pagos"
      :key="indice"
      class="space-y-3 rounded-xl p-4 ring-1 ring-default"
      :class="mixto && 'bg-elevated/40'"
    >
      <div class="flex items-center justify-between gap-2">
        <p v-if="mixto" class="text-sm font-semibold text-muted">Pago {{ indice + 1 }}</p>
        <UButton
          v-if="mixto"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="`Quitar el pago ${indice + 1}`"
          @click="quitarPago(indice)"
        />
      </div>

      <div
        class="grid grid-cols-4 gap-2"
        role="radiogroup"
        :aria-label="`Método del pago ${indice + 1}`"
      >
        <button
          v-for="metodo in METODOS"
          :key="metodo.valor"
          type="button"
          role="radio"
          :aria-checked="pago.metodo === metodo.valor"
          class="flex flex-col items-center gap-1 rounded-xl px-1 py-3 text-xs font-semibold ring-1 transition active:scale-[0.98] sm:text-sm motion-reduce:transition-none"
          :class="
            pago.metodo === metodo.valor
              ? 'bg-primary/10 text-primary ring-2 ring-primary'
              : 'bg-default text-toned ring-default hover:ring-accented'
          "
          @click="elegirMetodo(indice, metodo.valor)"
        >
          <UIcon :name="metodo.icono" class="size-6" />
          {{ metodo.etiqueta }}
        </button>
      </div>

      <UFormField v-if="mixto" label="Monto con este método">
        <CampoDinero v-model="pago.monto" etiqueta="Monto con este método" />
      </UFormField>

      <template v-if="pago.metodo === 'efectivo'">
        <UFormField label="¿Con cuánto paga?" hint="Opcional, para calcular el cambio">
          <div class="space-y-2">
            <div class="grid grid-cols-4 gap-2">
              <UButton
                v-for="monto in montosRapidos(pago.monto || '0')"
                :key="monto"
                :label="formatearPesos(monto)"
                color="neutral"
                :variant="pago.recibido === monto ? 'solid' : 'outline'"
                size="lg"
                block
                class="cifra px-1"
                @click="pago.recibido = monto"
              />
            </div>
            <CampoDinero v-model="pago.recibido" etiqueta="Efectivo recibido" />
            <p v-if="!recibidoAlcanza(pago)" class="text-sm font-medium text-error" role="alert">
              No alcanza para {{ formatearPesos(pago.monto || '0') }}.
            </p>
          </div>
        </UFormField>
      </template>
      <UFormField v-else label="Referencia" hint="Opcional">
        <UInput
          v-model="pago.referencia"
          size="lg"
          class="w-full"
          placeholder="Número de aprobación o de la transferencia"
          maxlength="100"
        />
      </UFormField>
    </div>

    <UButton
      v-if="pagos.length < MAXIMO_PAGOS"
      color="neutral"
      variant="soft"
      size="lg"
      icon="i-lucide-plus"
      label="Pagar con otro método también"
      @click="agregarPago"
    />
  </fieldset>
</template>
