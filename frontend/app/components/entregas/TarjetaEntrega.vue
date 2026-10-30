<!--
  La entrega que el domiciliario lleva ahora, en grande: a quién y a dónde va, los botones
  para llegar (Google Maps o Waze) y para hablar con el cliente, cuánto cobrar y el cambio que
  lleva (o que ya está pagado) y qué productos lleva. Pensada para leerse de un vistazo en la
  calle: textos grandes, alto contraste y botones de 56 px.
-->
<script setup>
const props = defineProps({
  /** Domicilio con sus ítems y su entrega (forma del API). */
  pedido: { type: /** @type {import('vue').PropType<any>} */ (Object), required: true },
  /** Recién asignado: se resalta un momento. */
  nueva: { type: Boolean, default: false },
});

const sesion = useSesionStore();
const ahora = useNow({ interval: 30_000 });

const entrega = computed(() => props.pedido.entrega);
const ciudad = computed(() => sesion.negocio?.ciudad ?? null);
const origen = computed(() => ORIGENES_PEDIDO[props.pedido.origen] ?? ORIGENES_PEDIDO.otro);
const minutos = computed(() => minutosTranscurridos(entrega.value.despachadoEn, ahora.value));
const cobrar = computed(() => porCobrarAlEntregar(props.pedido));
const cambio = computed(() => cambioParaLlevar(props.pedido));
const telefono = computed(() => entrega.value.telefono.replace(/\s/g, ''));
const mensajeAlCliente = computed(
  () =>
    `Hola ${props.pedido.nombreCliente ?? ''}, soy ${sesion.usuario?.nombre ?? 'el domiciliario'} ` +
    `de ${sesion.negocio?.nombre ?? 'el restaurante'}. Voy en camino con tu pedido.`,
);
/** Cómo llegar (Google Maps o Waze) y cómo hablar con el cliente. */
const acciones = computed(() => [
  {
    etiqueta: 'Google Maps',
    icono: 'i-lucide-navigation',
    enlace: enlaceGoogleMaps(entrega.value, ciudad.value),
    externa: true,
    principal: true,
  },
  {
    etiqueta: 'Waze',
    icono: 'i-lucide-route',
    enlace: enlaceWaze(entrega.value, ciudad.value),
    externa: true,
    principal: false,
  },
  {
    etiqueta: 'Llamar',
    icono: 'i-lucide-phone',
    enlace: `tel:${telefono.value}`,
    externa: false,
    principal: false,
  },
  {
    etiqueta: 'WhatsApp',
    icono: 'i-lucide-message-circle',
    enlace: enlaceWhatsApp(entrega.value.telefono, mensajeAlCliente.value),
    externa: true,
    principal: false,
  },
]);
const cantidadDeProductos = computed(() =>
  sumar((props.pedido.items ?? []).map((/** @type {any} */ item) => item.cantidad)),
);
</script>

<template>
  <article
    class="overflow-hidden rounded-2xl bg-default shadow-sm ring-1 transition duration-500 motion-reduce:transition-none"
    :class="nueva ? 'ring-4 ring-primary' : 'ring-default'"
    :aria-label="`Entrega ${nombreDelPedido(pedido)}`"
  >
    <!-- A quién y desde cuándo. -->
    <header
      class="flex items-start justify-between gap-3 bg-primary/5 px-4 pt-4 pb-3 sm:px-5 sm:pt-5"
    >
      <div class="min-w-0">
        <p class="truncate text-2xl font-bold text-highlighted">{{ nombreDelPedido(pedido) }}</p>
        <p class="mt-1 flex items-center gap-1.5 text-sm text-muted">
          <UIcon :name="origen.icono" class="size-4" />
          {{ origen.etiqueta }}
        </p>
      </div>
      <span
        class="cifra flex shrink-0 items-center gap-1.5 rounded-full bg-default px-3 py-1.5 text-sm font-semibold text-highlighted ring-1 ring-default"
      >
        <UIcon name="i-lucide-timer" class="size-4 text-primary" />
        {{ duracionCorta(minutos) }}
      </span>
    </header>

    <div class="space-y-5 p-4 sm:p-5">
      <!-- A dónde. -->
      <div class="flex items-start gap-3">
        <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10">
          <UIcon name="i-lucide-map-pin" class="size-6 text-primary" />
        </span>
        <div class="min-w-0">
          <p class="text-xl leading-snug font-semibold text-highlighted">
            {{ entrega.direccion }}
          </p>
          <p v-if="entrega.indicaciones" class="mt-1 text-base text-toned">
            {{ entrega.indicaciones }}
          </p>
          <p v-if="entrega.ubicacionUrl" class="mt-1 flex items-center gap-1 text-sm text-success">
            <UIcon name="i-lucide-locate-fixed" class="size-4" />
            El cliente mandó su ubicación exacta
          </p>
        </div>
      </div>

      <!-- Cómo llegar y cómo hablar con el cliente: baldosas grandes, ícono arriba y texto
           abajo, que caben de a dos aun en un celular de 360 px. -->
      <div class="grid grid-cols-2 gap-3">
        <a
          v-for="accion in acciones"
          :key="accion.etiqueta"
          :href="accion.enlace"
          :target="accion.externa ? '_blank' : undefined"
          :rel="accion.externa ? 'noopener' : undefined"
          class="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none"
          :class="
            accion.principal
              ? 'bg-primary text-inverted shadow-sm'
              : 'bg-elevated text-highlighted ring-1 ring-default'
          "
        >
          <UIcon :name="accion.icono" class="size-6" />
          {{ accion.etiqueta }}
        </a>
      </div>

      <!-- El dinero, en grande. -->
      <div
        v-if="cobrar.isZero()"
        class="flex items-center gap-3 rounded-xl bg-success/10 p-4 ring-1 ring-success/30"
      >
        <UIcon name="i-lucide-circle-check-big" class="size-8 shrink-0 text-success" />
        <div>
          <p class="text-lg font-bold text-highlighted">Ya está pagado</p>
          <p class="text-sm text-toned">No le cobres nada al cliente.</p>
        </div>
      </div>
      <div v-else class="rounded-xl bg-warning/10 p-4 ring-1 ring-warning/30">
        <p class="text-sm font-medium text-toned">Contra entrega · cóbrale</p>
        <p class="cifra text-4xl font-bold tracking-tight text-highlighted">
          {{ formatearPesos(cobrar) }}
        </p>
        <p
          v-if="cambio"
          class="cifra mt-2 flex flex-wrap items-center gap-x-2 text-base text-toned"
        >
          <span>Paga con {{ formatearPesos(entrega.pagaCon) }}</span>
          <UIcon name="i-lucide-arrow-right" class="size-4" />
          <span class="font-semibold text-highlighted">
            lleva {{ formatearPesos(cambio) }} de cambio
          </span>
        </p>
      </div>

      <!-- Qué lleva: para revisar el paquete antes de salir. -->
      <UCollapsible v-if="pedido.items?.length" :unmount-on-hide="false">
        <UButton
          color="neutral"
          variant="ghost"
          size="lg"
          block
          class="justify-between"
          trailing-icon="i-lucide-chevron-down"
          :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform' }"
        >
          <span class="flex items-center gap-2">
            <UIcon name="i-lucide-package" class="size-5" />
            Qué llevas ({{ formatearCantidad(cantidadDeProductos) }})
          </span>
        </UButton>
        <template #content>
          <ul class="space-y-2 px-2 pt-2">
            <li v-for="item in pedido.items" :key="item.id" class="flex gap-3">
              <span class="cifra w-8 shrink-0 text-right font-bold text-highlighted">
                {{ formatearCantidad(item.cantidad) }}
              </span>
              <span class="min-w-0">
                <span class="block text-highlighted">{{ item.producto.nombre }}</span>
                <span v-if="item.notas" class="block text-sm text-muted">{{ item.notas }}</span>
              </span>
            </li>
          </ul>
        </template>
      </UCollapsible>
    </div>
  </article>
</template>
