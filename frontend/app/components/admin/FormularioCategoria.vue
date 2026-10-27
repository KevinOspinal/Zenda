<!--
  Crear, renombrar o eliminar una categoría del menú. Solo se puede eliminar si está vacía
  (regla del backend); si tiene productos, se avisa.
-->
<script setup>
import { z } from 'zod';

const props = defineProps({
  categoria: {
    type: /** @type {import('vue').PropType<{ id: string, nombre: string, orden: number } | null>} */ (
      Object
    ),
    default: null,
  },
  /** Orden para una categoría nueva (al final del menú). */
  ordenNuevo: { type: Number, default: 0 },
});

const emit = defineEmits({
  /** @param {any} _categoria */
  guardado: (_categoria) => true,
  eliminado: () => true,
  cancelar: () => true,
});

const esquema = z.object({ nombre: z.string().trim().min(1, 'Escribe el nombre').max(60) });
const datos = reactive({ nombre: props.categoria?.nombre ?? '' });
const error = ref('');
const eliminando = ref(false);

async function guardar() {
  error.value = '';
  try {
    const guardada = props.categoria
      ? await useApi().patch(`/categorias/${props.categoria.id}`, { nombre: datos.nombre.trim() })
      : await useApi().post('/categorias', {
          nombre: datos.nombre.trim(),
          orden: props.ordenNuevo,
        });
    emit('guardado', guardada);
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  }
}

async function eliminar() {
  if (!props.categoria) return;
  eliminando.value = true;
  error.value = '';
  try {
    await useApi().eliminar(`/categorias/${props.categoria.id}`);
    emit('eliminado');
  } catch (fallo) {
    error.value =
      fallo instanceof ErrorApi && fallo.codigo === 'EN_USO'
        ? 'Tiene productos: muévelos a otra categoría o desactívalos antes de eliminarla.'
        : fallo instanceof ErrorApi
          ? fallo.message
          : MENSAJE_ERROR_GENERICO;
  } finally {
    eliminando.value = false;
  }
}
</script>

<template>
  <UForm :schema="esquema" :state="datos" class="space-y-4" @submit="guardar">
    <UFormField label="Nombre de la categoría" name="nombre">
      <UInput
        v-model="datos.nombre"
        size="lg"
        class="w-full"
        placeholder="Hamburguesas"
        autofocus
      />
    </UFormField>
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="error"
      role="alert"
    />
    <div class="flex flex-wrap justify-between gap-2">
      <UButton
        v-if="categoria"
        color="error"
        variant="ghost"
        size="lg"
        icon="i-lucide-trash-2"
        label="Eliminar"
        :loading="eliminando"
        @click="eliminar"
      />
      <div class="ms-auto flex gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          size="lg"
          label="Cancelar"
          @click="emit('cancelar')"
        />
        <UButton type="submit" size="lg" loading-auto icon="i-lucide-check" label="Guardar" />
      </div>
    </div>
  </UForm>
</template>
