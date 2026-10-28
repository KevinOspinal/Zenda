<!--
  Preferencias de este dispositivo: tema (claro, oscuro o automático), sonidos, vibración y,
  si el negocio entrega recibo de venta, el ancho del papel de su impresora.
  Se guardan en el dispositivo, no en la cuenta: cada equipo del negocio tiene las suyas.
-->
<script setup>
const modoDeColor = useColorMode();
const preferencias = usePreferenciasStore();
const sesion = useSesionStore();
/** Solo los negocios sin factura electrónica imprimen recibo de venta. */
const imprimeRecibos = computed(() => !facturaElectronica(sesion.negocio?.regimenImpuesto));
const ANCHOS_PAPEL = Object.freeze([
  { value: '80', label: '80 mm', description: 'El más común' },
  { value: '58', label: '58 mm', description: 'Impresoras pequeñas' },
]);
const { isSupported: vibracionDisponible } = useVibrate();

const TEMAS = Object.freeze([
  { valor: 'light', etiqueta: 'Claro', icono: 'i-lucide-sun' },
  { valor: 'dark', etiqueta: 'Oscuro', icono: 'i-lucide-moon' },
  { valor: 'system', etiqueta: 'Automático', icono: 'i-lucide-monitor-smartphone' },
]);
</script>

<template>
  <section class="space-y-5 rounded-xl bg-default p-5 ring-1 ring-default">
    <div>
      <h2 class="text-lg font-semibold text-highlighted">Preferencias de este dispositivo</h2>
      <p class="text-sm text-muted">Solo cambian en este equipo, no en tu cuenta.</p>
    </div>

    <div class="space-y-2">
      <p id="tema-titulo" class="text-sm font-medium text-default">Tema</p>
      <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="tema-titulo">
        <button
          v-for="tema in TEMAS"
          :key="tema.valor"
          type="button"
          role="radio"
          :aria-checked="modoDeColor.preference === tema.valor"
          class="flex flex-col items-center gap-1.5 rounded-xl p-3 text-sm font-medium ring-1 transition active:scale-[0.98] motion-reduce:transition-none"
          :class="
            modoDeColor.preference === tema.valor
              ? 'bg-primary/10 text-primary ring-2 ring-primary'
              : 'text-toned ring-default hover:ring-accented'
          "
          @click="modoDeColor.preference = tema.valor"
        >
          <UIcon :name="tema.icono" class="size-6" />
          {{ tema.etiqueta }}
        </button>
      </div>
    </div>

    <USwitch
      v-model="preferencias.sonidos"
      size="lg"
      label="Sonidos de avisos"
      description="Suena cuando llega una comanda o un plato está listo."
    />
    <USwitch
      v-model="preferencias.vibracion"
      size="lg"
      label="Vibración"
      :disabled="!vibracionDisponible"
      :description="
        vibracionDisponible
          ? 'Vibra al agregar productos y con los avisos.'
          : 'Este dispositivo no permite vibrar.'
      "
    />
    <UFormField
      v-if="imprimeRecibos"
      label="Papel de la impresora de recibos"
      help="El ancho del rollo de la impresora térmica conectada a este equipo."
    >
      <URadioGroup
        v-model="preferencias.anchoRecibo"
        :items="ANCHOS_PAPEL"
        orientation="horizontal"
        variant="card"
      />
    </UFormField>
  </section>
</template>
