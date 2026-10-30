<!--
  Las entregas del domiciliario: su única pantalla, en el celular.
  - Arriba, cuántas lleva en camino y cuánto debe entregar en la caja.
  - La entrega en curso en grande y, si lleva varias, las demás para elegir cuál sigue.
  - Abajo, fijo y grande, "Entregado". Se puede deshacer unos segundos: la entrega se oculta
    enseguida, pero solo se confirma si no se deshace (perdonar un toque por error).
  - Lo que tiene por entregar en la caja: los contra entrega ya cobrados.
  Cuando la caja le asigna un domicilio, suena, vibra y la tarjeta se resalta.
-->
<script setup>
definePageMeta({ layout: 'domiciliario', seccion: 'entregas' });
useHead({ title: 'Mis entregas · Zenda' });

const entregas = useEntregasStore();
const preferencias = usePreferenciasStore();
const sonidos = useSonidos();
const toast = useToast();

entregas.cargar();

/** Segundos para deshacer un "Entregado" tocado por error. */
const SEGUNDOS_PARA_DESHACER = 5;

const elegidaId = ref('');
/** La entrega en grande: la que eligió o la que salió primero. */
const actual = computed(
  () =>
    entregas.enCamino.find((pedido) => pedido.id === elegidaId.value) ??
    entregas.enCamino[0] ??
    null,
);
const otras = computed(() => entregas.enCamino.filter((pedido) => pedido.id !== actual.value?.id));

// Le asignaron un domicilio: suena, vibra, se le avisa y la tarjeta se resalta un momento.
const nuevaId = ref('');
watch(
  () => entregas.ultimaAsignada,
  (asignada) => {
    const pedido = asignada && entregas.porId[asignada.id];
    if (!pedido) return;
    sonidos.domicilioAsignado();
    if (preferencias.vibracion) navigator.vibrate?.([80, 60, 80, 60, 160]);
    toast.add({
      title: '¡Nuevo domicilio!',
      description: `${nombreDelPedido(pedido)} · ${pedido.entrega.direccion}`,
      icon: 'i-lucide-bike',
      color: 'primary',
    });
    nuevaId.value = pedido.id;
    setTimeout(() => {
      if (nuevaId.value === pedido.id) nuevaId.value = '';
    }, 4000);
  },
);

/** Temporizadores de las entregas que esperan confirmarse, por id. */
const porConfirmar = new Map();

/**
 * Toca "Entregado": la entrega sale de la pantalla ya y se confirma en unos segundos, salvo
 * que la deshaga.
 * @param {any} pedido
 */
function marcarEntregado(pedido) {
  const { id } = pedido;
  entregas.ocultar(id);
  elegidaId.value = '';
  if (preferencias.vibracion) navigator.vibrate?.(30);
  const debe = porCobrarAlEntregar(pedido);
  toast.add({
    id: `entregado-${id}`,
    title: `${nombreDelPedido(pedido)} entregado`,
    description: debe.isZero()
      ? 'Ya estaba pagado.'
      : `Guarda ${formatearPesos(debe)} para entregar en la caja.`,
    icon: 'i-lucide-circle-check-big',
    color: 'success',
    duration: SEGUNDOS_PARA_DESHACER * 1000,
    actions: [
      {
        label: 'Deshacer',
        icon: 'i-lucide-undo-2',
        color: 'neutral',
        variant: 'outline',
        onClick: () => deshacer(id),
      },
    ],
  });
  porConfirmar.set(
    id,
    setTimeout(() => confirmar(pedido), SEGUNDOS_PARA_DESHACER * 1000),
  );
}

/**
 * Se equivocó: la entrega vuelve y queda como la entrega en curso.
 * @param {string} id
 */
function deshacer(id) {
  clearTimeout(porConfirmar.get(id));
  porConfirmar.delete(id);
  entregas.mostrar(id);
  elegidaId.value = id;
}

/** @param {any} pedido */
async function confirmar(pedido) {
  porConfirmar.delete(pedido.id);
  try {
    await entregas.entregar(pedido.id);
    sonidos.entregaHecha();
  } catch (fallo) {
    toast.add({
      title: fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO,
      description: `No se pudo marcar ${nombreDelPedido(pedido)} como entregado. Inténtalo de nuevo.`,
      icon: 'i-lucide-circle-alert',
      color: 'error',
    });
  }
}

// Si sale de la pantalla con una entrega por confirmar, se confirma ya: no se pierde.
onBeforeUnmount(() => {
  for (const [id, temporizador] of porConfirmar) {
    clearTimeout(temporizador);
    const pedido = entregas.porId[id];
    if (pedido) confirmar(pedido);
  }
});
</script>

<template>
  <div class="space-y-5">
    <!-- De un vistazo: cuántas lleva y cuánto debe llevar a la caja. -->
    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-2xl bg-default p-4 ring-1 ring-default">
        <p class="flex items-center gap-1.5 text-sm text-muted">
          <UIcon name="i-lucide-bike" class="size-4" />
          En camino
        </p>
        <p class="cifra text-3xl font-bold text-highlighted">{{ entregas.enCamino.length }}</p>
      </div>
      <div class="rounded-2xl bg-default p-4 ring-1 ring-default">
        <p class="flex items-center gap-1.5 text-sm text-muted">
          <UIcon name="i-lucide-hand-coins" class="size-4" />
          Para la caja
        </p>
        <CifraAnimada
          :valor="entregas.totalPorLiquidar"
          class="block truncate text-2xl leading-9 font-bold text-highlighted"
        />
      </div>
    </div>

    <div
      v-if="entregas.estadoCarga === 'cargando' || entregas.estadoCarga === 'sin_cargar'"
      class="space-y-3"
    >
      <USkeleton class="h-96 rounded-2xl" />
    </div>

    <UEmpty
      v-else-if="entregas.estadoCarga === 'error'"
      icon="i-lucide-wifi-off"
      title="No pudimos cargar tus entregas"
      description="Revisa la conexión e inténtalo de nuevo."
      :actions="[{ label: 'Reintentar', icon: 'i-lucide-rotate-cw', onClick: entregas.cargar }]"
    />

    <template v-else>
      <Transition
        mode="out-in"
        enter-from-class="translate-y-3 opacity-0"
        enter-active-class="transition duration-300 motion-reduce:transition-none"
        leave-to-class="-translate-y-3 opacity-0"
        leave-active-class="transition duration-200 motion-reduce:transition-none"
      >
        <TarjetaEntrega
          v-if="actual"
          :key="actual.id"
          :pedido="actual"
          :nueva="nuevaId === actual.id"
        />
        <div v-else class="rounded-2xl bg-default px-6 py-12 text-center ring-1 ring-default">
          <span class="mx-auto grid size-20 place-items-center rounded-full bg-primary/10">
            <UIcon name="i-lucide-bike" class="size-10 text-primary" />
          </span>
          <p class="mt-5 text-xl font-bold text-highlighted">Sin entregas por ahora</p>
          <p class="mx-auto mt-2 max-w-xs text-muted">
            Cuando la caja te asigne un domicilio, te avisamos aquí con sonido y vibración.
          </p>
        </div>
      </Transition>

      <OtrasEntregas v-if="otras.length" :pedidos="otras" @elegir="elegidaId = $event" />

      <PorLiquidar
        v-if="entregas.porLiquidar.length"
        :pedidos="entregas.porLiquidar"
        :total="entregas.totalPorLiquidar"
      />
    </template>

    <!-- "Entregado", fijo abajo y al alcance del pulgar. -->
    <div
      v-if="actual"
      class="fixed inset-x-0 bottom-0 z-30 border-t border-default bg-default/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur"
    >
      <div class="mx-auto max-w-xl">
        <UButton
          size="xl"
          block
          icon="i-lucide-check-check"
          class="min-h-16 text-lg"
          label="Entregado"
          :aria-label="`Entregado: ${nombreDelPedido(actual)}`"
          @click="marcarEntregado(actual)"
        />
      </div>
    </div>
  </div>
</template>
