<!--
  Layout principal (con sesión). Se adapta al dispositivo:
  - Celular: encabezado arriba y navegación inferior, al alcance del pulgar.
  - Tablet horizontal y PC: barra lateral con las secciones y el menú del usuario.
  Las secciones salen del rol (utils/roles.js); el título, de la sección de la página.
-->
<script setup>
const sesion = useSesionStore();
const ruta = useRoute();

const secciones = computed(() => (sesion.rol ? seccionesDe(sesion.rol) : []));
const seccionActual = computed(() => SECCIONES.find((s) => s.id === ruta.meta.seccion));

useHead(() => ({
  title: seccionActual.value ? `${seccionActual.value.etiqueta} · Zenda` : 'Zenda',
}));
</script>

<template>
  <div class="min-h-dvh bg-default lg:flex">
    <BarraLateral :secciones="secciones" class="hidden lg:flex" />

    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-default bg-default/85 px-4 backdrop-blur lg:px-8"
      >
        <div class="flex min-w-0 items-center gap-3">
          <LogoZenda compacto class="lg:hidden" />
          <div class="min-w-0">
            <h1 class="truncate text-lg font-bold text-highlighted">
              {{ seccionActual?.etiqueta ?? 'Zenda' }}
            </h1>
            <p class="truncate text-xs text-muted lg:hidden">{{ sesion.negocio?.nombre }}</p>
          </div>
        </div>
        <slot name="acciones" />
      </header>

      <!-- Espacio abajo en el celular para que la navegación no tape el contenido. -->
      <main class="flex-1 px-4 pt-6 pb-28 lg:px-8 lg:pb-10">
        <slot />
      </main>
    </div>

    <NavegacionInferior :secciones="secciones" class="lg:hidden" />
  </div>
</template>
