<!--
  Layout de las páginas sin sesión (ingreso y registro): una tarjeta centrada con el logo
  sobre un fondo con un toque suave de verde.
-->
<template>
  <div class="relative grid min-h-dvh place-items-center overflow-hidden bg-default px-4 py-10">
    <!-- Brillo verde muy suave arriba: decorativo. -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--ui-primary)_16%,transparent),transparent_70%)]"
    />

    <main class="relative w-full max-w-md space-y-6">
      <div class="flex flex-col items-center gap-2 text-center">
        <LogoZenda />
        <p class="text-sm text-muted">Administración para restaurantes y cafeterías</p>
      </div>

      <div class="rounded-2xl bg-default p-6 shadow-xl ring-1 ring-default sm:p-8">
        <slot />
      </div>
    </main>
  </div>
</template>
