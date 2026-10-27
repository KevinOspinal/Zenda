<!--
  Avisos de platos listos. Llega en la Fase 2; mientras tanto, un aviso.
-->
<script setup>
definePageMeta({ seccion: 'avisos' });
</script>

<template>
  <PantallaEnConstruccion
    seccion="avisos"
    :fase="2"
    descripcion="Los platos que la cocina tiene listos para llevar a tus mesas."
  />
</template>
