<!--
  Mesas y zonas: crear (varias de una vez), editar y eliminar. Agrupadas por zona, igual
  que en el mapa.
-->
<script setup>
definePageMeta({ seccion: 'mesasAdmin' });

const mesas = useMesasStore();
const toast = useToast();
const pantallaGrande = useMediaQuery('(min-width: 1024px)');

mesas.cargar();

const porZona = computed(() =>
  mesas.zonas.map((zona) => ({
    zona,
    mesas: mesas.lista.filter((mesa) => (mesa.zona || SIN_ZONA) === zona),
  })),
);
const cantidadPorZona = computed(() =>
  Object.fromEntries(porZona.value.map((grupo) => [grupo.zona, grupo.mesas.length])),
);

const panelAbierto = ref(false);
const mesaEditada = ref(/** @type {any} */ (null));
/** @param {any} mesa */
function abrir(mesa) {
  mesaEditada.value = mesa;
  panelAbierto.value = true;
}
function alGuardar() {
  panelAbierto.value = false;
  toast.add({ title: 'Mesas actualizadas', icon: 'i-lucide-circle-check', color: 'success' });
  mesas.cargar();
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-muted">
        {{ mesas.lista.length }} {{ mesas.lista.length === 1 ? 'mesa' : 'mesas' }} en
        {{ mesas.zonas.length }} {{ mesas.zonas.length === 1 ? 'zona' : 'zonas' }}
      </p>
      <UButton size="lg" icon="i-lucide-plus" label="Agregar mesas" @click="abrir(null)" />
    </div>

    <div
      v-if="mesas.estadoCarga === 'cargando' || mesas.estadoCarga === 'sin_cargar'"
      class="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <USkeleton v-for="n in 8" :key="n" class="h-24 rounded-xl" />
    </div>
    <UEmpty
      v-else-if="!mesas.lista.length"
      icon="i-lucide-armchair"
      title="Aún no hay mesas"
      description="Crea las mesas de tu local; puedes agregar varias de una vez por zona."
      :actions="[{ label: 'Agregar mesas', icon: 'i-lucide-plus', onClick: () => abrir(null) }]"
    />

    <template v-else>
      <section v-for="grupo in porZona" :key="grupo.zona" class="space-y-3">
        <h2 class="text-lg font-semibold text-highlighted">{{ grupo.zona }}</h2>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
          <button
            v-for="mesa in grupo.mesas"
            :key="mesa.id"
            type="button"
            class="flex flex-col gap-1 rounded-xl bg-default p-4 text-left ring-1 ring-default transition hover:ring-accented active:scale-[0.98]"
            :aria-label="`Editar ${mesa.nombre}`"
            @click="abrir(mesa)"
          >
            <span class="flex items-center justify-between font-bold text-highlighted">
              {{ mesa.nombre }}
              <UIcon name="i-lucide-pencil" class="size-4 text-muted" />
            </span>
            <span class="inline-flex items-center gap-1 text-sm text-muted">
              <UIcon name="i-lucide-users" class="size-4" /> {{ mesa.capacidad }} puestos
            </span>
          </button>
        </div>
      </section>
    </template>

    <USlideover
      v-model:open="panelAbierto"
      :side="pantallaGrande ? 'right' : 'bottom'"
      :title="mesaEditada ? `Editar ${mesaEditada.nombre}` : 'Agregar mesas'"
    >
      <template #body>
        <FormularioMesa
          :key="mesaEditada?.id ?? 'nuevas'"
          :mesa="mesaEditada"
          :zonas="mesas.zonas.filter((zona) => zona !== SIN_ZONA)"
          :cantidad-por-zona="cantidadPorZona"
          @guardado="alGuardar"
          @cancelar="panelAbierto = false"
        />
      </template>
    </USlideover>
  </div>
</template>
