<!--
  Mapa de mesas en vivo: libres, ocupadas (con su tiempo y su total) y con platos listos.
  Tocar una mesa libre empieza un pedido; tocar una ocupada abre su pedido.
  Sin caja abierta no se pueden tomar pedidos: se avisa arriba.
-->
<script setup>
definePageMeta({ seccion: 'mesas' });

const mesas = useMesasStore();
const pedidos = usePedidosStore();
const caja = useCajaStore();
const sesion = useSesionStore();
const toast = useToast();
const ahora = useNow({ interval: 30_000 });

/** Trae las mesas, los pedidos activos y si la caja está abierta. */
function cargar() {
  return Promise.all([mesas.cargar(), pedidos.cargarActivos(), caja.cargarEstado()]);
}
cargar();

const zonaActiva = ref('Todas');
const mesasVisibles = computed(() =>
  zonaActiva.value === 'Todas'
    ? mesas.lista
    : mesas.lista.filter((mesa) => (mesa.zona || SIN_ZONA) === zonaActiva.value),
);

/** Lo que muestra la tarjeta de cada mesa, según su pedido activo. */
const datosPorMesa = computed(() => {
  const datos = new Map();
  for (const mesa of mesas.lista) {
    const pedido = pedidos.pedidoDeMesa(mesa.id);
    datos.set(mesa.id, {
      pedido,
      minutos: pedido ? minutosTranscurridos(pedido.abiertoEn, ahora.value) : null,
      total: pedido?.total ?? null,
      platosListos: Boolean(pedido?.items?.some((i) => i.estadoCocina === 'listo')),
    });
  }
  return datos;
});

const libres = computed(() => mesas.lista.filter((mesa) => mesa.estado === 'libre').length);
const ocupadas = computed(() => mesas.lista.length - libres.value);
const conPlatosListos = computed(
  () => [...datosPorMesa.value.values()].filter((datos) => datos.platosListos).length,
);

/** @param {import('~/stores/mesas.js').Mesa} mesa */
function abrirMesa(mesa) {
  const { pedido } = datosPorMesa.value.get(mesa.id) ?? {};
  if (pedido) return navigateTo(`/pedidos/${pedido.id}`);
  if (mesa.estado === 'ocupada') {
    // Ocupada en otro dispositivo hace un instante: se trae su pedido.
    pedidos.cargarActivos();
    return;
  }
  if (caja.abierta === false) {
    toast.add({
      title: 'La caja está cerrada',
      description: 'Hay que abrirla para tomar pedidos.',
      icon: 'i-lucide-lock',
      color: 'warning',
    });
    return;
  }
  return navigateTo(`/pedidos/nuevo?mesa=${mesa.id}`);
}
</script>

<template>
  <div class="space-y-5">
    <UAlert
      v-if="caja.abierta === false"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="La caja está cerrada"
      :description="
        puede(sesion.rol, 'manejarCaja')
          ? 'Ábrela para empezar a tomar pedidos.'
          : 'Pide al cajero que la abra para tomar pedidos.'
      "
      :actions="
        puede(sesion.rol, 'manejarCaja')
          ? [{ label: 'Ir a la caja', to: '/caja', color: 'warning', variant: 'outline' }]
          : []
      "
    />

    <!-- Cargando: tarjetas con la forma de las mesas. -->
    <div
      v-if="mesas.estadoCarga === 'cargando' || mesas.estadoCarga === 'sin_cargar'"
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      <USkeleton v-for="n in 8" :key="n" class="h-36 rounded-xl" />
    </div>

    <UEmpty
      v-else-if="mesas.estadoCarga === 'error'"
      icon="i-lucide-wifi-off"
      title="No pudimos cargar las mesas"
      :description="mesas.errorCarga"
      :actions="[{ label: 'Reintentar', icon: 'i-lucide-rotate-cw', onClick: cargar }]"
    />

    <UEmpty
      v-else-if="!mesas.lista.length"
      icon="i-lucide-armchair"
      title="Aún no hay mesas"
      description="El dueño o el administrador las crea en Administración."
    />

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div
          v-if="mesas.zonas.length > 1"
          class="flex gap-2 overflow-x-auto"
          role="group"
          aria-label="Filtrar por zona"
        >
          <UButton
            v-for="zona in ['Todas', ...mesas.zonas]"
            :key="zona"
            :label="zona"
            size="lg"
            class="shrink-0"
            :color="zonaActiva === zona ? 'primary' : 'neutral'"
            :variant="zonaActiva === zona ? 'solid' : 'soft'"
            :aria-pressed="zonaActiva === zona"
            @click="zonaActiva = zona"
          />
        </div>
        <p class="text-sm text-muted">
          <span class="font-semibold text-success">{{ libres }} libres</span>
          ·
          <span class="font-semibold text-warning">{{ ocupadas }} ocupadas</span>
          <template v-if="conPlatosListos">
            ·
            <span class="font-semibold text-info">{{ conPlatosListos }} con platos listos</span>
          </template>
        </p>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <TarjetaMesa
          v-for="mesa in mesasVisibles"
          :key="mesa.id"
          :mesa="mesa"
          :tiene-platos-listos="datosPorMesa.get(mesa.id)?.platosListos"
          :minutos-abierta="datosPorMesa.get(mesa.id)?.minutos ?? null"
          :total="datosPorMesa.get(mesa.id)?.total ?? null"
          :resaltada="mesas.resaltadas.has(mesa.id)"
          @seleccionar="abrirMesa"
        />
      </div>
    </template>
  </div>
</template>
