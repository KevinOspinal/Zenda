<!--
  Pantalla de cocina: tablero de comandas en vivo. Llega en la Fase 3.
  Siempre en modo oscuro: se lee mejor de lejos y cansa menos la vista en la cocina.
-->
<script setup>
definePageMeta({ layout: 'cocina', colorMode: 'dark' });
useHead({ title: 'Cocina · Zenda' });
</script>

<template>
  <PantallaEnConstruccion
    icono="i-lucide-chef-hat"
    titulo="Tablero de cocina"
    :fase="3"
    descripcion="Las comandas en vivo por columnas (pendiente, preparando y listo), con el tiempo de espera de cada una."
  />
</template>
