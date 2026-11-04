<!--
  Opciones de un plato al tomar el pedido: un bloque por grupo (término, adiciones,
  quitar...) con sus opciones como botones grandes. En los grupos de una sola opción, tocar
  otra reemplaza la anterior; los obligatorios lo dicen y cambian a "Listo" al cumplirse.
  Las opciones con precio muestran cuánto suman.
-->
<script setup>
defineProps({
  /** Grupos del producto, como los entrega GET /menu (solo opciones disponibles). */
  grupos: {
    type: /** @type {import('vue').PropType<import('~/utils/opciones.js').GrupoDelMenu[]>} */ (
      Array
    ),
    required: true,
  },
});

/** Ids de las opciones elegidas en todo el plato. */
const elegidas = defineModel({
  type: /** @type {import('vue').PropType<string[]>} */ (Array),
  default: () => [],
});

/**
 * @param {import('~/utils/opciones.js').GrupoDelMenu} grupo
 * @param {string} opcionId
 */
function tocar(grupo, opcionId) {
  elegidas.value = alternarOpcion(grupo, elegidas.value, opcionId);
}

/**
 * Un grupo de varias opciones que ya llegó a su máximo: las demás se apagan.
 * @param {import('~/utils/opciones.js').GrupoDelMenu} grupo
 */
function estaLleno(grupo) {
  return (
    grupo.maximo !== null &&
    grupo.maximo > 1 &&
    elegidasEnGrupo(grupo, elegidas.value) >= grupo.maximo
  );
}

/** @param {{ precioExtra: string }} opcion */
const cobra = (opcion) => aDecimal(opcion.precioExtra).gt(0);
</script>

<template>
  <div class="space-y-5">
    <fieldset v-for="grupo in grupos" :key="grupo.id" class="space-y-2">
      <legend class="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span class="font-semibold text-highlighted">{{ grupo.nombre }}</span>
        <span class="text-sm text-muted">{{ describirRegla(grupo) }}</span>
        <template v-if="grupo.minimo > 0">
          <UBadge
            v-if="elegidasEnGrupo(grupo, elegidas) >= grupo.minimo"
            color="success"
            variant="subtle"
            size="sm"
            icon="i-lucide-check"
            label="Listo"
          />
          <UBadge
            v-else
            color="warning"
            variant="subtle"
            size="sm"
            icon="i-lucide-asterisk"
            label="Obligatorio"
          />
        </template>
      </legend>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="opcion in grupo.opciones"
          :key="opcion.id"
          size="lg"
          :color="elegidas.includes(opcion.id) ? 'primary' : 'neutral'"
          :variant="elegidas.includes(opcion.id) ? 'solid' : 'outline'"
          :aria-pressed="elegidas.includes(opcion.id)"
          :disabled="!elegidas.includes(opcion.id) && estaLleno(grupo)"
          @click="tocar(grupo, opcion.id)"
        >
          {{ opcion.nombre }}
          <span v-if="cobra(opcion)" class="cifra font-semibold">
            +{{ formatearPesos(opcion.precioExtra) }}
          </span>
        </UButton>
      </div>
    </fieldset>
  </div>
</template>
