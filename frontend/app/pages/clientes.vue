<!--
  Clientes a cuyo nombre se factura: buscar por nombre o documento, registrar y editar.
  Solo los datos necesarios para la factura (Ley 1581 de 2012).
-->
<script setup>
definePageMeta({ seccion: 'clientes' });

const clientesStore = useClientesStore();
const toast = useToast();
const pantallaGrande = useMediaQuery('(min-width: 1024px)');

const busqueda = ref('');
const lista = ref(/** @type {import('~/stores/clientes.js').Cliente[]} */ ([]));
const cargando = ref(true);
const error = ref('');

async function buscar() {
  cargando.value = true;
  error.value = '';
  try {
    lista.value = await clientesStore.buscar(busqueda.value);
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  } finally {
    cargando.value = false;
  }
}
buscar();
watchDebounced(busqueda, buscar, { debounce: 300 });

// Formulario lateral para registrar o editar.
const formularioAbierto = ref(false);
const editando = ref(/** @type {import('~/stores/clientes.js').Cliente | null} */ (null));
/** @param {import('~/stores/clientes.js').Cliente | null} cliente */
function abrirFormulario(cliente) {
  editando.value = cliente;
  formularioAbierto.value = true;
}
/** @param {import('~/stores/clientes.js').Cliente} cliente */
function alGuardar(cliente) {
  formularioAbierto.value = false;
  toast.add({
    title: editando.value ? 'Cliente actualizado' : 'Cliente registrado',
    description: cliente.nombre,
    icon: 'i-lucide-circle-check',
    color: 'success',
  });
  buscar();
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center gap-3">
      <UInput
        v-model="busqueda"
        icon="i-lucide-search"
        size="lg"
        class="min-w-0 flex-1"
        placeholder="Buscar por nombre o documento"
        aria-label="Buscar cliente"
      />
      <UButton
        size="lg"
        icon="i-lucide-user-plus"
        label="Nuevo cliente"
        @click="abrirFormulario(null)"
      />
    </div>

    <div v-if="cargando && !lista.length" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <USkeleton v-for="n in 6" :key="n" class="h-24 rounded-xl" />
    </div>
    <UEmpty
      v-else-if="error"
      icon="i-lucide-wifi-off"
      title="No pudimos cargar los clientes"
      :description="error"
      :actions="[{ label: 'Reintentar', icon: 'i-lucide-rotate-cw', onClick: buscar }]"
    />
    <UEmpty
      v-else-if="!lista.length"
      icon="i-lucide-contact"
      :title="busqueda ? 'No encontramos ese cliente' : 'Aún no hay clientes'"
      description="Registra a quien pida la factura a su nombre."
      :actions="[
        {
          label: 'Nuevo cliente',
          icon: 'i-lucide-user-plus',
          onClick: () => abrirFormulario(null),
        },
      ]"
    />
    <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <button
        v-for="cliente in lista"
        :key="cliente.id"
        type="button"
        class="flex items-start gap-3 rounded-xl bg-default p-4 text-left ring-1 ring-default transition hover:ring-accented active:scale-[0.99]"
        @click="abrirFormulario(cliente)"
      >
        <UAvatar :alt="cliente.nombre" size="lg" />
        <span class="min-w-0 flex-1">
          <span class="block truncate font-semibold text-highlighted">{{ cliente.nombre }}</span>
          <span class="block text-sm text-muted">
            {{ cliente.tipoDocumento.toUpperCase() }} {{ cliente.numeroDocumento }}
          </span>
          <span v-if="cliente.email" class="block truncate text-sm text-muted">{{
            cliente.email
          }}</span>
        </span>
        <UIcon name="i-lucide-pencil" class="size-4 text-muted" />
      </button>
    </div>

    <USlideover
      v-model:open="formularioAbierto"
      :side="pantallaGrande ? 'right' : 'bottom'"
      :title="editando ? 'Editar cliente' : 'Nuevo cliente'"
    >
      <template #body>
        <FormularioCliente
          :key="editando?.id ?? 'nuevo'"
          :cliente="editando"
          @guardado="alGuardar"
          @cancelar="formularioAbierto = false"
        />
      </template>
    </USlideover>
  </div>
</template>
