<!--
  Cliente para la factura, opcional: sin cliente, la factura va a "consumidor final".
  Se busca por nombre o número de documento, o se registra uno nuevo ahí mismo.
-->
<script setup>
/** @typedef {import('~/stores/clientes.js').Cliente} Cliente */

const cliente = defineModel({
  type: /** @type {import('vue').PropType<Cliente | null>} */ (Object),
  default: null,
});

const clientes = useClientesStore();
const abierto = ref(false);
const registrando = ref(false);
const busqueda = ref('');
const resultados = ref(/** @type {Cliente[]} */ ([]));
const buscando = ref(false);

watchDebounced(
  busqueda,
  async (texto) => {
    if (texto.trim().length < 2) {
      resultados.value = [];
      return;
    }
    buscando.value = true;
    try {
      resultados.value = await clientes.buscar(texto);
    } catch {
      resultados.value = [];
    } finally {
      buscando.value = false;
    }
  },
  { debounce: 300 },
);

/** @param {Cliente} elegido */
function elegir(elegido) {
  cliente.value = elegido;
  abierto.value = false;
  registrando.value = false;
  busqueda.value = '';
}
</script>

<template>
  <div class="space-y-3">
    <!-- Cliente elegido. -->
    <div
      v-if="cliente"
      class="flex items-center justify-between gap-3 rounded-xl bg-elevated/60 p-3 ring-1 ring-default"
    >
      <div class="flex min-w-0 items-center gap-3">
        <UIcon name="i-lucide-contact" class="size-5 shrink-0 text-primary" />
        <div class="min-w-0">
          <p class="truncate font-semibold text-highlighted">{{ cliente.nombre }}</p>
          <p class="text-sm text-muted">
            {{ cliente.tipoDocumento.toUpperCase() }} {{ cliente.numeroDocumento }}
          </p>
        </div>
      </div>
      <UButton color="neutral" variant="ghost" label="Quitar" @click="cliente = null" />
    </div>

    <UButton
      v-else-if="!abierto"
      color="neutral"
      variant="link"
      icon="i-lucide-contact"
      label="Factura a nombre de un cliente (opcional)"
      class="px-0"
      @click="abierto = true"
    />

    <!-- Buscar o registrar. -->
    <div v-else class="space-y-3 rounded-xl p-4 ring-1 ring-default">
      <template v-if="!registrando">
        <UInput
          v-model="busqueda"
          icon="i-lucide-search"
          size="lg"
          class="w-full"
          placeholder="Nombre o número de documento"
          aria-label="Buscar cliente"
          :loading="buscando"
          autofocus
        />
        <ul v-if="resultados.length" class="max-h-48 space-y-1 overflow-y-auto">
          <li v-for="resultado in resultados" :key="resultado.id">
            <button
              type="button"
              class="w-full rounded-lg px-3 py-2 text-left hover:bg-elevated"
              @click="elegir(resultado)"
            >
              <span class="block font-medium text-highlighted">{{ resultado.nombre }}</span>
              <span class="text-sm text-muted">
                {{ resultado.tipoDocumento.toUpperCase() }} {{ resultado.numeroDocumento }}
              </span>
            </button>
          </li>
        </ul>
        <p v-else-if="busqueda.trim().length >= 2 && !buscando" class="text-sm text-muted">
          No encontramos ese cliente.
        </p>
        <div class="flex flex-wrap justify-between gap-2">
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-user-plus"
            label="Registrar cliente nuevo"
            @click="registrando = true"
          />
          <UButton color="neutral" variant="ghost" label="Cancelar" @click="abierto = false" />
        </div>
      </template>
      <FormularioCliente v-else @guardado="elegir" @cancelar="registrando = false" />
    </div>
  </div>
</template>
