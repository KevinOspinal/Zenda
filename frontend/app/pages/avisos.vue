<!--
  Avisos del mesero: los platos que la cocina tiene listos para llevar a sus mesas.
  Llegan en vivo (con sonido y vibración); al llevar el plato se marca "Entregado".
-->
<script setup>
definePageMeta({ seccion: 'avisos' });

const pedidos = usePedidosStore();
const sesion = useSesionStore();
const toast = useToast();

pedidos.cargarActivos();

const verTodos = ref(false);
const avisos = computed(() =>
  pedidos.platosListos(verTodos.value ? undefined : sesion.usuario?.id),
);

/** Platos que se están marcando como entregados. */
const entregando = ref(/** @type {Set<string>} */ (new Set()));

/**
 * Marca un plato como entregado: sale de la lista.
 * @param {{ item: any, pedido: any }} aviso
 */
async function marcarEntregado({ item, pedido }) {
  entregando.value.add(item.id);
  try {
    await pedidos.cambiarEstadoCocina(pedido.id, item.id, 'entregado');
  } catch (error) {
    toast.add({
      title: error instanceof ErrorApi ? error.message : MENSAJE_ERROR_GENERICO,
      icon: 'i-lucide-circle-alert',
      color: 'error',
    });
  } finally {
    entregando.value.delete(item.id);
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between gap-3">
      <p class="text-muted" aria-live="polite">
        {{ avisos.length }}
        {{ avisos.length === 1 ? 'plato listo para llevar' : 'platos listos para llevar' }}
      </p>
      <USwitch v-model="verTodos" label="Ver los de todos" />
    </div>

    <div
      v-if="pedidos.estadoCarga === 'cargando' || pedidos.estadoCarga === 'sin_cargar'"
      class="space-y-3"
    >
      <USkeleton v-for="n in 3" :key="n" class="h-24 rounded-xl" />
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
      class="space-y-3"
      enter-from-class="opacity-0 -translate-y-2"
      enter-active-class="transition duration-300 motion-reduce:transition-none"
      leave-to-class="opacity-0 translate-x-8"
      leave-active-class="transition duration-200 motion-reduce:transition-none"
    >
      <AvisoPlatoListo
        v-for="aviso in avisos"
        :key="aviso.item.id"
        :item="aviso.item"
        :pedido="aviso.pedido"
        :entregando="entregando.has(aviso.item.id)"
        @entregado="marcarEntregado(aviso)"
      />
    </TransitionGroup>
  </div>
</template>
