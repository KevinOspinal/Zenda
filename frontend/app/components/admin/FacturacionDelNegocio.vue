<!--
  Cómo factura el negocio (solo el dueño): con factura electrónica (impuesto al consumo o IVA) o
  sin ella (no responsable: sin impuestos y con recibo de venta). Cambiarlo ajusta el impuesto
  de todos los productos, por eso pide confirmación y explica qué pasará. Queda en la auditoría.
-->
<script setup>
const props = defineProps({
  /** Negocio de GET /negocios/actual. */
  negocio: { type: /** @type {import('vue').PropType<any>} */ (Object), required: true },
});
const emit = defineEmits({
  /** @param {any} _negocio */
  guardado: (_negocio) => true,
});

const sesion = useSesionStore();
const toast = useToast();

const regimen = ref(props.negocio.regimenImpuesto);
watch(
  () => props.negocio.regimenImpuesto,
  (actual) => (regimen.value = actual),
);
const cambio = computed(() => regimen.value !== props.negocio.regimenImpuesto);
const confirmando = ref(false);

/** Qué les pasará a los productos con el régimen elegido. */
const consecuencia = computed(() =>
  facturaElectronica(regimen.value)
    ? 'Todos los productos tomarán el impuesto del régimen: revisa en el Menú los que no lo causan. Las ventas ya hechas no cambian.'
    : 'Todos los productos quedarán sin impuesto y cada venta tendrá su recibo de venta con número consecutivo. Las ventas ya hechas no cambian.',
);

async function guardar() {
  try {
    const negocio = await useApi().patch('/negocios/actual', { regimenImpuesto: regimen.value });
    // El formulario de productos lee el régimen de la sesión.
    if (sesion.negocio) sesion.negocio = { ...sesion.negocio, regimenImpuesto: regimen.value };
    confirmando.value = false;
    toast.add({
      title: 'Facturación actualizada',
      description: NOMBRES_REGIMEN[negocio.regimenImpuesto],
      icon: 'i-lucide-circle-check',
      color: 'success',
    });
    emit('guardado', negocio);
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
  <section class="space-y-4 rounded-xl bg-default p-5 ring-1 ring-default">
    <div>
      <h2 class="text-lg font-semibold text-highlighted">Facturación</h2>
      <p class="text-sm text-muted">
        Decide si el negocio cobra impuestos y si entrega factura electrónica o recibo de venta. Si
        no estás seguro, confírmalo con tu contador.
      </p>
    </div>
    <URadioGroup v-model="regimen" :items="OPCIONES_REGIMEN" variant="card" />
    <div class="flex justify-end">
      <UButton
        size="lg"
        icon="i-lucide-check"
        label="Guardar"
        :disabled="!cambio"
        @click="confirmando = true"
      />
    </div>

    <UModal
      v-model:open="confirmando"
      title="¿Cambiar la facturación del negocio?"
      :description="consecuencia"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            size="lg"
            label="Cancelar"
            @click="confirmando = false"
          />
          <UButton
            size="lg"
            icon="i-lucide-check"
            label="Sí, cambiar"
            loading-auto
            @click="guardar"
          />
        </div>
      </template>
    </UModal>
  </section>
</template>
