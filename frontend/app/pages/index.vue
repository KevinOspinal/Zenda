<!--
  Inicio provisional de la Fase 0: confirma que el tema funciona y lleva al muestrario.
  En la Fase 1 se reemplaza por la redirección al inicio de cada rol.
-->
<template>
  <main class="grid min-h-dvh place-items-center p-6">
    <div class="space-y-6 text-center">
      <div class="mx-auto grid size-16 place-items-center rounded-xl bg-primary/10">
        <UIcon name="i-lucide-leaf" class="size-9 text-primary" />
      </div>
      <div class="space-y-2">
        <h1 class="text-3xl font-bold text-highlighted">Zenda</h1>
        <p class="text-muted">Administración para restaurantes y cafeterías</p>
      </div>
      <UButton
        to="/muestrario"
        size="xl"
        icon="i-lucide-palette"
        trailing-icon="i-lucide-arrow-right"
        label="Ver el muestrario"
      />
    </div>
  </main>
</template>
