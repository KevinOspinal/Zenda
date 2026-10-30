<!--
  Despachar un domicilio: se elige quién lo lleva y sale del local. Si el domiciliario tiene
  acceso a Zenda, le aparece en vivo en su celular. Después, un botón abre WhatsApp con los
  datos listos para enviarle (dirección con su enlace de Google Maps, teléfono del cliente,
  cuánto cobrar y el cambio que debe llevar): útil para quien no tiene acceso.
-->
<script setup>
const props = defineProps({
  /** Domicilio con su entrega (forma del API). */
  pedido: { type: /** @type {import('vue').PropType<any>} */ (Object), default: null },
});
const abierto = defineModel('abierto', { type: Boolean, default: false });

const domicilios = useDomiciliosStore();
const sesion = useSesionStore();
const toast = useToast();

const domiciliarioId = ref('');
const cargando = ref(false);
const errorCarga = ref('');
/** El domicilio ya salió: se muestra el paso de WhatsApp. */
const despachado = ref(/** @type {any} */ (null));

// Al abrir: trae los domiciliarios activos y, si hay uno solo, lo deja elegido.
watch(
  abierto,
  async (estaAbierto) => {
    if (!estaAbierto) return;
    despachado.value = null;
    domiciliarioId.value = '';
    errorCarga.value = '';
    cargando.value = true;
    try {
      await domicilios.cargarDomiciliarios();
      if (domicilios.domiciliarios.length === 1) {
        domiciliarioId.value = domicilios.domiciliarios[0].id;
      }
    } catch (fallo) {
      errorCarga.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
    } finally {
      cargando.value = false;
    }
  },
  { immediate: true },
);

const opciones = computed(() =>
  domicilios.domiciliarios.map((domiciliario) => ({
    value: domiciliario.id,
    label: domiciliario.nombre,
    description: domiciliario.acceso?.activo
      ? `${domiciliario.telefono} · lo ve en su celular`
      : domiciliario.telefono,
  })),
);

/** El domiciliario que lo lleva entra a Zenda: el domicilio ya le apareció en su celular. */
const loVeEnZenda = computed(() => {
  const id = despachado.value?.entrega?.domiciliario?.id;
  return Boolean(domicilios.domiciliarios.find((d) => d.id === id)?.acceso?.activo);
});

async function despachar() {
  if (!props.pedido || !domiciliarioId.value) return;
  try {
    despachado.value = await domicilios.despachar(props.pedido.id, domiciliarioId.value);
  } catch (fallo) {
    toast.add({
      title: fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO,
      icon: 'i-lucide-circle-alert',
      color: 'error',
    });
  }
}

/** Enlace de WhatsApp al domiciliario con los datos del domicilio que acaba de salir. */
const enlace = computed(() => {
  const domiciliario = despachado.value?.entrega?.domiciliario;
  return domiciliario
    ? enlaceWhatsApp(
        domiciliario.telefono,
        mensajeParaDomiciliario(despachado.value, sesion.negocio?.ciudad),
      )
    : '';
});
</script>

<template>
  <UModal
    v-model:open="abierto"
    :title="pedido ? `Despachar ${nombreDelPedido(pedido)}` : 'Despachar'"
    :description="pedido?.entrega?.direccion"
  >
    <template #body>
      <!-- 2. Ya salió: mandarle los datos al domiciliario. -->
      <div v-if="despachado" class="space-y-4 text-center">
        <UIcon name="i-lucide-bike" class="mx-auto size-12 text-primary" />
        <p class="text-lg font-semibold text-highlighted">
          Salió con {{ despachado.entrega.domiciliario.nombre }}
        </p>
        <p v-if="loVeEnZenda" class="flex items-center justify-center gap-1.5 text-sm text-muted">
          <UIcon name="i-lucide-smartphone" class="size-4" />
          Ya le apareció en su celular, con el mapa y lo que debe cobrar.
        </p>
        <UButton
          :to="enlace"
          target="_blank"
          external
          block
          size="xl"
          :color="loVeEnZenda ? 'neutral' : 'success'"
          :variant="loVeEnZenda ? 'soft' : 'solid'"
          icon="i-lucide-message-circle"
          label="Enviarle los datos por WhatsApp"
        />
        <UButton
          block
          size="lg"
          color="neutral"
          variant="ghost"
          label="Listo"
          @click="abierto = false"
        />
      </div>

      <!-- 1. Elegir quién lo lleva. -->
      <div v-else class="space-y-4">
        <USkeleton v-if="cargando" class="h-24 rounded-lg" />
        <UAlert
          v-else-if="errorCarga"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="errorCarga"
        />
        <UEmpty
          v-else-if="!opciones.length"
          icon="i-lucide-user-x"
          title="No hay domiciliarios activos"
          :description="
            puede(sesion.rol, 'gestionarDomiciliarios')
              ? 'Regístralos en Domiciliarios.'
              : 'Pídele al administrador que los registre.'
          "
          :actions="
            puede(sesion.rol, 'gestionarDomiciliarios')
              ? [
                  {
                    label: 'Ir a Domiciliarios',
                    to: '/admin/domiciliarios',
                    icon: 'i-lucide-users',
                  },
                ]
              : []
          "
        />
        <URadioGroup
          v-else
          v-model="domiciliarioId"
          :items="opciones"
          variant="card"
          legend="¿Quién lo lleva?"
        />
        <UButton
          block
          size="xl"
          icon="i-lucide-bike"
          label="Despachar"
          :disabled="!domiciliarioId"
          loading-auto
          @click="despachar"
        />
      </div>
    </template>
  </UModal>
</template>
