<!--
  Código QR dibujado a partir de su contenido, en SVG: se ve nítido en cualquier pantalla y en
  el papel de la impresora térmica. Siempre negro sobre blanco, también en el tema oscuro:
  los lectores de QR lo necesitan así.
-->
<script setup>
const props = defineProps({
  /** Texto que lleva el código, por ejemplo el del QR de cobro del banco. */
  contenido: { type: String, required: true },
  /** Descripción para lectores de pantalla, por ejemplo "QR para pagar con Bre-B". */
  etiqueta: { type: String, default: 'Código QR' },
});

const dibujo = computed(() => dibujoDeQr(props.contenido));
</script>

<template>
  <svg
    :viewBox="`0 0 ${dibujo.tamano} ${dibujo.tamano}`"
    role="img"
    :aria-label="etiqueta"
    shape-rendering="crispEdges"
    class="block aspect-square"
  >
    <rect :width="dibujo.tamano" :height="dibujo.tamano" fill="#fff" />
    <path :d="dibujo.trazo" fill="#000" />
  </svg>
</template>
