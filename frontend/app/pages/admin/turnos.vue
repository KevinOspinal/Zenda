<!--
  Historial de turnos de caja. Llega en la Fase 5; mientras tanto, un aviso.
-->
<script setup>
definePageMeta({ seccion: 'turnos' });
</script>

<template>
  <PantallaEnConstruccion
    seccion="turnos"
    :fase="5"
    descripcion="Historial de turnos de caja con su arqueo."
  />
</template>
