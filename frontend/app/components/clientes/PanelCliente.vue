<!--
  Vista rápida de un cliente, al lado de la lista (tablet horizontal y PC). La lista sigue a la
  vista y tocar otro cliente cambia lo que se ve aquí. Tiene tres modos:
  - ver: la ficha (FichaCliente) con «Editar» abajo;
  - editar: el formulario en el mismo lugar, sin salir de la lista;
  - nuevo: el formulario vacío (o con lo que se buscó).
  Entre la ficha y el formulario, uno se desliza hacia el otro.
-->
<script setup>
/** @typedef {import('~/stores/clientes.js').Cliente} Cliente */

const props = defineProps({
  /** El cliente de la ficha (null al registrar uno nuevo). */
  cliente: { type: /** @type {import('vue').PropType<Cliente | null>} */ (Object), default: null },
  modo: {
    type: /** @type {import('vue').PropType<'ver' | 'editar' | 'nuevo'>} */ (String),
    default: 'ver',
  },
  /** Datos con los que empieza un cliente nuevo. */
  inicial: {
    type: /** @type {import('vue').PropType<{ nombre?: string, numeroDocumento?: string } | null>} */ (
      Object
    ),
    default: null,
  },
});

const emit = defineEmits({
  cerrar: () => true,
  editar: () => true,
  /** Se canceló la edición o el registro. */
  cancelar: () => true,
  /** @param {Cliente} _cliente */
  guardado: (_cliente) => true,
  /** @param {Cliente} _cliente El que ya tiene ese documento. */
  existente: (_cliente) => true,
});

const titulo = computed(() =>
  props.modo === 'nuevo' ? 'Nuevo cliente' : (props.cliente?.nombre ?? ''),
);
</script>

<template>
  <!-- Alto máximo: la pantalla menos el encabezado y la explicación de arriba. -->
  <aside
    class="flex max-h-[calc(100dvh-9.5rem)] flex-col overflow-hidden rounded-2xl border border-default bg-default shadow-xl"
    :aria-label="modo === 'nuevo' ? 'Registrar un cliente' : `Ficha de ${titulo}`"
  >
    <header class="flex items-start gap-3 border-b border-default p-4">
      <AvatarIniciales
        v-if="cliente && modo !== 'nuevo'"
        :nombre="cliente.nombre"
        :tono="tonoDeTexto(cliente.id)"
        tamano="xl"
      />
      <span
        v-else
        aria-hidden="true"
        class="grid size-16 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
      >
        <UIcon name="i-lucide-user-plus" class="size-7" />
      </span>
      <div class="min-w-0 flex-1 pt-1">
        <h2 class="line-clamp-2 text-xl leading-tight font-bold text-highlighted">
          {{ titulo }}
        </h2>
        <p class="cifra mt-1 truncate text-sm text-muted">
          {{
            cliente && modo !== 'nuevo'
              ? etiquetaDeDocumento(cliente)
              : 'A nombre de quién se factura'
          }}
        </p>
      </div>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="lg"
        aria-label="Cerrar la ficha"
        @click="emit('cerrar')"
      />
    </header>

    <div class="flex-1 overflow-x-hidden overflow-y-auto p-4">
      <Transition name="paso" mode="out-in">
        <FichaCliente
          v-if="modo === 'ver' && cliente"
          :key="`ver-${cliente.id}`"
          :cliente="cliente"
          @editar="emit('editar')"
        />
        <FormularioCliente
          v-else
          :key="modo === 'nuevo' ? 'nuevo' : `editar-${cliente?.id}`"
          :cliente="modo === 'nuevo' ? null : cliente"
          :inicial="modo === 'nuevo' ? inicial : null"
          botones-fijos
          @guardado="(guardado) => emit('guardado', guardado)"
          @cancelar="emit('cancelar')"
          @existente="(existente) => emit('existente', existente)"
        />
      </Transition>
    </div>

    <footer v-if="modo === 'ver' && cliente" class="border-t border-default p-4">
      <UButton
        block
        size="xl"
        color="primary"
        variant="soft"
        icon="i-lucide-pencil"
        label="Editar"
        @click="emit('editar')"
      />
    </footer>
  </aside>
</template>
