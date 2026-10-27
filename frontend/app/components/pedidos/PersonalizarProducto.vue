<!--
  Panel para agregar un producto con cantidad y notas para la cocina.
  En el celular sube desde abajo; en pantallas grandes sale por la derecha.
  Las notas rápidas se tocan como chips; también se puede escribir una nota libre.
-->
<script setup>
/** @typedef {{ id: string, nombre: string, descripcion?: string | null, precio: string }} Producto */
/** @typedef {{ icono: string, fondo: string, texto: string }} AparienciaCategoria */

const props = defineProps({
  producto: {
    type: /** @type {import('vue').PropType<Producto | null>} */ (Object),
    default: null,
  },
  apariencia: {
    type: /** @type {import('vue').PropType<AparienciaCategoria | null>} */ (Object),
    default: null,
  },
});

const abierto = defineModel('abierto', { type: Boolean, default: false });

const emit = defineEmits({
  /** @param {{ producto: Producto, cantidad: number, notas: string }} _datos */
  agregar: (_datos) => true,
});

/** Notas que más se repiten en una cocina colombiana. */
const NOTAS_RAPIDAS = Object.freeze([
  'Sin cebolla',
  'Sin salsas',
  'Bien asada',
  'Término medio',
  'Para llevar',
  'Sin hielo',
]);

/** El backend acepta notas de hasta 200 caracteres. */
const LARGO_MAXIMO_NOTAS = 200;

const cantidad = ref(1);
const notasElegidas = ref(/** @type {string[]} */ ([]));
const notaLibre = ref('');

// Cada vez que se abre, empieza limpio.
watch(abierto, (estaAbierto) => {
  if (!estaAbierto) return;
  cantidad.value = 1;
  notasElegidas.value = [];
  notaLibre.value = '';
});

const pantallaGrande = useMediaQuery('(min-width: 1024px)');

/** @param {string} nota */
function alternarNota(nota) {
  notasElegidas.value = notasElegidas.value.includes(nota)
    ? notasElegidas.value.filter((n) => n !== nota)
    : [...notasElegidas.value, nota];
}

/** Notas finales: las rápidas y la libre, separadas por coma. */
const notas = computed(() =>
  [...notasElegidas.value, notaLibre.value.trim()]
    .filter(Boolean)
    .join(', ')
    .slice(0, LARGO_MAXIMO_NOTAS),
);

/** Valor de lo que se va a agregar (precio × cantidad), solo para mostrar en el botón. */
const valor = computed(() =>
  props.producto ? aDecimal(props.producto.precio).times(cantidad.value || 1) : aDecimal(0),
);

function agregar() {
  if (!props.producto) return;
  emit('agregar', { producto: props.producto, cantidad: cantidad.value, notas: notas.value });
  abierto.value = false;
}
</script>

<template>
  <UDrawer
    v-model:open="abierto"
    :direction="pantallaGrande ? 'right' : 'bottom'"
    :title="producto?.nombre ?? ''"
    :description="producto?.descripcion ?? 'Elige la cantidad y agrega notas para la cocina.'"
  >
    <template #body>
      <div v-if="producto" class="space-y-6 lg:w-96">
        <div class="flex items-center gap-4">
          <span
            v-if="apariencia"
            class="grid size-16 place-items-center rounded-xl"
            :class="apariencia.fondo"
          >
            <UIcon :name="apariencia.icono" class="size-8" :class="apariencia.texto" />
          </span>
          <span class="cifra text-2xl font-bold text-highlighted">
            {{ formatearPesos(producto.precio) }}
          </span>
        </div>

        <UFormField label="Cantidad">
          <UInputNumber v-model="cantidad" :min="1" :max="99" size="xl" class="w-40" />
        </UFormField>

        <UFormField label="Notas para la cocina">
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="nota in NOTAS_RAPIDAS"
              :key="nota"
              :label="nota"
              size="lg"
              color="neutral"
              :variant="notasElegidas.includes(nota) ? 'solid' : 'outline'"
              :aria-pressed="notasElegidas.includes(nota)"
              @click="alternarNota(nota)"
            />
          </div>
        </UFormField>

        <UFormField label="Otra nota" :hint="`${notas.length}/${LARGO_MAXIMO_NOTAS}`">
          <UInput
            v-model="notaLibre"
            size="xl"
            class="w-full"
            placeholder="Ejemplo: salsa aparte"
            :maxlength="LARGO_MAXIMO_NOTAS"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <UButton
        block
        size="xl"
        icon="i-lucide-plus"
        :label="`Agregar · ${formatearPesos(valor)}`"
        @click="agregar"
      />
    </template>
  </UDrawer>
</template>
