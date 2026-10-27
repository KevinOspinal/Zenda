<!--
  Tablero de reportes del dueño. Llega en la Fase 6; mientras tanto, un aviso.
-->
<script setup>
definePageMeta({ seccion: 'reportes' });
</script>

<template>
  <PantallaEnConstruccion
    seccion="reportes"
    :fase="6"
    descripcion="Ventas del día, hora pico, productos más vendidos y métodos de pago, con gráficas."
  />
</template>
