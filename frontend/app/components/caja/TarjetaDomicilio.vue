<!--
  Un domicilio en curso en la caja: a quién y a dónde va, en qué etapa está (con ícono y texto),
  cómo paga y cuánto falta, y la acción que sigue según su forma de pago:
  - Sin enviar a cocina: "Enviar a cocina".
  - Pago anticipado sin cobrar: "Cobrar" (solo sale pagado).
  - En cocina: espera; solo se despacha cuando la cocina lo tiene listo.
  - Listo para salir: "Despachar".
  - En camino: "Entregado" (o "Cobrar y entregar" si es contra entrega y el domiciliario volvió
    con el dinero sin marcarlo desde su celular).
  - Por liquidar (contra entrega, entregado sin cobrar): "Recibir" el dinero del domiciliario.
  Los productos se pueden agregar mientras no se haya cobrado ni despachado.
-->
<script setup>
const props = defineProps({
  /** Domicilio con sus ítems y su entrega (forma del API). */
  domicilio: { type: /** @type {import('vue').PropType<any>} */ (Object), required: true },
});

const emit = defineEmits({
  enviarACocina: () => true,
  cobrar: () => true,
  despachar: () => true,
  entregar: () => true,
  liquidar: () => true,
});

const ahora = useNow({ interval: 30_000 });
const etapa = computed(() => etapaDelDomicilio(props.domicilio));
const enCamino = computed(() => etapa.value === 'en_camino');
const porLiquidar = computed(() => etapa.value === 'por_liquidar');
const pagado = computed(() => props.domicilio.estado === 'pagado');
const forma = computed(
  () =>
    FORMAS_PAGO_DOMICILIO[props.domicilio.entrega?.formaPago] ??
    FORMAS_PAGO_DOMICILIO.contra_entrega,
);
/** Pago anticipado que todavía no se cobra: solo sale pagado. */
const faltaCobrar = computed(
  () =>
    props.domicilio.entrega?.formaPago === 'anticipado' &&
    !pagado.value &&
    etapa.value !== 'sin_enviar',
);
/** Un pedido cobrado o que ya salió no admite más productos. */
const sePuedenAgregar = computed(() => !pagado.value && !enCamino.value && !porLiquidar.value);
const cambio = computed(() => cambioParaLlevar(props.domicilio));
const domiciliario = computed(() => props.domicilio.entrega?.domiciliario ?? null);
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
      <p
        v-if="(enCamino || porLiquidar) && domiciliario"
        class="flex items-center gap-1.5 font-medium text-highlighted"
      >
        <UIcon name="i-lucide-bike" class="size-4 text-primary" />
        {{ porLiquidar ? 'Lo entregó' : 'Con' }} {{ domiciliario.nombre }}
      </p>
    </div>

    <!-- Cómo paga y cuánto falta. -->
    <div class="space-y-1 border-t border-default pt-3">
      <p class="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
        <UIcon :name="forma.icono" class="size-4" />
        {{ forma.etiqueta }}
      </p>
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <span v-if="pagado" class="flex items-center gap-1.5 font-semibold text-success">
          <UIcon name="i-lucide-circle-check" class="size-4" />
          Pagado
        </span>
        <span v-else-if="porLiquidar" class="cifra font-bold text-highlighted">
          Por recibir {{ formatearPesos(domicilio.total) }}
        </span>
        <span v-else-if="faltaCobrar" class="cifra font-bold text-warning">
          Cobrar {{ formatearPesos(domicilio.total) }} antes de salir
        </span>
        <span v-else class="cifra font-bold text-highlighted">
          Cobra al entregar {{ formatearPesos(domicilio.total) }}
        </span>
        <span v-if="cambio && !porLiquidar" class="cifra text-sm text-muted">
          Lleva cambio de {{ formatearPesos(cambio) }}
        </span>
      </div>
    </div>

    <div class="mt-auto grid grid-cols-2 gap-2">
      <UButton
        :to="`/pedidos/${domicilio.id}`"
        color="neutral"
        variant="soft"
        size="lg"
        :icon="sePuedenAgregar ? 'i-lucide-plus' : 'i-lucide-receipt'"
        :label="sePuedenAgregar ? 'Agregar productos' : 'Ver pedido'"
      />
      <UButton
        v-if="etapa === 'sin_enviar'"
        size="lg"
        icon="i-lucide-chef-hat"
        label="Enviar a cocina"
        :disabled="!domicilio.items?.length"
        @click="emit('enviarACocina')"
      />
      <UButton
        v-else-if="faltaCobrar"
        size="lg"
        color="warning"
        icon="i-lucide-wallet-cards"
        label="Cobrar"
        @click="emit('cobrar')"
      />
      <!-- Solo se despacha cuando la cocina lo tiene listo. -->
      <UButton
        v-else-if="etapa === 'en_cocina'"
        size="lg"
        color="neutral"
        variant="soft"
        icon="i-lucide-hourglass"
        label="Esperando a la cocina"
        disabled
      />
      <UButton
        v-else-if="etapa === 'listo_para_salir'"
        size="lg"
        icon="i-lucide-bike"
        label="Despachar"
        @click="emit('despachar')"
      />
      <UButton
        v-else-if="enCamino"
        size="lg"
        icon="i-lucide-check-check"
        :label="pagado ? 'Entregado' : 'Cobrar y entregar'"
        @click="emit('entregar')"
      />
      <UButton
        v-else-if="porLiquidar"
        size="lg"
        color="secondary"
        icon="i-lucide-hand-coins"
        label="Recibir dinero"
        @click="emit('liquidar')"
      />
    </div>
  </article>
</template>
