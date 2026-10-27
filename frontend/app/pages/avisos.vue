<!--
  Avisos del mesero: las mesas con platos listos para llevar, una tarjeta por mesa (no una
  por plato), para que la lista no se llene cuando salen varios pedidos a la vez.
  Llegan en vivo (con sonido y vibración). "Entregar todo" entrega de una vez los platos
  listos de la mesa; cada plato también se puede entregar solo, si se llevan por partes.
-->
<script setup>
definePageMeta({ seccion: 'avisos' });

const pedidos = usePedidosStore();
const sesion = useSesionStore();
const toast = useToast();

pedidos.cargarActivos();

const verTodos = ref(false);
const avisos = computed(() =>
  pedidos.pedidosConPlatosListos(verTodos.value ? undefined : sesion.usuario?.id),
);
const totalPlatos = computed(() =>
  avisos.value.reduce((suma, aviso) => suma + aviso.items.length, 0),
);

/** Platos que se están marcando como entregados. */
const entregando = ref(/** @type {Set<string>} */ (new Set()));

/** @param {unknown} error */
function avisarError(error) {
  toast.add({
    title: error instanceof ErrorApi ? error.message : MENSAJE_ERROR_GENERICO,
    icon: 'i-lucide-circle-alert',
    color: 'error',
  });
}

/**
 * Entrega un solo plato (cuando se llevan por partes).
 * @param {any} pedido
 * @param {any} item
 */
async function entregarPlato(pedido, item) {
  entregando.value.add(item.id);
  try {
    await pedidos.cambiarEstadoCocina(pedido.id, item.id, 'entregado');
  } catch (error) {
    avisarError(error);
  } finally {
    entregando.value.delete(item.id);
  }
}

/**
 * Entrega de una vez todos los platos listos de la mesa: la tarjeta sale de la lista.
 * @param {{ pedido: any, items: any[] }} aviso
 */
async function entregarTodo({ pedido, items }) {
  for (const item of items) entregando.value.add(item.id);
  try {
    await pedidos.cambiarEstadoCocinaDelPedido(pedido.id, 'entregado');
  } catch (error) {
    avisarError(error);
  } finally {
    for (const item of items) entregando.value.delete(item.id);
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between gap-3">
      <p class="text-muted" aria-live="polite">
        <template v-if="avisos.length">
          {{ avisos.length }} {{ avisos.length === 1 ? 'mesa' : 'mesas' }} con platos listos ·
          {{ totalPlatos }} {{ totalPlatos === 1 ? 'plato' : 'platos' }}
        </template>
        <template v-else>Nada por llevar</template>
      </p>
      <USwitch v-model="verTodos" label="Ver los de todos" />
    </div>

    <div
      v-if="pedidos.estadoCarga === 'cargando' || pedidos.estadoCarga === 'sin_cargar'"
      class="space-y-3"
    >
      <USkeleton v-for="n in 3" :key="n" class="h-32 rounded-xl" />
    </div>

    <UEmpty
      v-else-if="!avisos.length"
      icon="i-lucide-bell"
      title="No hay platos listos por ahora"
      description="Cuando la cocina termine un plato de tus mesas, te avisamos con un sonido."
    />

    <TransitionGroup
      v-else
      tag="div"
      class="grid gap-3 lg:grid-cols-2"
      enter-from-class="opacity-0 -translate-y-2"
      enter-active-class="transition duration-300 motion-reduce:transition-none"
      leave-to-class="opacity-0 translate-x-8"
      leave-active-class="transition duration-200 motion-reduce:transition-none"
    >
      <AvisoDeMesa
        v-for="aviso in avisos"
        :key="aviso.pedido.id"
        :pedido="aviso.pedido"
        :items="aviso.items"
        :entregando="entregando"
        @entregar="(item) => entregarPlato(aviso.pedido, item)"
        @entregar-todo="entregarTodo(aviso)"
      />
    </TransitionGroup>
  </div>
</template>
