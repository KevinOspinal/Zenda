<!--
  Selector del periodo de los reportes: hoy, ayer, esta semana, este mes o un rango
  personalizado (máximo 366 días, como permite el backend). Todo en hora de Colombia.
-->
<script setup>
/** Rango elegido: { desde, hasta } en YYYY-MM-DD. */
const rango = defineModel({
  type: /** @type {import('vue').PropType<import('~/utils/periodos.js').Rango>} */ (Object),
  required: true,
});

const PERIODOS = Object.freeze([
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: 'ayer', etiqueta: 'Ayer' },
  { valor: 'semana', etiqueta: 'Esta semana' },
  { valor: 'mes', etiqueta: 'Este mes' },
  { valor: 'personalizado', etiqueta: 'Otro rango' },
]);
const MAXIMO_DIAS = 366;

const periodo = ref('hoy');
const desde = ref(rango.value.desde);
const hasta = ref(rango.value.hasta);

/** @param {string} valor */
function elegir(valor) {
  periodo.value = valor;
  if (valor === 'personalizado') return;
  const nuevo = rangoDePeriodo(/** @type {import('~/utils/periodos.js').Periodo} */ (valor));
  desde.value = nuevo.desde;
  hasta.value = nuevo.hasta;
  rango.value = nuevo;
}

/** Error del rango personalizado, si lo hay. */
const errorRango = computed(() => {
  if (!desde.value || !hasta.value) return 'Elige las dos fechas';
  if (desde.value > hasta.value) return 'La fecha inicial debe ser antes de la final';
  if (diasDelRango({ desde: desde.value, hasta: hasta.value }) > MAXIMO_DIAS) {
    return `El rango no puede pasar de ${MAXIMO_DIAS} días`;
  }
  return '';
});

watch([desde, hasta], () => {
  if (periodo.value === 'personalizado' && !errorRango.value) {
    rango.value = { desde: desde.value, hasta: hasta.value };
  }
});
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap gap-2" role="group" aria-label="Periodo">
      <UButton
        v-for="opcion in PERIODOS"
        :key="opcion.valor"
        :label="opcion.etiqueta"
        size="lg"
        :aria-pressed="periodo === opcion.valor"
        :color="periodo === opcion.valor ? 'primary' : 'neutral'"
        :variant="periodo === opcion.valor ? 'solid' : 'soft'"
        @click="elegir(opcion.valor)"
      />
    </div>
    <div v-if="periodo === 'personalizado'" class="flex flex-wrap items-end gap-3">
      <UFormField label="Desde">
        <UInput v-model="desde" type="date" size="lg" />
      </UFormField>
      <UFormField label="Hasta">
        <UInput v-model="hasta" type="date" size="lg" />
      </UFormField>
      <p v-if="errorRango" class="pb-2 text-sm font-medium text-error" role="alert">
        {{ errorRango }}
      </p>
    </div>
  </div>
</template>
