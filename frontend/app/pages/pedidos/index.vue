<!--
  "Mis pedidos" del mesero: sus pedidos abiertos y en cocina, con cómo van sus platos.
  Se puede ver también los de todos los meseros.
-->
<script setup>
definePageMeta({ seccion: 'pedidos' });

const pedidos = usePedidosStore();
const sesion = useSesionStore();
const ahora = useNow({ interval: 30_000 });

pedidos.cargarActivos();

const verTodos = ref(false);
const visibles = computed(() =>
  verTodos.value
    ? pedidos.lista
    : pedidos.lista.filter((pedido) => pedido.meseroId === sesion.usuario?.id),
);
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between gap-3">
      <p class="text-muted">
        {{ visibles.length }} {{ visibles.length === 1 ? 'pedido abierto' : 'pedidos abiertos' }}
      </p>
      <USwitch v-model="verTodos" label="Ver los de todos" />
    </div>

    <div
      v-if="pedidos.estadoCarga === 'cargando' || pedidos.estadoCarga === 'sin_cargar'"
      class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      <USkeleton v-for="n in 4" :key="n" class="h-36 rounded-xl" />
    </div>

    <UEmpty
      v-else-if="pedidos.estadoCarga === 'error'"
      icon="i-lucide-wifi-off"
      title="No pudimos cargar los pedidos"
      :description="pedidos.errorCarga"
      :actions="[
        { label: 'Reintentar', icon: 'i-lucide-rotate-cw', onClick: pedidos.cargarActivos },
      ]"
    />

    <UEmpty
      v-else-if="!visibles.length"
      icon="i-lucide-notebook-pen"
      :title="verTodos ? 'No hay pedidos abiertos' : 'No tienes pedidos abiertos'"
      description="Abre una mesa para empezar a tomar un pedido."
      :actions="[{ label: 'Ir a las mesas', icon: 'i-lucide-layout-grid', to: '/mesas' }]"
    />

    <TransitionGroup
      v-else
      tag="div"
      class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      enter-from-class="opacity-0 -translate-y-1"
      enter-active-class="transition duration-200 motion-reduce:transition-none"
      leave-to-class="opacity-0"
      leave-active-class="transition duration-200 motion-reduce:transition-none"
    >
      <TarjetaPedido
        v-for="pedido in visibles"
        :key="pedido.id"
        :pedido="pedido"
        :minutos="minutosTranscurridos(pedido.abiertoEn, ahora)"
        @abrir="navigateTo(`/pedidos/${pedido.id}`)"
      />
    </TransitionGroup>
  </div>
</template>
