<!--
  Un pedido: /pedidos/<id> para uno abierto y /pedidos/nuevo?mesa=<id> para empezar uno.
  Al crearse el pedido nuevo, la dirección cambia a la del pedido sin recargar la pantalla
  (la página conserva su estado gracias a la clave fija).
-->
<script setup>
definePageMeta({ titulo: 'Pedido', key: 'tomar-pedido' });

const ruta = useRoute();
const router = useRouter();

const pedidoId = computed(() => (ruta.params.id === 'nuevo' ? '' : String(ruta.params.id)));
const mesaId = computed(() => String(ruta.query.mesa ?? ''));

/** @param {string} id */
function alCrear(id) {
  router.replace(`/pedidos/${id}`);
}
</script>

<template>
  <TomarPedido :pedido-id="pedidoId" :mesa-id="mesaId" @creado="alCrear" />
</template>
