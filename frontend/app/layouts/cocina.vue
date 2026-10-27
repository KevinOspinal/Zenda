<!--
  Layout de la pantalla de cocina: pantalla completa, sin navegación, con reloj grande y
  un botón para salir que pide confirmación (para no cerrarla por un toque accidental).
-->
<script setup>
const sesion = useSesionStore();
const ahora = useNow({ interval: 15_000 });
const confirmandoSalida = ref(false);

function salirDeCocina() {
  confirmandoSalida.value = false;
  if (sesion.rol) navigateTo(inicioDe(sesion.rol));
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-default">
    <header
      class="flex h-16 items-center justify-between gap-4 border-b border-default px-4 lg:px-6"
    >
      <div class="flex min-w-0 items-center gap-3">
        <LogoZenda compacto />
        <div class="min-w-0">
          <p class="text-lg font-bold text-highlighted">Cocina</p>
          <p class="truncate text-xs text-muted">{{ sesion.negocio?.nombre }}</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <span class="cifra hidden text-2xl font-bold text-highlighted sm:inline">
          {{ formatearHora(ahora) }}
        </span>
        <slot name="acciones" />
        <UButton
          color="neutral"
          variant="ghost"
          size="lg"
          icon="i-lucide-log-out"
          label="Salir"
          @click="confirmandoSalida = true"
        />
      </div>
    </header>

    <main class="flex-1 p-4 lg:p-6">
      <slot />
    </main>

    <UModal
      v-model:open="confirmandoSalida"
      title="¿Salir de la pantalla de cocina?"
      description="Este dispositivo dejará de mostrar las comandas."
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            size="lg"
            label="Seguir en cocina"
            @click="confirmandoSalida = false"
          />
          <UButton size="lg" icon="i-lucide-log-out" label="Salir" @click="salirDeCocina" />
        </div>
      </template>
    </UModal>
  </div>
</template>
