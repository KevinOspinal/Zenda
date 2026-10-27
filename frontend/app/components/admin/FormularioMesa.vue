<!--
  Crear mesas o editar una. Para crear se pueden agregar varias de una vez en una zona
  ("5 mesas en Terraza": Terraza 1, Terraza 2...). Las mesas con pedidos no se pueden
  eliminar (regla del backend).
-->
<script setup>
import { z } from 'zod';

const props = defineProps({
  /** Mesa a editar; sin ella, se crean mesas nuevas. */
  mesa: { type: /** @type {import('vue').PropType<any>} */ (Object), default: null },
  /** Zonas que ya existen, para elegir rápido. */
  zonas: { type: /** @type {import('vue').PropType<string[]>} */ (Array), default: () => [] },
  /** Cuántas mesas hay ya en cada zona, para seguir la numeración. */
  cantidadPorZona: {
    type: /** @type {import('vue').PropType<Record<string, number>>} */ (Object),
    default: () => ({}),
  },
});

const emit = defineEmits({ guardado: () => true, cancelar: () => true });

const esquema = z.object({
  nombre: z.string().trim().max(40),
  zona: z.string().trim().max(40),
  capacidad: z.number().int().min(1, 'Mínimo 1 puesto').max(50),
  cantidad: z.number().int().min(1).max(30),
});

const datos = reactive({
  nombre: props.mesa?.nombre ?? '',
  zona: props.mesa?.zona ?? props.zonas[0] ?? 'Salón',
  capacidad: props.mesa?.capacidad ?? 4,
  cantidad: 1,
});
const error = ref('');
const eliminando = ref(false);

/** Nombres de las mesas que se van a crear: "Terraza 3", "Terraza 4"... */
const nombresNuevos = computed(() => {
  const zona = datos.zona.trim() || 'Mesa';
  const desde = (props.cantidadPorZona[zona] ?? 0) + 1;
  return Array.from({ length: datos.cantidad }, (_, i) =>
    datos.cantidad === 1 && datos.nombre.trim() ? datos.nombre.trim() : `${zona} ${desde + i}`,
  );
});

async function guardar() {
  error.value = '';
  const zona = datos.zona.trim() || null;
  try {
    if (props.mesa) {
      await useApi().patch(`/mesas/${props.mesa.id}`, {
        nombre: datos.nombre.trim(),
        zona,
        capacidad: datos.capacidad,
      });
    } else {
      // Una por una, en orden, para que la numeración quede como se ve en pantalla.
      for (const nombre of nombresNuevos.value) {
        await useApi().post('/mesas', { nombre, zona, capacidad: datos.capacidad });
      }
    }
    emit('guardado');
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  }
}

async function eliminar() {
  eliminando.value = true;
  error.value = '';
  try {
    await useApi().eliminar(`/mesas/${props.mesa.id}`);
    emit('guardado');
  } catch (fallo) {
    error.value =
      fallo instanceof ErrorApi && fallo.codigo === 'EN_USO'
        ? 'Esta mesa ya tiene pedidos en su historial y no se puede eliminar.'
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
    <UFormField label="Zona" name="zona" hint="Por ejemplo: Salón, Terraza, Segundo piso">
      <UInput v-model="datos.zona" size="lg" class="w-full" list="zonas-existentes" />
      <datalist id="zonas-existentes">
        <option v-for="zona in zonas" :key="zona" :value="zona" />
      </datalist>
    </UFormField>

    <UFormField v-if="!mesa" label="¿Cuántas mesas?" name="cantidad">
      <UInputNumber v-model="datos.cantidad" :min="1" :max="30" size="lg" class="w-40" />
    </UFormField>

    <UFormField
      v-if="mesa || datos.cantidad === 1"
      label="Nombre"
      name="nombre"
      :hint="mesa ? '' : 'Opcional'"
    >
      <UInput v-model="datos.nombre" size="lg" class="w-full" :placeholder="nombresNuevos[0]" />
    </UFormField>

    <UFormField label="Puestos por mesa" name="capacidad">
      <UInputNumber v-model="datos.capacidad" :min="1" :max="50" size="lg" class="w-40" />
    </UFormField>

    <p v-if="!mesa" class="text-sm text-muted">
      Se crearán: <span class="font-medium text-default">{{ nombresNuevos.join(', ') }}</span>
    </p>

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
        v-if="mesa"
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
        <UButton
          type="submit"
          size="lg"
          loading-auto
          icon="i-lucide-check"
          :label="
            mesa ? 'Guardar' : datos.cantidad > 1 ? `Crear ${datos.cantidad} mesas` : 'Crear mesa'
          "
        />
      </div>
    </div>
  </UForm>
</template>
