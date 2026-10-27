<!--
  La cuenta mientras se toma un pedido, adaptada al dispositivo:
  - Tablet horizontal y PC: panel fijo a la derecha del menú.
  - Celular: barra fija sobre la navegación ("Ver cuenta · 3 productos · $ 38.000") que abre
    la cuenta en un panel desde abajo.
-->
<script setup>
const props = defineProps({
  titulo: { type: String, required: true },
  items: { type: /** @type {import('vue').PropType<any[]>} */ (Array), required: true },
  total: {
    type: /** @type {import('vue').PropType<import('~/utils/dinero.js').ValorDinero>} */ ([
      String,
      Object,
    ]),
    required: true,
  },
  estadoPedido: {
    type: /** @type {import('vue').PropType<'nuevo' | 'abierto' | 'enviado_a_cocina'>} */ (String),
    default: 'nuevo',
  },
  procesando: { type: Boolean, default: false },
  enviando: { type: Boolean, default: false },
  puedeCobrar: { type: Boolean, default: false },
});

const emit = defineEmits({
  /** @param {object} _item */
  quitar: (_item) => true,
  enviar: () => true,
  cobrar: () => true,
});

const pantallaGrande = useMediaQuery('(min-width: 1024px)');
const abierta = defineModel('abierta', { type: Boolean, default: false });

const totalProductos = computed(() => sumar(props.items.map((i) => i.cantidad)).toNumber());
</script>

<template>
  <!-- Tablet horizontal y PC. -->
  <aside v-if="pantallaGrande" aria-label="Cuenta del pedido">
    <div
      class="sticky top-24 flex h-[calc(100dvh-8rem)] flex-col rounded-xl bg-default p-5 ring-1 ring-default"
    >
      <h3 class="mb-2 text-lg font-bold text-highlighted">Cuenta · {{ titulo }}</h3>
      <PanelCuenta
        :items="items"
        :total="total"
        :estado-pedido="estadoPedido"
        :procesando="procesando"
        :enviando="enviando"
        :puede-cobrar="puedeCobrar"
        @quitar="emit('quitar', $event)"
        @enviar="emit('enviar')"
        @cobrar="emit('cobrar')"
      />
    </div>
  </aside>

  <!-- Celular. -->
  <template v-else>
    <Transition
      enter-from-class="translate-y-4 opacity-0"
      enter-active-class="transition duration-200 motion-reduce:transition-none"
    >
      <div
        v-if="items.length || procesando"
        class="fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20"
      >
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 rounded-xl bg-primary px-5 py-4 text-inverted shadow-lg transition active:scale-[0.98] motion-reduce:transition-none"
          @click="abierta = true"
        >
          <span class="flex items-center gap-2 font-semibold">
            <UIcon name="i-lucide-receipt" class="size-5" />
            Ver cuenta · {{ totalProductos }} {{ totalProductos === 1 ? 'producto' : 'productos' }}
          </span>
          <CifraAnimada :valor="total" class="text-lg font-bold" />
        </button>
      </div>
    </Transition>

    <UDrawer
      v-model:open="abierta"
      :title="`Cuenta · ${titulo}`"
      description="Lo que la cocina aún no empieza se puede quitar."
    >
      <template #body>
        <PanelCuenta
          :items="items"
          :total="total"
          :estado-pedido="estadoPedido"
          :procesando="procesando"
          :enviando="enviando"
          :puede-cobrar="puedeCobrar"
          @quitar="emit('quitar', $event)"
          @enviar="emit('enviar')"
          @cobrar="emit('cobrar')"
        />
      </template>
    </UDrawer>
  </template>
</template>
