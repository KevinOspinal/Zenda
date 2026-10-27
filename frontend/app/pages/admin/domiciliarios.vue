<!--
  Domiciliarios del negocio: quienes llevan los domicilios. No inician sesión: la caja les
  asigna los pedidos al despacharlos. No se borran; se desactivan para conservar su historial.
-->
<script setup>
definePageMeta({ seccion: 'domiciliarios' });

const toast = useToast();
const pantallaGrande = useMediaQuery('(min-width: 1024px)');

const domiciliarios = ref(/** @type {any[]} */ ([]));
const cargando = ref(true);
const error = ref('');
async function cargar() {
  error.value = '';
  try {
    domiciliarios.value = await useApi().get('/domiciliarios');
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  } finally {
    cargando.value = false;
  }
}
cargar();

const activos = computed(() => domiciliarios.value.filter((d) => d.activo).length);

// Registrar y editar.
const panelAbierto = ref(false);
const editado = ref(/** @type {any} */ (null));
/** @param {any} domiciliario */
function abrir(domiciliario) {
  editado.value = domiciliario;
  panelAbierto.value = true;
}
function alGuardar() {
  panelAbierto.value = false;
  toast.add({ title: 'Domiciliario guardado', icon: 'i-lucide-circle-check', color: 'success' });
  cargar();
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-muted">
        {{ activos }} {{ activos === 1 ? 'activo' : 'activos' }} de {{ domiciliarios.length }}
      </p>
      <UButton
        size="lg"
        icon="i-lucide-user-plus"
        label="Nuevo domiciliario"
        @click="abrir(null)"
      />
    </div>

    <div v-if="cargando" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <USkeleton v-for="n in 3" :key="n" class="h-24 rounded-xl" />
    </div>
    <UEmpty
      v-else-if="error"
      icon="i-lucide-wifi-off"
      title="No pudimos cargar los domiciliarios"
      :description="error"
      :actions="[{ label: 'Reintentar', icon: 'i-lucide-rotate-cw', onClick: cargar }]"
    />
    <UEmpty
      v-else-if="!domiciliarios.length"
      icon="i-lucide-bike"
      title="Aún no hay domiciliarios"
      description="Registra a quienes llevan los domicilios para asignarles los pedidos."
      :actions="[
        { label: 'Nuevo domiciliario', icon: 'i-lucide-user-plus', onClick: () => abrir(null) },
      ]"
    />

    <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="domiciliario in domiciliarios"
        :key="domiciliario.id"
        class="flex items-start gap-3 rounded-xl bg-default p-4 ring-1 ring-default"
        :class="!domiciliario.activo && 'opacity-60'"
      >
        <UAvatar :alt="domiciliario.nombre" size="lg" />
        <div class="min-w-0 flex-1 space-y-1.5">
          <p class="truncate font-semibold text-highlighted">{{ domiciliario.nombre }}</p>
          <a
            :href="`tel:${domiciliario.telefono.replace(/\s/g, '')}`"
            class="flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <UIcon name="i-lucide-phone" class="size-4" />
            {{ domiciliario.telefono }}
          </a>
          <UBadge
            :color="domiciliario.activo ? 'success' : 'neutral'"
            variant="subtle"
            :icon="domiciliario.activo ? 'i-lucide-circle-check' : 'i-lucide-circle-pause'"
            :label="domiciliario.activo ? 'Activo' : 'Inactivo'"
          />
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-pencil"
          :aria-label="`Editar a ${domiciliario.nombre}`"
          @click="abrir(domiciliario)"
        />
      </div>
    </div>

    <USlideover
      v-model:open="panelAbierto"
      :side="pantallaGrande ? 'right' : 'bottom'"
      :title="editado ? `Editar a ${editado.nombre}` : 'Nuevo domiciliario'"
    >
      <template #body>
        <FormularioDomiciliario
          :key="editado?.id ?? 'nuevo'"
          :domiciliario="editado"
          @guardado="alGuardar"
          @cancelar="panelAbierto = false"
        />
      </template>
    </USlideover>
  </div>
</template>
