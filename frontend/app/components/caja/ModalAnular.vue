<!--
  Anular un pedido (dueño y administrador). Explica la consecuencia y exige el motivo, que
  queda en la auditoría. Es la única acción de la caja que pide confirmación.
-->
<script setup>
const props = defineProps({
  pedido: { type: /** @type {import('vue').PropType<any>} */ (Object), default: null },
});

const abierto = defineModel('abierto', { type: Boolean, default: false });

const emit = defineEmits({ anulado: () => true });

const pedidos = usePedidosStore();
const toast = useToast();

const MOTIVOS = Object.freeze([
  'El cliente se fue',
  'Pedido duplicado',
  'Error al tomar el pedido',
]);
const motivo = ref('');
const anulando = ref(false);
watch(
  abierto,
  (estaAbierto) => {
    if (estaAbierto) motivo.value = '';
  },
  { immediate: true },
);

async function anular() {
  anulando.value = true;
  try {
    await pedidos.anular(props.pedido.id, motivo.value.trim());
    toast.add({
      title: 'Pedido anulado',
      description: `Motivo: ${motivo.value.trim()}`,
      icon: 'i-lucide-ban',
      color: 'error',
    });
    emit('anulado');
    abierto.value = false;
  } catch (error) {
    toast.add({
      title: error instanceof ErrorApi ? error.message : MENSAJE_ERROR_GENERICO,
      icon: 'i-lucide-circle-alert',
      color: 'error',
    });
  } finally {
    anulando.value = false;
  }
}
</script>

<template>
  <UModal
    v-model:open="abierto"
    :title="`¿Anular el pedido de ${pedido?.mesa?.nombre ?? 'mostrador'}?`"
    description="Se libera la mesa, se devuelve el inventario y el pedido sale del resumen de la caja. Queda registrado en la auditoría."
  >
    <template #body>
      <UFormField label="Motivo" required>
        <div class="mb-3 flex flex-wrap gap-2">
          <UButton
            v-for="sugerido in MOTIVOS"
            :key="sugerido"
            :label="sugerido"
            color="neutral"
            :variant="motivo === sugerido ? 'solid' : 'outline'"
            @click="motivo = sugerido"
          />
        </div>
        <UInput
          v-model="motivo"
          size="xl"
          class="w-full"
          placeholder="Escribe el motivo"
          maxlength="300"
        />
      </UFormField>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          size="lg"
          label="Volver"
          @click="abierto = false"
        />
        <UButton
          color="error"
          size="lg"
          icon="i-lucide-ban"
          label="Anular pedido"
          :loading="anulando"
          :disabled="motivo.trim().length < 3"
          @click="anular"
        />
      </div>
    </template>
  </UModal>
</template>
