<!--
  Muestrario: botones, acciones con carga y atajos de teclado (temporal, Fase 0).
-->
<script setup>
const toast = useToast();

/** Simula un cobro: el botón muestra la carga y al terminar llega un toast. */
async function simularCobro() {
  await new Promise((resolver) => setTimeout(resolver, 1500));
  toast.add({
    title: 'Cobro registrado',
    description: `Devuelve ${formatearPesos('8000')} de cambio.`,
    icon: 'i-lucide-circle-check',
    color: 'success',
  });
}
</script>

<template>
  <SeccionMuestrario
    id="botones"
    titulo="Botones"
    descripcion="Una acción principal por pantalla, grande y fácil de tocar. Las acciones que mueven dinero muestran la carga dentro del botón y no se pueden tocar dos veces."
  >
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="space-y-3 rounded-xl bg-default p-5 ring-1 ring-default">
        <p class="text-sm font-semibold text-muted">Acciones principales</p>
        <UButton block size="xl" icon="i-lucide-chef-hat" label="Enviar a cocina" />
        <UButton
          block
          size="xl"
          icon="i-lucide-banknote"
          :label="`Cobrar ${formatearPesos('38000')}`"
          loading-auto
          @click="simularCobro"
        />
        <p class="text-xs text-muted">Toca "Cobrar" para ver la carga y el aviso al terminar.</p>
      </div>

      <div class="space-y-3 rounded-xl bg-default p-5 ring-1 ring-default">
        <p class="text-sm font-semibold text-muted">Otras acciones</p>
        <div class="flex flex-wrap gap-2">
          <UButton
            size="lg"
            color="neutral"
            variant="outline"
            icon="i-lucide-receipt"
            label="Ver cuenta"
          />
          <UButton
            size="lg"
            color="neutral"
            variant="soft"
            icon="i-lucide-split"
            label="Dividir cuenta"
          />
          <UButton
            size="lg"
            color="error"
            variant="soft"
            icon="i-lucide-ban"
            label="Anular pedido"
          />
          <UButton size="lg" color="neutral" variant="ghost" label="Cancelar" />
          <UButton size="lg" icon="i-lucide-cloud-off" label="Necesita conexión" disabled />
        </div>
        <p class="pt-2 text-sm font-semibold text-muted">Atajos de teclado en la caja (PC)</p>
        <div class="flex flex-wrap gap-4 text-sm text-toned">
          <span class="inline-flex items-center gap-1.5"><UKbd value="N" /> Nueva venta</span>
          <span class="inline-flex items-center gap-1.5"><UKbd value="C" /> Cobrar</span>
          <span class="inline-flex items-center gap-1.5"><UKbd value="/" /> Buscar</span>
          <span class="inline-flex items-center gap-1.5"><UKbd value="Esc" /> Cerrar</span>
        </div>
      </div>
    </div>
  </SeccionMuestrario>
</template>
