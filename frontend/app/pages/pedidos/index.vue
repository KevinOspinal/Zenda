<!--
  Pedidos abiertos del mesero. Llega en la Fase 2; mientras tanto, un aviso.
-->
<script setup>
definePageMeta({ seccion: 'pedidos' });
</script>

<template>
  <PantallaEnConstruccion
    seccion="pedidos"
    :fase="2"
    descripcion="Tus pedidos abiertos y cómo van en la cocina."
  />
</template>
