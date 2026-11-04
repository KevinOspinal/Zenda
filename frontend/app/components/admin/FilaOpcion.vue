<!--
  Una opción dentro del formulario de un grupo: nombre, precio extra (con el impuesto
  incluido), su impuesto y si está disponible. El impuesto solo se elige si la opción
  cuesta algo y el régimen del negocio permite más de uno.
-->
<script setup>
const props = defineProps({
  /** Posición en el grupo: forma el nombre de los campos para mostrar sus errores. */
  indice: { type: Number, required: true },
  /** Impuestos que permite el régimen del negocio. */
  permitidos: {
    type: /** @type {import('vue').PropType<import('~/utils/impuestos.js').TipoImpuesto[]>} */ (
      Array
    ),
    required: true,
  },
  /** Un grupo necesita al menos una opción: la última no se puede quitar. */
  puedeQuitar: { type: Boolean, default: true },
});

/** La opción que se edita: { nombre, precioExtra, tipoImpuesto, activo }. */
const opcion = defineModel({
  type: /** @type {import('vue').PropType<any>} */ (Object),
  required: true,
});

const emit = defineEmits({ quitar: () => true });

const cobra = computed(
  () => esMontoValido(opcion.value.precioExtra) && aDecimal(opcion.value.precioExtra).gt(0),
);
const opcionesImpuesto = computed(() =>
  props.permitidos.map((tipo) => ({ value: tipo, label: TIPOS_IMPUESTO[tipo].etiqueta })),
);
</script>

<template>
  <div
    class="space-y-2 rounded-xl bg-elevated/50 p-3 ring-1 ring-default"
    :class="!opcion.activo && 'opacity-70'"
  >
    <div class="flex items-start gap-2">
      <UFormField :name="`opciones.${indice}.nombre`" class="flex-1">
        <UInput
          v-model="opcion.nombre"
          size="lg"
          class="w-full"
          placeholder="Nombre (por ejemplo, Queso)"
          :aria-label="`Nombre de la opción ${indice + 1}`"
          :maxlength="60"
        />
      </UFormField>
      <UButton
        color="neutral"
        variant="ghost"
        size="lg"
        icon="i-lucide-trash-2"
        :disabled="!puedeQuitar"
        :aria-label="`Quitar ${opcion.nombre || `la opción ${indice + 1}`}`"
        @click="emit('quitar')"
      />
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <UFormField :name="`opciones.${indice}.precioExtra`" class="w-40">
        <CampoDinero
          v-model="opcion.precioExtra"
          size="md"
          :etiqueta="`Precio extra de ${opcion.nombre || `la opción ${indice + 1}`}`"
        />
      </UFormField>
      <USelect
        v-if="cobra && permitidos.length > 1"
        v-model="opcion.tipoImpuesto"
        :items="opcionesImpuesto"
        class="w-36"
        :aria-label="`Impuesto de ${opcion.nombre || `la opción ${indice + 1}`}`"
      />
      <span v-else-if="!cobra" class="text-sm text-muted">No cambia el precio</span>
      <USwitch
        v-model="opcion.activo"
        class="ms-auto"
        :label="opcion.activo ? 'Disponible' : 'Agotada'"
      />
    </div>
  </div>
</template>
