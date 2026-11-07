<!--
  Datos para que el cliente pague por Bre-B, en el cobro por transferencia: el QR del banco del
  negocio, la llave (con botón de copiar) y el valor del pago. "Mostrar al cliente" pone el QR
  en grande para que lo escanee desde su celular.
  Zenda no ve la cuenta del banco: quien cobra revisa que la plata llegó antes de confirmar.
  Si el negocio no ha configurado Bre-B, el dueño (y el administrador de Zenda) ve dónde
  hacerlo; los demás, nada.
-->
<script setup>
const props = defineProps({
  /** Valor de este pago (texto del API o Decimal). */
  monto: {
    type: /** @type {import('vue').PropType<import('~/utils/dinero.js').ValorDinero>} */ ([
      String,
      Object,
    ]),
    required: true,
  },
});

const negocioStore = useNegocioStore();
const sesion = useSesionStore();
const { copy, copied, isSupported } = useClipboard({ copiedDuring: 2000 });

const negocio = computed(() => negocioStore.datos);
const conBreB = computed(() => tieneCobroBreB(negocio.value));
const hayMonto = computed(
  () => esMontoValido(String(props.monto)) && aDecimal(props.monto).greaterThan(0),
);
const puedeConfigurar = computed(() => puede(sesion.rol, 'configurarNegocio'));
const ampliado = ref(false);

// Se muestran los datos guardados al instante y se piden de nuevo por si el dueño cambió la
// llave en otro dispositivo. Si falla, el cobro sigue igual (solo no se ve este bloque).
onMounted(() => negocioStore.cargar({ forzar: true }).catch(() => {}));
</script>

<template>
  <div
    v-if="conBreB"
    class="space-y-3 rounded-xl bg-primary/5 p-4 ring-1 ring-primary/20"
    data-bloque="bre-b"
  >
    <div class="flex items-center gap-4">
      <button
        v-if="negocio.qrBreB"
        type="button"
        class="shrink-0 rounded-lg bg-white p-1 ring-1 ring-default transition hover:ring-primary focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none"
        aria-label="Mostrar el QR en grande al cliente"
        @click="ampliado = true"
      >
        <CodigoQr :contenido="negocio.qrBreB" etiqueta="QR para pagar con Bre-B" class="w-28" />
      </button>
      <div class="min-w-0 space-y-1">
        <p class="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <UIcon name="i-lucide-qr-code" class="size-4" />
          Paga con Bre-B
        </p>
        <p v-if="hayMonto" class="cifra text-2xl font-bold text-highlighted">
          {{ formatearPesos(monto) }}
        </p>
        <div v-if="negocio.llaveBreB" class="flex min-w-0 items-center gap-1">
          <span class="truncate font-mono text-sm text-default">{{ negocio.llaveBreB }}</span>
          <UButton
            v-if="isSupported"
            size="xs"
            color="neutral"
            variant="ghost"
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            :aria-label="copied ? 'Llave copiada' : 'Copiar la llave'"
            @click="copy(negocio.llaveBreB)"
          />
        </div>
      </div>
    </div>
    <p class="flex items-start gap-1.5 text-xs text-muted">
      <UIcon name="i-lucide-info" class="mt-px size-3.5 shrink-0" />
      Revisa en tu banco que la plata llegó antes de confirmar el cobro.
    </p>

    <UModal v-if="negocio.qrBreB" v-model:open="ampliado" title="Paga con Bre-B">
      <template #body>
        <div class="space-y-4 text-center">
          <CodigoQr
            :contenido="negocio.qrBreB"
            etiqueta="QR para pagar con Bre-B"
            class="mx-auto w-full max-w-80 rounded-xl p-2 ring-1 ring-default"
          />
          <p v-if="hayMonto" class="cifra text-4xl font-bold text-highlighted">
            {{ formatearPesos(monto) }}
          </p>
          <p class="text-toned">
            Escanéalo con la app de tu banco
            <template v-if="negocio.llaveBreB">
              o paga a la llave <span class="font-mono font-semibold">{{ negocio.llaveBreB }}</span>
            </template>
          </p>
          <p class="text-sm text-muted">{{ negocio.nombre }}</p>
        </div>
      </template>
    </UModal>
  </div>

  <p v-else-if="negocio && puedeConfigurar" class="text-sm text-muted">
    ¿Cobras por Bre-B?
    <ULink to="/admin/configuracion" class="font-semibold text-primary">
      Configura tu llave y tu QR
    </ULink>
  </p>
</template>
