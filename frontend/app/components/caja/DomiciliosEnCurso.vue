<!--
  Domicilios en curso en la caja, el que más espera primero: los que no se han entregado y los
  que están por liquidar (contra entrega, entregados, con el dinero aún en manos del
  domiciliario). Arriba, lo que trae cada domiciliario para recibirlo de una vez.
  Desde aquí se cobran los de pago anticipado, se despachan (con el domiciliario y sus datos por
  WhatsApp), se marcan como entregados y se liquidan. El cobro lo abre la página de caja.
-->
<script setup>
const emit = defineEmits({
  /** @param {any} _domicilio Domicilio que hay que cobrar antes de marcarlo entregado. */
  cobrarYEntregar: (_domicilio) => true,
  /** @param {any} _domicilio Domicilio de pago anticipado que hay que cobrar antes de salir. */
  cobrar: (_domicilio) => true,
});

const domicilios = useDomiciliosStore();
const toast = useToast();

const despachando = ref(false);
const elegido = ref(/** @type {any} */ (null));
const liquidando = ref(false);
const grupoElegido = ref(/** @type {any} */ (null));

/** @param {unknown} fallo */
function avisarError(fallo) {
  toast.add({
    title: fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO,
    icon: 'i-lucide-circle-alert',
    color: 'error',
  });
}

/**
 * Manda el domicilio a la cocina (también si ya se cobró).
 * @param {any} domicilio
 */
async function enviarACocina(domicilio) {
  try {
    await domicilios.enviarACocina(domicilio.id);
  } catch (fallo) {
    avisarError(fallo);
  }
}

/** @param {any} domicilio */
function despachar(domicilio) {
  elegido.value = domicilio;
  despachando.value = true;
}

/**
 * Marca un domicilio como entregado. Si no se ha cobrado (contra entrega), primero el cobro.
 * @param {any} domicilio
 */
async function entregar(domicilio) {
  if (domicilio.estado !== 'pagado') {
    emit('cobrarYEntregar', domicilio);
    return;
  }
  try {
    await domicilios.entregar(domicilio.id);
    toast.add({
      title: `${nombreDelPedido(domicilio)} entregado`,
      icon: 'i-lucide-check-check',
      color: 'success',
    });
  } catch (fallo) {
    avisarError(fallo);
  }
}

/**
 * Abre la liquidación del domiciliario de este domicilio, con todo lo que tiene por liquidar.
 * @param {string} domiciliarioId
 */
function liquidar(domiciliarioId) {
  grupoElegido.value =
    domicilios.porLiquidar.find((grupo) => grupo.domiciliario.id === domiciliarioId) ?? null;
  liquidando.value = Boolean(grupoElegido.value);
}
</script>

<template>
  <section v-if="domicilios.lista.length" class="space-y-3" aria-labelledby="titulo-domicilios">
    <h2
      id="titulo-domicilios"
      class="flex items-center gap-2 text-lg font-semibold text-highlighted"
    >
      <UIcon name="i-lucide-bike" class="size-5 text-primary" />
      Domicilios en curso
      <UBadge :label="String(domicilios.lista.length)" color="primary" variant="subtle" />
    </h2>

    <!-- Lo que trae cada domiciliario: se recibe de una vez. -->
    <div v-if="domicilios.porLiquidar.length" class="flex flex-wrap gap-2">
      <button
        v-for="grupo in domicilios.porLiquidar"
        :key="grupo.domiciliario.id"
        type="button"
        class="flex min-h-12 items-center gap-3 rounded-xl bg-secondary/10 px-4 py-2 text-left ring-1 ring-secondary/30 transition hover:bg-secondary/15 focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.98] motion-reduce:transition-none"
        @click="liquidar(grupo.domiciliario.id)"
      >
        <UIcon name="i-lucide-hand-coins" class="size-5 text-secondary" />
        <span>
          <span class="block font-semibold text-highlighted">
            {{ grupo.domiciliario.nombre }} trae {{ formatearPesos(grupo.total) }}
          </span>
          <span class="text-xs text-muted">
            {{ grupo.pedidos.length }}
            {{ grupo.pedidos.length === 1 ? 'domicilio por liquidar' : 'domicilios por liquidar' }}
            · Recibir
          </span>
        </span>
      </button>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <TarjetaDomicilio
        v-for="domicilio in domicilios.lista"
        :key="domicilio.id"
        :domicilio="domicilio"
        @enviar-a-cocina="enviarACocina(domicilio)"
        @cobrar="emit('cobrar', domicilio)"
        @despachar="despachar(domicilio)"
        @entregar="entregar(domicilio)"
        @liquidar="liquidar(domicilio.entrega.domiciliario.id)"
      />
    </div>
    <DespacharDomicilio v-model:abierto="despachando" :pedido="elegido" />
    <LiquidarDomiciliario v-model:abierto="liquidando" :grupo="grupoElegido" />
  </section>
</template>
