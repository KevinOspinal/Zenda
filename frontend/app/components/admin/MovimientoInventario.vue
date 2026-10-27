<!--
  Registrar una compra (entrada de mercancía) o un ajuste (conteo físico, rotura o pérdida)
  de un producto. El ajuste puede ser positivo o negativo y exige el motivo, porque puede
  ocultar un faltante: queda en la auditoría.
-->
<script setup>
const props = defineProps({
  /** Producto del inventario: { id, nombre, stock }. */
  producto: { type: /** @type {import('vue').PropType<any>} */ (Object), default: null },
  tipo: {
    type: /** @type {import('vue').PropType<'compra' | 'ajuste'>} */ (String),
    default: 'compra',
  },
});

const abierto = defineModel('abierto', { type: Boolean, default: false });
const emit = defineEmits({ registrado: () => true });

const cantidad = ref(/** @type {number | null} */ (null));
const motivo = ref('');
const registrando = ref(false);
const error = ref('');

watch(
  abierto,
  (estaAbierto) => {
    if (!estaAbierto) return;
    cantidad.value = null;
    motivo.value = '';
    error.value = '';
  },
  { immediate: true },
);

const valido = computed(() => {
  if (!cantidad.value) return false;
  if (props.tipo === 'compra') return cantidad.value > 0;
  return motivo.value.trim().length >= 3;
});
const stockNuevo = computed(() =>
  props.producto && cantidad.value
    ? aDecimal(props.producto.stock).plus(String(cantidad.value))
    : null,
);

async function registrar() {
  registrando.value = true;
  error.value = '';
  try {
    await useApi().post('/inventario/movimientos', {
      tipo: props.tipo,
      productoId: props.producto.id,
      cantidad: cantidad.value,
      ...(props.tipo === 'ajuste' ? { motivo: motivo.value.trim() } : {}),
    });
    emit('registrado');
    abierto.value = false;
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  } finally {
    registrando.value = false;
  }
}
</script>

<template>
  <UModal
    v-model:open="abierto"
    :title="tipo === 'compra' ? `Compra de ${producto?.nombre}` : `Ajustar ${producto?.nombre}`"
    :description="
      tipo === 'compra'
        ? 'Suma al inventario las unidades que llegaron.'
        : 'Corrige el inventario después de contar. Usa un número negativo si faltan unidades.'
    "
  >
    <template #body>
      <div class="space-y-4">
        <UFormField
          :label="tipo === 'compra' ? 'Unidades que llegaron' : 'Unidades a sumar o restar'"
        >
          <UInputNumber
            v-model="cantidad"
            :min="tipo === 'compra' ? 1 : -9999"
            :max="9999"
            size="xl"
            class="w-48"
            autofocus
          />
        </UFormField>
        <UFormField v-if="tipo === 'ajuste'" label="Motivo" required>
          <UInput
            v-model="motivo"
            size="lg"
            class="w-full"
            placeholder="Por ejemplo: conteo físico, botella rota"
            maxlength="300"
          />
        </UFormField>
        <p v-if="stockNuevo" class="cifra text-sm text-muted">
          Stock: {{ formatearCantidad(producto.stock) }} →
          <span
            class="font-bold"
            :class="stockNuevo.isNegative() ? 'text-error' : 'text-highlighted'"
          >
            {{ formatearCantidad(stockNuevo) }}
          </span>
        </p>
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="error"
          role="alert"
        />
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          size="lg"
          label="Cancelar"
          @click="abierto = false"
        />
        <UButton
          size="lg"
          icon="i-lucide-check"
          :label="tipo === 'compra' ? 'Registrar compra' : 'Registrar ajuste'"
          :loading="registrando"
          :disabled="!valido"
          @click="registrar"
        />
      </div>
    </template>
  </UModal>
</template>
