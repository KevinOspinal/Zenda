<!--
  Un pedido que ya se cobró o se anuló: arriba qué pasó y qué falta (con su acción), la cuenta
  como un recibo, el seguimiento del pedido y, en un domicilio, a dónde va.
  Si se cobró sin pasar por la cocina (por ejemplo, un domicilio pagado por adelantado), se
  puede enviar desde aquí.
-->
<script setup>
const props = defineProps({
  /** Pedido cerrado (forma del API). */
  pedido: { type: /** @type {import('vue').PropType<any>} */ (Object), required: true },
  /** A dónde volver: la caja o el mapa de mesas. */
  volverA: { type: String, required: true },
});

const pedidos = usePedidosStore();
const toast = useToast();
const pantallaAncha = useMediaQuery('(min-width: 640px)');

const tipo = computed(() => tipoDelPedido(props.pedido));
const anulado = computed(() => props.pedido.estado === 'anulado');
/** Se cobró sin pasar por la cocina. */
const sinCocina = computed(
  () => !anulado.value && !props.pedido.enviadoACocinaEn && (props.pedido.items?.length ?? 0) > 0,
);
/** En un domicilio es obligatorio: solo sale cuando la cocina lo tiene listo. */
const faltaCocina = computed(() => sinCocina.value && tipo.value === 'domicilio');
const pasos = computed(() => pasosDelPedido(props.pedido));
const entrega = computed(() => props.pedido.entrega ?? null);

async function enviarACocina() {
  try {
    await pedidos.enviarACocina(props.pedido.id);
    toast.add({
      title: `${nombreDelPedido(props.pedido)} enviado a la cocina`,
      icon: 'i-lucide-chef-hat',
      color: 'success',
    });
    await navigateTo(props.volverA);
  } catch (error) {
    toast.add({
      title: error instanceof ErrorApi ? error.message : MENSAJE_ERROR_GENERICO,
      icon: 'i-lucide-circle-alert',
      color: 'error',
    });
  }
}

/** El aviso de arriba: qué pasó y, si falta algo, qué hacer. */
const aviso = computed(() => {
  if (anulado.value) {
    return {
      color: /** @type {const} */ ('error'),
      icono: 'i-lucide-ban',
      titulo: 'Pedido anulado',
      descripcion: 'No se cobró y ya no se le pueden hacer cambios.',
    };
  }
  if (faltaCocina.value) {
    return {
      color: /** @type {const} */ ('warning'),
      icono: 'i-lucide-chef-hat',
      titulo: 'Falta enviarlo a la cocina',
      descripcion:
        'Ya se cobró, pero la cocina todavía no lo ha visto. Envíalo para que lo preparen; cuando esté listo, lo despachas.',
    };
  }
  return {
    color: /** @type {const} */ ('success'),
    icono: 'i-lucide-circle-check',
    titulo: 'Pedido cobrado',
    descripcion: 'Ya no se le pueden agregar productos.',
  };
});

const acciones = computed(() => [
  ...(sinCocina.value
    ? [
        {
          label: 'Enviar a cocina',
          icon: 'i-lucide-chef-hat',
          size: /** @type {const} */ ('lg'),
          color: /** @type {const} */ (faltaCocina.value ? 'warning' : 'neutral'),
          variant: /** @type {const} */ (faltaCocina.value ? 'solid' : 'outline'),
          onClick: enviarACocina,
        },
      ]
    : []),
  {
    label: 'Volver',
    size: /** @type {const} */ ('lg'),
    color: /** @type {const} */ ('neutral'),
    variant: /** @type {const} */ ('ghost'),
    to: props.volverA,
  },
]);
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <UAlert
      :color="aviso.color"
      variant="subtle"
      :icon="aviso.icono"
      :title="aviso.titulo"
      :description="aviso.descripcion"
      :actions="acciones"
      :orientation="pantallaAncha ? 'horizontal' : 'vertical'"
      :ui="{ title: 'text-base font-semibold', icon: 'size-6' }"
    />

    <div class="grid gap-6 lg:grid-cols-5">
      <TicketDelPedido class="lg:col-span-3" :pedido="pedido" />

      <div class="space-y-6 lg:col-span-2">
        <section class="rounded-xl bg-default p-5 ring-1 ring-default">
          <h2 class="mb-4 text-lg font-semibold text-highlighted">Seguimiento</h2>
          <PasosDelPedido :pasos="pasos" />
        </section>

        <!-- Solo la caja recibe los datos de entrega (Ley 1581). -->
        <section v-if="entrega" class="space-y-2.5 rounded-xl bg-default p-5 ring-1 ring-default">
          <h2 class="text-lg font-semibold text-highlighted">Entrega</h2>
          <p class="flex items-start gap-2 text-default">
            <UIcon name="i-lucide-map-pin" class="mt-0.5 size-4 shrink-0 text-muted" />
            <span>
              {{ entrega.direccion }}
              <span v-if="entrega.indicaciones" class="block text-sm text-muted">
                {{ entrega.indicaciones }}
              </span>
            </span>
          </p>
          <a
            :href="`tel:${entrega.telefono.replace(/\s/g, '')}`"
            class="flex items-center gap-2 text-primary hover:underline"
          >
            <UIcon name="i-lucide-phone" class="size-4" />
            {{ entrega.telefono }}
          </a>
          <p v-if="entrega.domiciliario" class="flex items-center gap-2 text-default">
            <UIcon name="i-lucide-bike" class="size-4 text-primary" />
            Con {{ entrega.domiciliario.nombre }}
          </p>
          <p v-if="entrega.pagaCon" class="cifra text-sm text-muted">
            Paga con {{ formatearPesos(entrega.pagaCon) }}
          </p>
        </section>
      </div>
    </div>
  </div>
</template>
