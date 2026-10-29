<!--
  Zona del recibo que se imprime (ver useImpresionDeRecibo). En pantalla no se ve; al imprimir
  es lo único que sale en el papel.
-->
<script setup>
const { pedido, copia } = useImpresionDeRecibo();
const preferencias = usePreferenciasStore();
</script>

<template>
  <div v-if="pedido?.recibo" class="zona-impresion hidden print:block" aria-hidden="true">
    <ReciboDeVenta :pedido="pedido" :ancho="preferencias.anchoRecibo" :copia="copia" />
  </div>
</template>
