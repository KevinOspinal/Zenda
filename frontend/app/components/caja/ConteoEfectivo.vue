<!--
  Conteo del efectivo al cerrar la caja: cada billete y moneda con botones − / + (o se
  escribe cuántos hay). El total se suma en vivo.
-->
<script setup>
/** Cantidad contada de cada denominación: { 50000: 2, 1000: 3 }. */
const conteo = defineModel({
  type: /** @type {import('vue').PropType<Record<number, number>>} */ (Object),
  required: true,
});

const GRUPOS = Object.freeze([
  { titulo: 'Billetes', icono: 'i-lucide-banknote', valores: BILLETES },
  { titulo: 'Monedas', icono: 'i-lucide-coins', valores: MONEDAS },
]);

/**
 * @param {number} valor
 * @param {number} cambio
 */
function sumarUnidades(valor, cambio) {
  conteo.value[valor] = Math.max(0, (conteo.value[valor] ?? 0) + cambio);
}

/**
 * @param {number} valor
 * @param {string | number} texto
 */
function escribir(valor, texto) {
  const cantidad = Number.parseInt(String(texto), 10);
  conteo.value[valor] = Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 0;
}
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <section v-for="grupo in GRUPOS" :key="grupo.titulo" class="space-y-2">
      <h3 class="flex items-center gap-2 font-semibold text-highlighted">
        <UIcon :name="grupo.icono" class="size-5 text-primary" />
        {{ grupo.titulo }}
      </h3>
      <div
        v-for="valor in grupo.valores"
        :key="valor"
        class="flex items-center gap-2 rounded-lg bg-default p-2 ring-1 ring-default"
      >
        <span class="cifra w-24 shrink-0 font-semibold text-highlighted">
          {{ formatearPesos(valor) }}
        </span>
        <UButton
          icon="i-lucide-minus"
          color="neutral"
          variant="soft"
          class="size-10 justify-center"
          :aria-label="`Quitar uno de ${formatearPesos(valor)}`"
          @click="sumarUnidades(valor, -1)"
        />
        <UInput
          :model-value="String(conteo[valor] ?? 0)"
          inputmode="numeric"
          size="lg"
          class="w-16"
          :ui="{ base: 'cifra text-center' }"
          :aria-label="`Cantidad de ${formatearPesos(valor)}`"
          @update:model-value="(texto) => escribir(valor, texto)"
        />
        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="soft"
          class="size-10 justify-center"
          :aria-label="`Agregar uno de ${formatearPesos(valor)}`"
          @click="sumarUnidades(valor, 1)"
        />
        <span class="cifra ms-auto text-sm text-muted">
          {{ formatearPesos(aDecimal(valor).times(conteo[valor] ?? 0)) }}
        </span>
      </div>
    </section>
  </div>
</template>
