<!--
  Zona del documento que se imprime (ver useImpresion): el recibo de venta o la precuenta. En
  pantalla no se ve; al imprimir es lo único que sale en el papel.
-->
<script setup>
const { documento } = useImpresion();
const preferencias = usePreferenciasStore();
</script>

<template>
  <div v-if="documento" class="zona-impresion hidden print:block" aria-hidden="true">
    <ReciboDeVenta
      v-if="documento.tipo === 'recibo' && documento.pedido?.recibo"
      :pedido="documento.pedido"
      :ancho="preferencias.anchoRecibo"
      :copia="documento.copia"
    />
    <PrecuentaDelPedido
      v-else-if="documento.tipo === 'precuenta'"
      :pedido="documento.pedido"
      :negocio="documento.negocio"
      :fecha="documento.fecha"
      :ancho="preferencias.anchoRecibo"
    />
  </div>
</template>
