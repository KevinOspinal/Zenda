<!--
  Grupos de opciones del negocio (término, adiciones, quitar ingredientes...). Cada tarjeta
  muestra la regla, sus opciones con el precio extra y en cuántos productos se usa. Crear y
  editar se hace en un panel lateral; si no hay grupos, se ofrecen plantillas para empezar.
-->
<script setup>
defineProps({
  /** Grupos como los entrega GET /grupos-opciones. */
  grupos: { type: /** @type {import('vue').PropType<any[]>} */ (Array), required: true },
});

const emit = defineEmits({
  /** Se creó, editó o eliminó un grupo: hay que recargar. */
  cambio: () => true,
});

const toast = useToast();
const pantallaGrande = useMediaQuery('(min-width: 1024px)');

const panelAbierto = ref(false);
const grupoEditado = ref(/** @type {any} */ (null));
const plantillaElegida = ref(/** @type {any} */ (null));

/**
 * Abre el panel para editar un grupo o crear uno nuevo (en blanco o desde una plantilla).
 * @param {any} grupo
 * @param {any} [plantilla]
 */
function abrir(grupo, plantilla = null) {
  grupoEditado.value = grupo;
  plantillaElegida.value = plantilla;
  panelAbierto.value = true;
}

/** @param {string} titulo */
function alTerminar(titulo) {
  panelAbierto.value = false;
  toast.add({ title: titulo, icon: 'i-lucide-circle-check', color: 'success' });
  emit('cambio');
}

/**
 * Texto de una opción en la tarjeta: "Queso +$3.000" o solo el nombre si no cuesta.
 * @param {{ nombre: string, precioExtra: string }} opcion
 */
function textoDeOpcion(opcion) {
  return aDecimal(opcion.precioExtra).gt(0)
    ? `${opcion.nombre} +${formatearPesos(opcion.precioExtra)}`
    : opcion.nombre;
}
</script>

<template>
  <div class="space-y-4">
    <UEmpty
      v-if="!grupos.length"
      icon="i-lucide-list-checks"
      title="Aún no hay opciones"
      description="Crea grupos como el término de la carne, las adiciones con precio o los ingredientes para quitar, y asígnalos a los productos."
    >
      <template #actions>
        <div class="flex flex-wrap justify-center gap-2">
          <UButton
            v-for="plantilla in PLANTILLAS_DE_GRUPO"
            :key="plantilla.nombre"
            :icon="plantilla.icono"
            :label="plantilla.nombre"
            size="lg"
            color="neutral"
            variant="outline"
            @click="abrir(null, plantilla)"
          />
          <UButton icon="i-lucide-plus" label="En blanco" size="lg" @click="abrir(null)" />
        </div>
      </template>
    </UEmpty>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-muted">
          {{ grupos.length }} {{ grupos.length === 1 ? 'grupo' : 'grupos' }} de opciones
        </p>
        <UButton icon="i-lucide-plus" label="Nuevo grupo" @click="abrir(null)" />
      </div>

      <ul class="grid gap-3 md:grid-cols-2">
        <li v-for="grupo in grupos" :key="grupo.id">
          <button
            type="button"
            class="h-full w-full space-y-2 rounded-xl bg-default p-4 text-left ring-1 ring-default transition hover:ring-primary focus-visible:outline-2 focus-visible:outline-primary"
            :aria-label="`Editar ${grupo.nombre}`"
            @click="abrir(grupo)"
          >
            <span class="flex flex-wrap items-center gap-2">
              <span class="font-semibold text-highlighted">{{ grupo.nombre }}</span>
              <UBadge
                :color="grupo.minimo > 0 ? 'primary' : 'neutral'"
                variant="subtle"
                size="sm"
                :label="grupo.minimo > 0 ? 'Obligatorio' : 'Opcional'"
              />
              <span class="text-sm text-muted">{{ describirRegla(grupo) }}</span>
            </span>
            <span class="flex flex-wrap gap-1.5">
              <span
                v-for="opcion in grupo.opciones"
                :key="opcion.id"
                class="cifra rounded-md bg-elevated px-2 py-0.5 text-sm"
                :class="!opcion.activo && 'text-muted line-through'"
              >
                {{ textoDeOpcion(opcion) }}
              </span>
            </span>
            <span class="flex items-center gap-1.5 text-sm text-muted">
              <UIcon name="i-lucide-utensils" class="size-4" />
              {{
                grupo.productos === 0
                  ? 'Aún no está en ningún producto'
                  : `En ${grupo.productos} ${grupo.productos === 1 ? 'producto' : 'productos'}`
              }}
            </span>
          </button>
        </li>
      </ul>
    </template>

    <USlideover
      v-model:open="panelAbierto"
      :side="pantallaGrande ? 'right' : 'bottom'"
      :title="grupoEditado ? 'Editar grupo de opciones' : 'Nuevo grupo de opciones'"
    >
      <template #body>
        <FormularioGrupoOpciones
          :key="grupoEditado?.id ?? plantillaElegida?.nombre ?? 'nuevo'"
          :grupo="grupoEditado"
          :plantilla="plantillaElegida"
          :orden-nuevo="grupos.length"
          @guardado="alTerminar('Grupo guardado')"
          @eliminado="alTerminar('Grupo eliminado')"
          @cancelar="panelAbierto = false"
        />
      </template>
    </USlideover>
  </div>
</template>
