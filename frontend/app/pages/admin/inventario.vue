<!--
  Inventario. Llega en la Fase 5; mientras tanto, un aviso.
-->
<script setup>
definePageMeta({ seccion: 'inventario' });
</script>

<template>
  <PantallaEnConstruccion
    seccion="inventario"
    :fase="5"
    descripcion="Stock de bebidas y productos, compras y ajustes."
  />
</template>
