<!--
  Raíz de la app. <UApp> activa en todas las pantallas los toasts, tooltips y modales de
  Nuxt UI, con los textos de sus componentes en español.
-->
<script setup>
import { es } from '@nuxt/ui/locale';

const sesion = useSesionStore();

// Si la sesión termina (el usuario salió, venció o se cerró desde otro dispositivo),
// la app vuelve al ingreso. El ingreso muestra el motivo, si lo hay.
watch(
  () => sesion.activa,
  (activa, estabaActiva) => {
    if (estabaActiva && !activa) navigateTo('/ingresar', { replace: true });
  },
);
</script>

<template>
  <!-- Toasts arriba al centro: en el celular la navegación va abajo y no deben taparla. -->
  <UApp :locale="es" :toaster="{ position: 'top-center', max: 3 }">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
