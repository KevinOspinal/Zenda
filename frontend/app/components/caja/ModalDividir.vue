<!--
  Dividir la cuenta: tocar un producto lo pasa (una unidad a la vez) de la cuenta actual a
  la cuenta nueva, y tocarlo en la nueva lo devuelve. La cuenta actual debe conservar al
  menos un producto (regla del backend).
-->
<script setup>
const props = defineProps({
  /** Pedido a dividir, con sus ítems. */
  pedido: { type: /** @type {import('vue').PropType<any>} */ (Object), default: null },
});

const abierto = defineModel('abierto', { type: Boolean, default: false });

const emit = defineEmits({
  /** @param {{ original: any, nuevo: any }} _cuentas */
  dividido: (_cuentas) => true,
});

const pedidos = usePedidosStore();
const toast = useToast();

/** Unidades de cada ítem que pasan a la cuenta nueva: { itemId: cantidad }. */
const aMover = ref(/** @type {Record<string, number>} */ ({}));
const dividiendo = ref(false);
watch(
  abierto,
  (estaAbierto) => {
    if (estaAbierto) aMover.value = {};
  },
  { immediate: true },
);

const items = computed(() => props.pedido?.items ?? []);

/**
 * Las dos cuentas como se verán: cada ítem con las unidades que quedan o que pasan.
 * @param {'actual' | 'nueva'} cuenta
 */
function lineas(cuenta) {
  return items.value
    .map((/** @type {any} */ item) => {
      const movidas = aMover.value[item.id] ?? 0;
      const cantidad = cuenta === 'nueva' ? movidas : Number(item.cantidad) - movidas;
      return { item, cantidad };
    })
    .filter((linea) => linea.cantidad > 0);
}
const actual = computed(() => lineas('actual'));
const nueva = computed(() => lineas('nueva'));

/** @param {{ item: any, cantidad: number }[]} lista */
const totalDe = (lista) =>
  sumar(lista.map(({ item, cantidad }) => aDecimal(item.precioUnitario).times(cantidad)));

/**
 * Pasa una unidad de una cuenta a la otra (o lo que quede, si son fracciones).
 * @param {any} item
 * @param {1 | -1} sentido 1: a la cuenta nueva; -1: de vuelta a la actual.
 */
function mover(item, sentido) {
  const total = Number(item.cantidad);
  const movidas = aMover.value[item.id] ?? 0;
  const paso = Math.min(1, sentido > 0 ? total - movidas : movidas);
  aMover.value[item.id] = Math.max(0, Math.min(total, movidas + sentido * paso));
}

const puedeDividir = computed(() => nueva.value.length > 0 && actual.value.length > 0);

async function dividir() {
  dividiendo.value = true;
  try {
    const cuentas = await pedidos.dividir(
      props.pedido.id,
      Object.entries(aMover.value)
        .filter(([, cantidad]) => cantidad > 0)
        .map(([itemId, cantidad]) => ({ itemId, cantidad })),
    );
    toast.add({
      title: 'Cuenta dividida',
      description: `Cuenta nueva por ${formatearPesos(cuentas.nuevo.total)}`,
      icon: 'i-lucide-split',
      color: 'success',
    });
    emit('dividido', cuentas);
    abierto.value = false;
  } catch (error) {
    toast.add({
      title: error instanceof ErrorApi ? error.message : MENSAJE_ERROR_GENERICO,
      icon: 'i-lucide-circle-alert',
      color: 'error',
    });
  } finally {
    dividiendo.value = false;
  }
}
</script>

<template>
  <UModal
    v-model:open="abierto"
    title="Dividir la cuenta"
    description="Toca un producto para pasarlo a la otra cuenta (una unidad a la vez)."
    :ui="{ content: 'lg:max-w-3xl' }"
  >
    <template #body>
      <div class="grid gap-4 sm:grid-cols-2">
        <section
          v-for="cuenta in [
            { id: 'actual', titulo: 'Cuenta actual', lineas: actual, sentido: 1 },
            { id: 'nueva', titulo: 'Cuenta nueva', lineas: nueva, sentido: -1 },
          ]"
          :key="cuenta.id"
          class="flex flex-col gap-2 rounded-xl bg-elevated/50 p-3 ring-1 ring-default"
          :aria-label="cuenta.titulo"
        >
          <header class="flex items-baseline justify-between px-1">
            <h3 class="font-semibold text-highlighted">{{ cuenta.titulo }}</h3>
            <span class="cifra font-bold text-highlighted">
              {{ formatearPesos(totalDe(cuenta.lineas)) }}
            </span>
          </header>
          <TransitionGroup tag="ul" class="space-y-2">
            <li v-for="linea in cuenta.lineas" :key="linea.item.id">
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-lg bg-default p-3 text-left ring-1 ring-default transition hover:ring-accented active:scale-[0.99]"
                :aria-label="`Pasar una unidad de ${linea.item.producto.nombre}`"
                @click="mover(linea.item, /** @type {1 | -1} */ (cuenta.sentido))"
              >
                <span class="cifra min-w-7 font-bold text-highlighted">
                  {{ formatearCantidad(linea.cantidad) }}
                </span>
                <span class="min-w-0 flex-1 truncate">{{ linea.item.producto.nombre }}</span>
                <UIcon
                  :name="cuenta.sentido > 0 ? 'i-lucide-arrow-right' : 'i-lucide-arrow-left'"
                  class="size-5 text-muted"
                />
              </button>
            </li>
          </TransitionGroup>
          <p v-if="!cuenta.lineas.length" class="py-6 text-center text-sm text-muted">
            {{ cuenta.id === 'nueva' ? 'Toca productos de la cuenta actual' : 'Sin productos' }}
          </p>
        </section>
      </div>
      <p v-if="nueva.length && !actual.length" class="mt-3 text-sm font-medium text-error">
        La cuenta actual debe conservar al menos un producto.
      </p>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          size="lg"
          label="Cancelar"
          @click="abierto = false"
        />
        <UButton
          size="lg"
          icon="i-lucide-split"
          label="Dividir"
          :loading="dividiendo"
          :disabled="!puedeDividir"
          @click="dividir"
        />
      </div>
    </template>
  </UModal>
</template>
