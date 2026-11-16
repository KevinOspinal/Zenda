<!--
  Vista rápida de una mesa ocupada, al lado del mapa (tablet horizontal y PC): el mapa sigue a
  la vista y tocar otra mesa cambia lo que se ve aquí. Muestra quién la atiende, cuánto lleva,
  cómo va la cocina, sus platos y el total, con las acciones a mano:
  - Entregar de una vez los platos listos.
  - Cobrar (quien puede cobrar y si no se ha pagado). El cobro lo abre la página (evento
    `cobrar`), para que el resumen del cobro no se cierre si la mesa se libera mientras tanto.
  - Abrir el pedido (agregar productos, dividir, anular) e imprimir la precuenta.
-->
<script setup>
const props = defineProps({
  mesa: {
    type: /** @type {import('vue').PropType<{ id: string, nombre: string, zona?: string | null,
      capacidad: number, estado: 'libre' | 'ocupada' }>} */ (Object),
    required: true,
  },
  /** Lo que el mapa sabe de la mesa (ver datosDeMesa en utils/mesas.js); con pedido. */
  datos: {
    type: /** @type {import('vue').PropType<import('~/utils/mesas.js').DatosDeMesa>} */ (Object),
    required: true,
  },
});

const emit = defineEmits({ cerrar: () => true, cobrar: () => true });

const pedidos = usePedidosStore();
const sesion = useSesionStore();
const toast = useToast();
const { preparando, imprimirPrecuenta } = useImpresionDePrecuenta();

const pedido = computed(() => props.datos.pedido);
const estadoVisual = computed(() =>
  estadoVisualDeMesa(props.mesa.estado, props.datos.platosListos),
);
const listos = computed(() => props.datos.avance?.listo ?? 0);
const puedeCobrar = computed(() => !props.datos.pagada && puede(sesion.rol, 'cobrar'));
const urgencia = computed(() =>
  props.datos.minutosEsperando === null ? null : urgenciaDeEspera(props.datos.minutosEsperando),
);
const detalle = computed(() =>
  [props.mesa.zona, `${props.mesa.capacidad} puestos`].filter(Boolean).join(' · '),
);

/** Entrega de una vez los platos listos de la mesa (suena al instante, como en los avisos). */
const entregando = ref(false);
async function entregarListos() {
  entregando.value = true;
  try {
    await pedidos.cambiarEstadoCocinaDelPedido(pedido.value.id, 'entregado');
  } catch (error) {
    toast.add({
      title: error instanceof ErrorApi ? error.message : MENSAJE_ERROR_GENERICO,
      icon: 'i-lucide-circle-alert',
      color: 'error',
    });
  } finally {
    entregando.value = false;
  }
}
</script>

<template>
  <aside
    class="flex max-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-2xl border border-default bg-default shadow-xl"
    :aria-label="`Vista rápida de ${mesa.nombre}`"
  >
    <header class="flex items-start gap-3 border-b border-default p-4">
      <FiguraMesa :capacidad="mesa.capacidad" :estado="estadoVisual" class="w-20 shrink-0" />
      <div class="min-w-0 flex-1">
        <h2 class="truncate text-xl font-bold text-highlighted">{{ mesa.nombre }}</h2>
        <p class="truncate text-sm text-muted">{{ detalle }}</p>
        <ChipEstado :apariencia="ESTADOS_MESA[estadoVisual]" tamano="sm" class="mt-2" />
      </div>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="lg"
        aria-label="Cerrar la vista rápida"
        @click="emit('cerrar')"
      />
    </header>

    <div class="flex-1 space-y-4 overflow-y-auto p-4">
      <dl class="grid grid-cols-2 gap-3 text-sm">
        <div class="min-w-0">
          <dt class="text-muted">Atiende</dt>
          <dd class="mt-1 flex min-w-0 items-center gap-2 font-medium text-highlighted">
            <UAvatar v-if="datos.mesero" :alt="datos.mesero" size="2xs" />
            <span class="truncate">{{ datos.mesero ?? 'Sin asignar' }}</span>
          </dd>
        </div>
        <div>
          <dt class="text-muted">En la mesa</dt>
          <dd class="cifra mt-1 font-medium text-highlighted">
            {{ duracionCorta(datos.minutos ?? 0) }}
          </dd>
        </div>
      </dl>

      <UAlert
        v-if="datos.sinEnviar"
        color="primary"
        variant="subtle"
        icon="i-lucide-send"
        title="Sin enviar a cocina"
        description="Abre el pedido y envíalo para que la cocina empiece."
      />
      <UAlert
        v-else-if="urgencia && urgencia.nivel !== 'normal'"
        :color="urgencia.color"
        variant="subtle"
        icon="i-lucide-alarm-clock"
        :title="`Esperando la cocina hace ${duracionCorta(datos.minutosEsperando ?? 0)}`"
      />

      <section v-if="datos.avance?.total && !datos.sinEnviar" class="space-y-2">
        <h3 class="text-sm font-semibold text-highlighted">Cocina</h3>
        <BarraCocina :avance="datos.avance" con-leyenda />
      </section>

      <section>
        <h3 class="text-sm font-semibold text-highlighted">Pedido</h3>
        <ResumenCuenta :items="pedido.items ?? []" solo-lectura />
      </section>
    </div>

    <footer class="space-y-2 border-t border-default p-4">
      <div class="flex items-baseline justify-between pb-1">
        <span class="text-sm font-semibold text-toned">{{
          datos.pagada ? 'Pagado' : 'Total'
        }}</span>
        <CifraAnimada :valor="pedido.total" class="text-2xl font-bold text-highlighted" />
      </div>
      <UButton
        v-if="listos"
        block
        size="xl"
        color="info"
        icon="i-lucide-hand-platter"
        :loading="entregando"
        @click="entregarListos"
      >
        {{ listos === 1 ? 'Entregar el plato listo' : `Entregar los ${listos} platos listos` }}
      </UButton>
      <UButton v-if="puedeCobrar" block size="xl" icon="i-lucide-banknote" @click="emit('cobrar')">
        Cobrar {{ formatearPesos(pedido.total) }}
      </UButton>
      <div class="grid gap-2" :class="datos.pagada ? 'grid-cols-1' : 'grid-cols-2'">
        <UButton
          block
          size="lg"
          :color="puedeCobrar ? 'neutral' : 'primary'"
          :variant="puedeCobrar ? 'soft' : 'solid'"
          icon="i-lucide-notebook-pen"
          label="Abrir pedido"
          :to="`/pedidos/${pedido.id}`"
        />
        <UButton
          v-if="!datos.pagada"
          block
          size="lg"
          color="neutral"
          variant="soft"
          icon="i-lucide-printer"
          label="Precuenta"
          :loading="preparando"
          :disabled="!pedido.items?.length"
          @click="imprimirPrecuenta(pedido.id)"
        />
      </div>
    </footer>
  </aside>
</template>
