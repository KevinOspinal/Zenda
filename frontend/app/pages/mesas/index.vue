<!--
  Mapa de mesas en vivo: libres, ocupadas (con su tiempo y su total) y con platos listos.
  Tocar una mesa libre empieza un pedido; tocar una ocupada abre su pedido. Una mesa que ya
  pagó sigue ocupada hasta que le entreguen los platos: tocarla abre ese pedido cobrado.
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

/**
 * Lo que muestra la tarjeta de cada mesa: su pedido activo o, si ya pagó y espera platos de la
 * cocina, ese pedido cobrado.
 */
const datosPorMesa = computed(() => {
  // Mesas con platos listos para llevar, de pedidos por cobrar o ya cobrados.
  const mesasConPlatosListos = new Set(
    pedidos.pedidosConPlatosListos().map(({ pedido }) => pedido.mesaId),
  );
  const datos = new Map();
  for (const mesa of mesas.lista) {
    const activo = pedidos.pedidoDeMesa(mesa.id);
    const cobrado =
      activo || mesa.estado !== 'ocupada' ? null : pedidos.pedidoCobradoDeMesa(mesa.id);
    const pedido = activo ?? cobrado;
    datos.set(mesa.id, {
      pedido,
      pagada: Boolean(cobrado),
      minutos: pedido ? minutosTranscurridos(pedido.abiertoEn, ahora.value) : null,
      total: activo?.total ?? null,
      platosListos: Boolean(pedido) && mesasConPlatosListos.has(mesa.id),
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
async function abrirMesa(mesa) {
  let { pedido } = datosPorMesa.value.get(mesa.id) ?? {};
  if (!pedido && mesa.estado === 'ocupada') {
    // Ocupada sin pedido a la vista: quizá se ocupó en otro dispositivo hace un instante. Si
    // tampoco aparece al traer los pedidos, no tiene nada en curso y se puede tomar uno nuevo.
    await pedidos.cargarActivos();
    pedido = datosPorMesa.value.get(mesa.id)?.pedido;
  }
  if (pedido) return navigateTo(`/pedidos/${pedido.id}`);
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
      description="El dueño o el administrador las crea en «Mesas y zonas»."
      :actions="
        puede(sesion.rol, 'gestionarMesas')
          ? [{ label: 'Crear mesas', icon: 'i-lucide-plus', to: '/admin/mesas' }]
          : []
      "
    />

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div
          v-if="mesas.zonas.length > 1"
          class="flex max-w-full min-w-0 gap-2 overflow-x-auto pb-1"
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
        <UButton
          v-if="puede(sesion.rol, 'gestionarMesas')"
          to="/admin/mesas"
          color="neutral"
          variant="ghost"
          icon="i-lucide-pencil"
          label="Editar mesas"
          class="order-last sm:order-none"
        />
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
          :pagada="datosPorMesa.get(mesa.id)?.pagada"
          :resaltada="mesas.resaltadas.has(mesa.id)"
          @seleccionar="abrirMesa"
        />
      </div>
    </template>
  </div>
</template>
