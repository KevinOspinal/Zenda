<!--
  Venta de mostrador: un pedido sin mesa, pensado para cobrar al instante (también se puede
  enviar a la cocina). Al cobrar, empieza una venta nueva.
-->
<script setup>
definePageMeta({ seccion: 'mostrador' });

const pedidoId = ref('');
/** Cambia en cada venta nueva para que la pantalla empiece limpia. */
const venta = ref(0);

function ventaNueva() {
  pedidoId.value = '';
  venta.value += 1;
}
</script>

<template>
  <TomarPedido
    :key="venta"
    :pedido-id="pedidoId"
    @creado="(id) => (pedidoId = id)"
    @cobrado="ventaNueva"
  />
</template>
