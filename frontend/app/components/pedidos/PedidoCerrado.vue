<!--
  Un pedido que ya se cobró o se anuló: arriba qué pasó y qué falta (con su acción), la cuenta
  como un recibo, el seguimiento del pedido y, en un domicilio, a dónde va.
  - Si se cobró sin pasar por la cocina, falta decidir: enviarlo o, si no va a cocina (por
    ejemplo, unas gaseosas), entregarlo. Un domicilio siempre va a la cocina.
  - Una mesa cobrada con platos por llevar sigue ocupada: desde aquí se entregan los platos
    listos o se empieza otro pedido en la mesa, si piden algo más.
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
const { imprimir } = useImpresionDeRecibo();
const { decidiendo, decidir } = useDecisionDeCocina();
const pantallaAncha = useMediaQuery('(min-width: 640px)');

const tipo = computed(() => tipoDelPedido(props.pedido));
/** El aviso de arriba: qué pasó y, si falta algo, qué hacer. */
const aviso = computed(() => avisoDelPedidoCerrado(props.pedido));
/** Se cobró sin pasar por la cocina: falta decidir si va. */
const sinCocina = computed(() => faltaDecidirCocina(props.pedido));
/** Mesa cobrada que espera platos de la cocina: sigue ocupada hasta que lleguen. */
const esperaPlatos = computed(() => tipo.value === 'mesa' && esCobradoEnCocina(props.pedido));
const platosListos = computed(() =>
  esperaPlatos.value
    ? (props.pedido.items ?? []).filter((/** @type {any} */ item) => item.estadoCocina === 'listo')
    : [],
);
const pasos = computed(() => pasosDelPedido(props.pedido));
const entrega = computed(() => props.pedido.entrega ?? null);

/** @param {import('~/composables/useDecisionDeCocina.js').DecisionDeCocina} decision */
async function elegir(decision) {
  if (await decidir(props.pedido, decision)) await navigateTo(props.volverA);
}

/** El mesero lleva de una vez los platos que la cocina ya terminó. */
async function entregarListos() {
  try {
    await pedidos.cambiarEstadoCocinaDelPedido(props.pedido.id, 'entregado');
  } catch (error) {
    toast.add({
      title: error instanceof ErrorApi ? error.message : MENSAJE_ERROR_GENERICO,
      icon: 'i-lucide-circle-alert',
      color: 'error',
    });
  }
}

const GRANDE = /** @type {const} */ ('lg');
const acciones = computed(() => [
  ...(sinCocina.value
    ? [
        {
          label: 'Enviar a cocina',
          icon: 'i-lucide-chef-hat',
          size: GRANDE,
          color: /** @type {const} */ ('warning'),
          loading: decidiendo.value === 'cocina',
          disabled: Boolean(decidiendo.value),
          onClick: () => elegir('cocina'),
        },
      ]
    : []),
  ...(sinCocina.value && tipo.value !== 'domicilio'
    ? [
        {
          label: 'No va a cocina',
          icon: 'i-lucide-cup-soda',
          size: GRANDE,
          color: /** @type {const} */ ('neutral'),
          variant: /** @type {const} */ ('outline'),
          loading: decidiendo.value === 'sin_cocina',
          disabled: Boolean(decidiendo.value),
          onClick: () => elegir('sin_cocina'),
        },
      ]
    : []),
  ...(platosListos.value.length
    ? [
        {
          label:
            platosListos.value.length === 1
              ? 'Entregar el plato listo'
              : `Entregar ${platosListos.value.length} platos listos`,
          icon: 'i-lucide-check-check',
          size: GRANDE,
          color: /** @type {const} */ ('info'),
          loadingAuto: true,
          onClick: entregarListos,
        },
      ]
    : []),
  ...(esperaPlatos.value && props.pedido.mesaId
    ? [
        {
          label: 'Nuevo pedido en la mesa',
          icon: 'i-lucide-plus',
          size: GRANDE,
          color: /** @type {const} */ ('neutral'),
          variant: /** @type {const} */ ('outline'),
          to: `/pedidos/nuevo?mesa=${props.pedido.mesaId}`,
        },
      ]
    : []),
  ...(props.pedido.recibo
    ? [
        {
          label: 'Reimprimir recibo',
          icon: 'i-lucide-printer',
          size: GRANDE,
          color: /** @type {const} */ ('neutral'),
          variant: /** @type {const} */ ('outline'),
          // El original se imprimió al cobrar: esta sale como copia.
          onClick: () => imprimir(props.pedido, { copia: true }),
        },
      ]
    : []),
  {
    label: 'Volver',
    size: GRANDE,
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

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-5">
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
