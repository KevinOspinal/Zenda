<!--
  Propina voluntaria al cobrar (Ley 1935 de 2018): el cliente decide si la da y cuánto.
  Tres opciones grandes: sin propina, la sugerida por el negocio u otro valor.
-->
<script setup>
const props = defineProps({
  /** Propina sugerida del pedido, en pesos (la calcula el backend). */
  sugerida: { type: String, required: true },
});

/** ninguna · sugerida · otra */
const modo = defineModel('modo', {
  type: /** @type {import('vue').PropType<'ninguna' | 'sugerida' | 'otra'>} */ (String),
  default: 'ninguna',
});
const otra = defineModel('otra', { type: String, default: '' });

/** El negocio puede no sugerir propina (0 %): entonces solo hay "sin propina" u "otro valor". */
const haySugerida = computed(() => aDecimal(props.sugerida).greaterThan(0));

const opciones = computed(() => [
  { valor: 'ninguna', titulo: 'Sin propina', detalle: '' },
  ...(haySugerida.value
    ? [{ valor: 'sugerida', titulo: 'Sugerida', detalle: formatearPesos(props.sugerida) }]
    : []),
  { valor: 'otra', titulo: 'Otro valor', detalle: '' },
]);
</script>

<template>
  <fieldset class="space-y-3">
    <legend class="flex w-full flex-wrap items-baseline justify-between gap-2">
      <span class="text-lg font-semibold text-highlighted">Propina</span>
      <span class="text-sm text-muted">La propina es voluntaria</span>
    </legend>

    <div class="grid gap-2" :class="haySugerida ? 'grid-cols-3' : 'grid-cols-2'" role="radiogroup">
      <button
        v-for="opcion in opciones"
        :key="opcion.valor"
        type="button"
        role="radio"
        :aria-checked="modo === opcion.valor"
        class="flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl p-3 text-center ring-1 transition active:scale-[0.98] motion-reduce:transition-none"
        :class="
          modo === opcion.valor
            ? 'bg-primary/10 text-primary ring-2 ring-primary'
            : 'bg-default text-toned ring-default hover:ring-accented'
        "
        @click="modo = /** @type {any} */ (opcion.valor)"
      >
        <span class="font-semibold">{{ opcion.titulo }}</span>
        <span v-if="opcion.detalle" class="cifra text-sm">{{ opcion.detalle }}</span>
      </button>
    </div>

    <CampoDinero v-if="modo === 'otra'" v-model="otra" etiqueta="Valor de la propina" autofocus />
  </fieldset>
</template>
