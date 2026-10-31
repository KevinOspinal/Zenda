<!--
  Layout de las páginas sin sesión (ingreso y registro).
  - Desde 1024 px: pantalla dividida, con el panel de la marca a la izquierda (qué es Zenda)
    y el formulario a la derecha.
  - En celular y tablet vertical: una franja índigo con el logo arriba y el formulario en una
    tarjeta que se monta sobre ella, a todo el ancho y al alcance del pulgar.
-->
<script setup>
const anio = new Date().getFullYear();
</script>

<template>
  <div class="grid min-h-dvh grid-cols-1 bg-default lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
    <PanelDeMarca class="hidden lg:flex" />

    <div class="flex min-w-0 flex-col">
      <!-- Franja de la marca en pantallas pequeñas. -->
      <header
        class="relative isolate overflow-hidden bg-primary-900 px-6 pt-8 pb-20 text-primary-50 lg:hidden"
      >
        <div
          aria-hidden="true"
          class="absolute -top-20 -right-16 -z-10 size-64 rounded-full bg-secondary-500/30 blur-3xl"
        />
        <LogoZenda sobre-marca />
        <p class="mt-4 max-w-sm text-xl leading-snug font-bold text-balance">
          Tu restaurante en orden, del pedido al cobro.
        </p>
      </header>

      <main class="flex flex-1 justify-center px-4 lg:items-center lg:px-12 lg:py-12">
        <div
          class="-mt-12 w-full max-w-md rounded-2xl bg-default p-6 shadow-xl ring-1 ring-default motion-safe:animate-aparecer sm:p-8 lg:mt-0 lg:rounded-none lg:p-0 lg:shadow-none lg:ring-0"
        >
          <slot />
        </div>
      </main>

      <footer class="px-6 py-6 text-center text-xs text-muted">
        Hecho en Colombia · © {{ anio }} Zenda
      </footer>
    </div>
  </div>
</template>
