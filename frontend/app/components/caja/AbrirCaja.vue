<!--
  Bienvenida de la caja cerrada: se escribe el efectivo inicial (la base para dar cambio)
  con montos rápidos, y se abre el turno. Sin caja abierta no se pueden tomar pedidos.
-->
<script setup>
const caja = useCajaStore();
const toast = useToast();

const MONTOS_RAPIDOS = Object.freeze(['50000', '100000', '200000']);
const montoInicial = ref('');
const abriendo = ref(false);
const valido = computed(() => montoInicial.value !== '' && esMontoValido(montoInicial.value));

async function abrir() {
  abriendo.value = true;
  try {
    await caja.abrir(montoInicial.value);
    toast.add({
      title: 'Caja abierta',
      description: `Base de ${formatearPesos(montoInicial.value)}. ¡Buen turno!`,
      icon: 'i-lucide-circle-check',
      color: 'success',
    });
  } catch (error) {
    toast.add({
      title: error instanceof ErrorApi ? error.message : MENSAJE_ERROR_GENERICO,
      icon: 'i-lucide-circle-alert',
      color: 'error',
    });
    if (error instanceof ErrorApi && error.codigo === 'TURNO_YA_ABIERTO') caja.cargarTurno();
  } finally {
    abriendo.value = false;
  }
}
</script>

<template>
  <div class="grid min-h-[60vh] place-items-center">
    <form class="w-full max-w-md space-y-6 text-center" @submit.prevent="valido && abrir()">
      <div class="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10">
        <UIcon name="i-lucide-calculator" class="size-9 text-primary" />
      </div>
      <div class="space-y-1">
        <h2 class="text-2xl font-bold text-highlighted">Abre la caja para empezar a vender</h2>
        <p class="text-muted">Escribe el efectivo con el que empiezas, para dar cambio.</p>
      </div>

      <div class="space-y-3 text-left">
        <CampoDinero v-model="montoInicial" etiqueta="Efectivo inicial" autofocus />
        <div class="grid grid-cols-3 gap-2">
          <UButton
            v-for="monto in MONTOS_RAPIDOS"
            :key="monto"
            :label="formatearPesos(monto)"
            color="neutral"
            :variant="montoInicial === monto ? 'solid' : 'outline'"
            size="lg"
            block
            @click="montoInicial = monto"
          />
        </div>
      </div>

      <UButton
        type="submit"
        block
        size="xl"
        icon="i-lucide-lock-open"
        label="Abrir caja"
        :loading="abriendo"
        :disabled="!valido"
      />
    </form>
  </div>
</template>
