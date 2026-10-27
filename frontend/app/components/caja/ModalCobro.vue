<!--
  Cobrar un pedido: propina voluntaria, uno o varios métodos de pago, cambio y cliente
  opcional para la factura. "Confirmar cobro" solo se activa cuando los pagos cuadran
  exactamente con el total más la propina. Al cobrar, muestra el cambio en grande.
  En el celular ocupa toda la pantalla.
-->
<script setup>
const props = defineProps({
  /** Pedido a cobrar. */
  pedidoId: { type: String, default: '' },
});

const abierto = defineModel('abierto', { type: Boolean, default: false });

const emit = defineEmits({
  /** @param {{ pedido: any, cambio: string, advertencias: any[] }} _respuesta */
  cobrado: (_respuesta) => true,
});

const pedidos = usePedidosStore();
const toast = useToast();
const pantallaGrande = useMediaQuery('(min-width: 1024px)');

const pedido = ref(/** @type {any} */ (null));
const cargando = ref(false);
const error = ref('');
const modoPropina = ref(/** @type {'ninguna' | 'sugerida' | 'otra'} */ ('ninguna'));
const propinaOtra = ref('');
const pagos = ref(/** @type {import('~/utils/caja.js').PagoEnPantalla[]} */ ([]));
const cliente = ref(/** @type {any} */ (null));
const cobrando = ref(false);
const resultado = ref(
  /** @type {{ pedido: any, cambio: string, advertencias: any[] } | null} */ (null),
);

// 1. Al abrir: empezar limpio y traer el pedido completo (con la propina sugerida).
watch(
  abierto,
  async (estaAbierto) => {
    if (!estaAbierto || !props.pedidoId) return;
    error.value = '';
    resultado.value = null;
    modoPropina.value = 'ninguna';
    propinaOtra.value = '';
    cliente.value = null;
    pagos.value = [{ metodo: 'efectivo', monto: '', recibido: '', referencia: '' }];
    cargando.value = true;
    try {
      pedido.value = await pedidos.cargarDetalle(props.pedidoId);
    } catch (fallo) {
      error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
    } finally {
      cargando.value = false;
    }
  },
  { immediate: true },
);

// 2. Cuentas en pantalla (el backend vuelve a validar todo al cobrar).
const propina = computed(() => {
  if (modoPropina.value === 'sugerida') return pedido.value?.propinaSugerida ?? '0';
  if (modoPropina.value === 'otra' && esMontoValido(propinaOtra.value)) return propinaOtra.value;
  return '0';
});
const estado = computed(() =>
  estadoDelCobro({ total: pedido.value?.total ?? '0', propina: propina.value, pagos: pagos.value }),
);

// Con un solo pago, su monto sigue al total a pagar (si cambia la propina, se ajusta solo).
watch(
  () => estado.value.aPagar.toString(),
  () => {
    const unico = pagos.value[0];
    if (pagos.value.length === 1 && unico) unico.monto = montoComoTexto(estado.value.aPagar);
  },
);

const propinaValida = computed(
  () =>
    modoPropina.value !== 'otra' || (propinaOtra.value !== '' && esMontoValido(propinaOtra.value)),
);
const puedeConfirmar = computed(
  () =>
    Boolean(pedido.value) &&
    estado.value.cuadra &&
    propinaValida.value &&
    pagos.value.every(recibidoAlcanza),
);
const porcentajePagado = computed(() =>
  estado.value.aPagar.isZero()
    ? 0
    : Math.min(100, estado.value.pagado.dividedBy(estado.value.aPagar).times(100).toNumber()),
);
const titulo = computed(
  () => `Cobrar · ${pedido.value ? nombreDelPedido(pedido.value) : 'Mostrador'}`,
);

// 3. Confirmar el cobro.
async function confirmar() {
  cobrando.value = true;
  error.value = '';
  try {
    const respuesta = await pedidos.cobrar(props.pedidoId, {
      pagos: pagosParaApi(pagos.value),
      ...(aDecimal(propina.value).greaterThan(0) ? { propina: propina.value } : {}),
      ...(cliente.value ? { clienteId: cliente.value.id } : {}),
    });
    resultado.value = respuesta;
    for (const advertencia of respuesta.advertencias ?? []) {
      toast.add({
        title: `Revisa el inventario de ${advertencia.nombre}`,
        description: `Quedó en ${formatearCantidad(advertencia.stock)} unidades.`,
        icon: 'i-lucide-package',
        color: 'warning',
      });
    }
    emit('cobrado', respuesta);
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  } finally {
    cobrando.value = false;
  }
}
</script>

<template>
  <UModal
    v-model:open="abierto"
    :title="resultado ? 'Cobro registrado' : titulo"
    :fullscreen="!pantallaGrande"
    :dismissible="!cobrando"
    :ui="{ content: 'lg:max-w-2xl' }"
  >
    <template #body>
      <div v-if="cargando" class="space-y-4">
        <USkeleton class="h-20 rounded-xl" />
        <USkeleton class="h-24 rounded-xl" />
        <USkeleton class="h-40 rounded-xl" />
      </div>

      <UAlert
        v-else-if="!pedido"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="error || 'No pudimos abrir el pedido'"
      />

      <!-- Cobro registrado: el cambio en grande. -->
      <div v-else-if="resultado" class="space-y-5 py-4 text-center">
        <div class="mx-auto grid size-20 place-items-center rounded-full bg-success/15">
          <UIcon
            name="i-lucide-circle-check"
            class="size-12 text-success motion-safe:animate-bounce"
          />
        </div>
        <div
          v-if="aDecimal(resultado.cambio).greaterThan(0)"
          class="mx-auto max-w-sm rounded-2xl bg-success/10 p-6 ring-1 ring-success/30"
        >
          <p class="font-medium text-toned">Devuelve</p>
          <p class="cifra text-6xl font-bold tracking-tight text-success">
            {{ formatearPesos(resultado.cambio) }}
          </p>
        </div>
        <p v-else class="text-lg text-muted">No hay cambio para devolver.</p>
      </div>

      <!-- Armar el cobro. -->
      <div v-else class="space-y-6">
        <div class="rounded-2xl bg-elevated/60 p-5 text-center ring-1 ring-default">
          <p class="text-sm font-medium text-muted">Total a pagar</p>
          <CifraAnimada
            :valor="estado.aPagar"
            class="text-5xl font-bold tracking-tight text-highlighted"
          />
          <p class="cifra mt-1 text-sm text-muted">
            Cuenta {{ formatearPesos(pedido.total) }}
            <template v-if="aDecimal(propina).greaterThan(0)">
              + propina {{ formatearPesos(propina) }}
            </template>
          </p>
        </div>

        <SelectorPropina
          v-model:modo="modoPropina"
          v-model:otra="propinaOtra"
          :sugerida="pedido.propinaSugerida ?? '0'"
        />

        <PagosDelCobro v-model="pagos" :a-pagar="estado.aPagar" />

        <!-- Cuánto falta, sobra o si ya cuadra. -->
        <div class="space-y-2" aria-live="polite">
          <UProgress
            :model-value="porcentajePagado"
            :color="estado.cuadra ? 'success' : 'primary'"
          />
          <p class="cifra text-sm font-medium">
            <span v-if="estado.cuadra" class="text-success">✓ Los pagos cuadran</span>
            <span v-else-if="estado.sobrante.greaterThan(0)" class="text-error">
              Sobran {{ formatearPesos(estado.sobrante) }}: revisa los montos
            </span>
            <span v-else class="text-muted">
              Pagado {{ formatearPesos(estado.pagado) }} de {{ formatearPesos(estado.aPagar) }} ·
              Faltan {{ formatearPesos(estado.faltante) }}
            </span>
          </p>
          <p
            v-if="estado.cambio.greaterThan(0)"
            class="cifra rounded-xl bg-success/10 px-4 py-3 text-xl font-bold text-success"
          >
            Cambio: {{ formatearPesos(estado.cambio) }}
          </p>
        </div>

        <SelectorCliente v-model="cliente" />

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="error"
          role="alert"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton v-if="resultado" size="xl" block label="Listo" @click="abierto = false" />
        <template v-else>
          <UButton
            color="neutral"
            variant="ghost"
            size="xl"
            label="Cancelar"
            :disabled="cobrando"
            @click="abierto = false"
          />
          <UButton
            size="xl"
            icon="i-lucide-check"
            class="flex-1 justify-center sm:flex-none"
            :label="`Confirmar cobro · ${formatearPesos(estado.aPagar)}`"
            :loading="cobrando"
            :disabled="!puedeConfirmar"
            @click="confirmar"
          />
        </template>
      </div>
    </template>
  </UModal>
</template>
