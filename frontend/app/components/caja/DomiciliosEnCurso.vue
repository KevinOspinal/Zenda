<!--
  Domicilios en curso en la caja: los que no se han entregado, el que más espera primero.
  Desde aquí se despachan (con el domiciliario y sus datos por WhatsApp) y se marcan como
  entregados. Si un domicilio no se ha cobrado, primero se cobra (lo hace la página de caja).
-->
<script setup>
const emit = defineEmits({
  /** @param {any} _domicilio Domicilio que hay que cobrar antes de marcarlo entregado. */
  cobrarYEntregar: (_domicilio) => true,
});

const domicilios = useDomiciliosStore();
const toast = useToast();

const despachando = ref(false);
const elegido = ref(/** @type {any} */ (null));

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
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <TarjetaDomicilio
        v-for="domicilio in domicilios.lista"
        :key="domicilio.id"
        :domicilio="domicilio"
        @enviar-a-cocina="enviarACocina(domicilio)"
        @despachar="despachar(domicilio)"
        @entregar="entregar(domicilio)"
      />
    </div>
    <DespacharDomicilio v-model:abierto="despachando" :pedido="elegido" />
  </section>
</template>
