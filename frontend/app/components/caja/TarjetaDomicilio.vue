<!--
  Un domicilio en curso: a quién y a dónde va, en qué etapa está (con ícono y texto), cuánto
  hay que cobrar, el cambio que debe llevar el domiciliario y la acción que sigue:
  agregar productos y despachar, o marcarlo como entregado cuando el cliente lo recibió.
-->
<script setup>
const props = defineProps({
  /** Domicilio con sus ítems y su entrega (forma del API). */
  domicilio: { type: /** @type {import('vue').PropType<any>} */ (Object), required: true },
});

const emit = defineEmits({ despachar: () => true, entregar: () => true });

const ahora = useNow({ interval: 30_000 });
const etapa = computed(() => etapaDelDomicilio(props.domicilio));
const enCamino = computed(() => etapa.value === 'en_camino');
const pagado = computed(() => props.domicilio.estado === 'pagado');
const cambio = computed(() => cambioParaLlevar(props.domicilio));
const origen = computed(() => ORIGENES_PEDIDO[props.domicilio.origen] ?? ORIGENES_PEDIDO.otro);
/** Minutos desde que salió, o desde que se registró si aún no sale. */
const minutos = computed(() =>
  minutosTranscurridos(
    props.domicilio.entrega?.despachadoEn ?? props.domicilio.abiertoEn,
    ahora.value,
  ),
);
</script>

<template>
  <article class="flex flex-col gap-3 rounded-xl bg-default p-4 ring-1 ring-default">
    <header class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="truncate text-lg font-bold text-highlighted">
          {{ nombreDelPedido(domicilio) }}
        </h3>
        <p class="flex items-center gap-1.5 text-sm text-muted">
          <UIcon :name="origen.icono" class="size-4" />
          {{ origen.etiqueta }} · {{ duracionCorta(minutos) }}
        </p>
      </div>
      <ChipEstado :apariencia="ETAPAS_DOMICILIO[etapa]" />
    </header>

    <div class="space-y-1 text-sm">
      <p class="flex items-start gap-1.5 text-default">
        <UIcon name="i-lucide-map-pin" class="mt-0.5 size-4 shrink-0 text-muted" />
        <span>
          {{ domicilio.entrega?.direccion }}
          <span v-if="domicilio.entrega?.indicaciones" class="block text-muted">
            {{ domicilio.entrega.indicaciones }}
          </span>
        </span>
      </p>
      <a
        v-if="domicilio.entrega?.telefono"
        :href="`tel:${domicilio.entrega.telefono.replace(/\s/g, '')}`"
        class="flex items-center gap-1.5 text-primary hover:underline"
      >
        <UIcon name="i-lucide-phone" class="size-4" />
        {{ domicilio.entrega.telefono }}
      </a>
      <p v-if="enCamino" class="flex items-center gap-1.5 font-medium text-highlighted">
        <UIcon name="i-lucide-bike" class="size-4 text-primary" />
        Con {{ domicilio.entrega.domiciliario?.nombre }}
      </p>
    </div>

    <div class="flex flex-wrap items-baseline justify-between gap-2 border-t border-default pt-3">
      <span v-if="pagado" class="flex items-center gap-1.5 font-semibold text-success">
        <UIcon name="i-lucide-circle-check" class="size-4" />
        Pagado
      </span>
      <span v-else class="cifra font-bold text-highlighted">
        Cobrar {{ formatearPesos(domicilio.total) }}
      </span>
      <span v-if="cambio" class="cifra text-sm text-muted">
        Lleva cambio de {{ formatearPesos(cambio) }}
      </span>
    </div>

    <div class="mt-auto grid grid-cols-2 gap-2">
      <template v-if="enCamino">
        <UButton
          :to="`/pedidos/${domicilio.id}`"
          color="neutral"
          variant="soft"
          size="lg"
          icon="i-lucide-receipt"
          label="Ver pedido"
        />
        <UButton
          size="lg"
          icon="i-lucide-check-check"
          :label="pagado ? 'Entregado' : 'Cobrar y entregar'"
          @click="emit('entregar')"
        />
      </template>
      <template v-else>
        <UButton
          :to="`/pedidos/${domicilio.id}`"
          color="neutral"
          variant="soft"
          size="lg"
          :icon="etapa === 'sin_enviar' ? 'i-lucide-plus' : 'i-lucide-receipt'"
          :label="etapa === 'sin_enviar' ? 'Agregar productos' : 'Ver pedido'"
        />
        <UButton
          size="lg"
          icon="i-lucide-bike"
          label="Despachar"
          :variant="etapa === 'listo_para_salir' ? 'solid' : 'soft'"
          :disabled="!domicilio.items?.length"
          @click="emit('despachar')"
        />
      </template>
    </div>
  </article>
</template>
