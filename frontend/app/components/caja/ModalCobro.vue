<!--
  Cobrar un pedido: propina voluntaria, uno o varios métodos de pago, cambio y cliente
  opcional para la factura. "Confirmar cobro" solo se activa cuando los pagos cuadran
  exactamente con el total más la propina. Al cobrar, muestra el cambio en grande
  (CobroRegistrado). Si el pedido no ha ido a la cocina, no se cierra hasta decidir si va o no:
  así ningún pedido cobrado se queda sin preparar.
  El cobro nunca se repite solo: si la señal falla, no se sabe si llegó. Antes de dejar cobrar
  de nuevo se revisa el pedido: o "Ya quedó cobrado" (con su cambio) o "No llegó".
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
/** La señal falló, pero el cobro sí había llegado: se avisa para no cobrar dos veces. */
const yaEstabaCobrado = ref(false);
/** Un cobro se quedó sin respuesta y aún no se sabe si llegó: hay que revisar antes de cobrar. */
const cobroEnDuda = ref(false);
/** "No llegó: puedes cobrar de nuevo". */
const avisoNoLlego = ref(false);
/** Se cobró sin pasar por la cocina: hasta decidir si va, la ventana no se cierra. */
const faltaCocina = computed(() =>
  Boolean(resultado.value && faltaDecidirCocina(resultado.value.pedido)),
);

// 1. Al abrir: empezar limpio y traer el pedido completo (con la propina sugerida).
watch(
  abierto,
  async (estaAbierto) => {
    if (!estaAbierto || !props.pedidoId) return;
    error.value = '';
    resultado.value = null;
    yaEstabaCobrado.value = false;
    cobroEnDuda.value = false;
    avisoNoLlego.value = false;
    modoPropina.value = 'ninguna';
    propinaOtra.value = '';
    cliente.value = null;
    pagos.value = [{ metodo: 'efectivo', monto: '', recibido: '', referencia: '' }];
    cargando.value = true;
    try {
      pedido.value = await pedidos.cargarDetalle(props.pedidoId);
      // Ya se cobró (por ejemplo, un cobro anterior cuya respuesta se perdió): no se cobra otra vez.
      if (pedido.value.estado === 'pagado') mostrarYaCobrado(pedido.value);
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
  avisoNoLlego.value = false;
  try {
    // 1. Si un cobro anterior se quedó sin respuesta, primero se revisa si sí llegó.
    if (cobroEnDuda.value && (await revisarCobro()) !== 'sin_cobrar') return;

    // 2. Cobrar, una sola vez.
    const respuesta = await pedidos.cobrar(props.pedidoId, {
      pagos: pagosParaApi(pagos.value),
      ...(aDecimal(propina.value).greaterThan(0) ? { propina: propina.value } : {}),
      ...(cliente.value ? { clienteId: cliente.value.id } : {}),
    });
    mostrarResultado(respuesta);
  } catch (fallo) {
    // 3. Sin respuesta: el cobro pudo llegar o no. Se revisa antes de dejar cobrar de nuevo.
    //    Si el API dice que ya se cerró, también: puede ser este mismo cobro, que sí llegó.
    if (
      esFallaPasajera(fallo) ||
      (fallo instanceof ErrorApi && fallo.codigo === 'PEDIDO_CERRADO')
    ) {
      cobroEnDuda.value = true;
      if ((await revisarCobro()) === 'sin_cobrar') avisoNoLlego.value = true;
      return;
    }
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  } finally {
    cobrando.value = false;
  }
}

/**
 * Revisa en el API si el pedido quedó cobrado y deja la pantalla como corresponde.
 * @returns {Promise<'cobrado' | 'sin_cobrar' | 'anulado' | 'sin_saber'>}
 */
async function revisarCobro() {
  let actual;
  try {
    actual = await pedidos.cargarDetalle(props.pedidoId);
  } catch {
    // Tampoco hay señal para revisar: no se deja cobrar hasta saberlo.
    error.value =
      'Sin señal: no sabemos si el cobro llegó. No cobres al cliente otra vez; vuelve a ' +
      'tocar Confirmar cuando haya señal y lo revisamos primero.';
    return 'sin_saber';
  }
  cobroEnDuda.value = false;
  if (actual.estado === 'pagado') {
    mostrarYaCobrado(actual);
    return 'cobrado';
  }
  if (actual.estado === 'anulado') {
    error.value = 'Este pedido se anuló: ya no se puede cobrar.';
    return 'anulado';
  }
  return 'sin_cobrar';
}

/**
 * El pedido ya estaba cobrado: se muestra como un cobro registrado, con su cambio.
 * @param {any} cobrado
 */
function mostrarYaCobrado(cobrado) {
  yaEstabaCobrado.value = true;
  mostrarResultado({ pedido: cobrado, cambio: cambioDelPedidoCobrado(cobrado), advertencias: [] });
}

/** @param {{ pedido: any, cambio: string, advertencias: any[] }} respuesta */
function mostrarResultado(respuesta) {
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
}
</script>

<template>
  <UModal
    v-model:open="abierto"
    :title="resultado ? (yaEstabaCobrado ? 'Ya quedó cobrado' : 'Cobro registrado') : titulo"
    :fullscreen="!pantallaGrande"
    :dismissible="!cobrando && !faltaCocina"
    :close="!faltaCocina"
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

      <!-- Cobro registrado: el cambio en grande y, si falta, qué pasa con la cocina. -->
      <div v-else-if="resultado">
        <UAlert
          v-if="yaEstabaCobrado"
          color="info"
          variant="subtle"
          icon="i-lucide-shield-check"
          title="Este pedido ya quedó cobrado"
          description="El cobro sí se registró. No le cobres otra vez al cliente."
          role="alert"
        />
        <CobroRegistrado :resultado="resultado" @decidido="abierto = false" />
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
          v-if="avisoNoLlego"
          color="warning"
          variant="subtle"
          icon="i-lucide-wifi-off"
          title="El cobro no llegó"
          description="Lo revisamos: el pedido sigue sin cobrar. Puedes cobrar de nuevo."
          role="alert"
        />
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

    <!-- Mientras falte decidir lo de la cocina, sus botones son los únicos. -->
    <template v-if="!faltaCocina" #footer>
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
