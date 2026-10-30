<!--
  Liquidar a un domiciliario: la caja recibe el dinero de sus domicilios contra entrega ya
  entregados. Se marcan los que trae (todos, de entrada) y cómo pagó cada cliente: en efectivo
  (lo normal) o por transferencia, por ejemplo por Nequi. Arriba, el total a recibir y cuánto de
  eso es efectivo para contar. El backend cobra todos o ninguno.
-->
<script setup>
const props = defineProps({
  /** Lo que tiene por liquidar: { domiciliario, pedidos, total } (ver porLiquidarPorDomiciliario). */
  grupo: { type: /** @type {import('vue').PropType<any>} */ (Object), default: null },
});
const abierto = defineModel('abierto', { type: Boolean, default: false });

const domicilios = useDomiciliosStore();
const toast = useToast();

/** Métodos con que pudo pagarle el cliente al domiciliario. */
const METODOS = Object.freeze(
  /** @type {const} */ (['efectivo', 'transferencia', 'tarjeta']).map((metodo) => ({
    value: metodo,
    label: METODOS_PAGO[metodo].etiqueta,
    icon: METODOS_PAGO[metodo].icono,
  })),
);

/** Por cada domicilio: si se recibe ahora y con qué pagó el cliente. */
const filas = ref(/** @type {{ pedido: any, incluido: boolean, metodo: string }[]} */ ([]));
watch(
  abierto,
  (estaAbierto) => {
    if (!estaAbierto || !props.grupo) return;
    filas.value = props.grupo.pedidos.map((/** @type {any} */ pedido) => ({
      pedido,
      incluido: true,
      metodo: 'efectivo',
    }));
  },
  { immediate: true },
);

const incluidas = computed(() => filas.value.filter((fila) => fila.incluido));
const total = computed(() => sumar(incluidas.value.map((fila) => fila.pedido.total)));
const enEfectivo = computed(() =>
  sumar(
    incluidas.value.filter((fila) => fila.metodo === 'efectivo').map((fila) => fila.pedido.total),
  ),
);

async function recibir() {
  if (!props.grupo || !incluidas.value.length) return;
  try {
    await domicilios.liquidar(
      props.grupo.domiciliario.id,
      incluidas.value.map((fila) => ({ pedidoId: fila.pedido.id, metodo: fila.metodo })),
    );
    toast.add({
      title: `Recibiste ${formatearPesos(total.value)} de ${props.grupo.domiciliario.nombre}`,
      description: `${incluidas.value.length} ${incluidas.value.length === 1 ? 'domicilio liquidado' : 'domicilios liquidados'}.`,
      icon: 'i-lucide-hand-coins',
      color: 'success',
    });
    abierto.value = false;
  } catch (fallo) {
    toast.add({
      title: fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO,
      icon: 'i-lucide-circle-alert',
      color: 'error',
    });
  }
}
</script>

<template>
  <UModal
    v-model:open="abierto"
    :title="grupo ? `Recibir el dinero de ${grupo.domiciliario.nombre}` : 'Recibir el dinero'"
    description="Marca los domicilios que trae y cómo le pagó cada cliente."
  >
    <template #body>
      <div v-if="grupo" class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-xl bg-elevated p-3">
            <p class="text-sm text-muted">A recibir</p>
            <CifraAnimada :valor="total" class="block text-2xl font-bold text-highlighted" />
          </div>
          <div class="rounded-xl bg-elevated p-3">
            <p class="text-sm text-muted">Efectivo para contar</p>
            <CifraAnimada :valor="enEfectivo" class="block text-2xl font-bold text-highlighted" />
          </div>
        </div>

        <ul class="space-y-2" aria-label="Domicilios por liquidar">
          <li
            v-for="fila in filas"
            :key="fila.pedido.id"
            class="space-y-3 rounded-xl p-3 ring-1"
            :class="fila.incluido ? 'ring-default' : 'opacity-60 ring-default'"
          >
            <div class="flex items-center gap-3">
              <UCheckbox
                v-model="fila.incluido"
                size="xl"
                :aria-label="`Recibir ${nombreDelPedido(fila.pedido)}`"
              />
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold text-highlighted">
                  {{ nombreDelPedido(fila.pedido) }}
                </span>
                <span class="cifra text-xs text-muted">
                  Entregado {{ formatearHora(fila.pedido.entrega.entregadoEn) }}
                </span>
              </span>
              <span class="cifra font-bold text-highlighted">
                {{ formatearPesos(fila.pedido.total) }}
              </span>
            </div>
            <URadioGroup
              v-if="fila.incluido"
              v-model="fila.metodo"
              :items="METODOS"
              orientation="horizontal"
              variant="card"
              size="sm"
              :aria-label="`Cómo pagó ${nombreDelPedido(fila.pedido)}`"
            />
          </li>
        </ul>

        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            size="lg"
            label="Cancelar"
            @click="abierto = false"
          />
          <UButton
            size="lg"
            color="secondary"
            icon="i-lucide-hand-coins"
            :label="`Recibir ${formatearPesos(total)}`"
            :disabled="!incluidas.length"
            loading-auto
            @click="recibir"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
