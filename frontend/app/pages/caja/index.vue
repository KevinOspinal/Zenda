<!--
  Caja: turno, cobro y arqueo. Llega en la Fase 4; mientras tanto, un aviso.
-->
<script setup>
definePageMeta({ seccion: 'caja' });
</script>

<template>
  <PantallaEnConstruccion
    seccion="caja"
    :fase="4"
    descripcion="Abrir y cerrar la caja, cobrar con propina y pagos mixtos, y contar el efectivo en el arqueo."
  />
</template>
