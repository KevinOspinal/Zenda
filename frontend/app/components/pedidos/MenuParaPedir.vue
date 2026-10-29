<!--
  Menú para tomar pedidos: buscador, categorías con su ícono y las tarjetas de producto.
  Tocar un producto lo agrega; el botón de nota abre cantidad y notas para la cocina.
  Los datos vienen del store del menú (GET /menu).
-->
<script setup>
defineProps({
  /** Unidades de cada producto que ya van en el pedido: { productoId: cantidad }. */
  cantidades: {
    type: /** @type {import('vue').PropType<Record<string, number>>} */ (Object),
    default: () => ({}),
  },
});

const emit = defineEmits({
  /** @param {any} _producto */
  agregar: (_producto) => true,
  /** @param {any} _producto */
  personalizar: (_producto) => true,
});

const menu = useMenuStore();
menu.cargar();

const busqueda = ref('');
const categoriaElegida = ref('');
/** Categoría activa: la elegida o, al empezar, la primera del menú. */
const categoriaActiva = computed(() => categoriaElegida.value || menu.categorias[0]?.id || '');

/** Productos de la categoría activa o, si hay búsqueda, los que coinciden en todo el menú. */
const productosVisibles = computed(() => {
  const texto = busqueda.value.trim().toLowerCase();
  return texto
    ? menu.productos.filter((producto) => producto.nombre.toLowerCase().includes(texto))
    : menu.productos.filter((producto) => producto.categoriaId === categoriaActiva.value);
});

// Categorías en el celular: una fila que se desliza con el dedo. Un desvanecido en cada borde
// avisa que hay más categorías de ese lado. Desde tablet se acomodan en varias filas.
const filaCategorias = useTemplateRef('filaCategorias');
const { arrivedState } = useScroll(filaCategorias);
const movimiento = usePreferredReducedMotion();
/** Desvanecido de cada borde (solo en celular, donde la fila se desliza). */
const DESVANECIDOS = Object.freeze({
  ambos:
    'max-sm:[mask-image:linear-gradient(to_right,transparent,black_2rem,black_calc(100%-2rem),transparent)]',
  inicio: 'max-sm:[mask-image:linear-gradient(to_right,transparent,black_2rem)]',
  fin: 'max-sm:[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]',
});
const desvanecido = computed(() => {
  const hayAntes = !arrivedState.left;
  const hayDespues = !arrivedState.right;
  if (hayAntes && hayDespues) return DESVANECIDOS.ambos;
  if (hayAntes) return DESVANECIDOS.inicio;
  return hayDespues ? DESVANECIDOS.fin : '';
});

// La categoría elegida siempre queda a la vista (por ejemplo, si estaba al final de la fila).
watch(categoriaActiva, async () => {
  await nextTick();
  filaCategorias.value?.querySelector('[aria-pressed="true"]')?.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
    behavior: movimiento.value === 'reduce' ? 'auto' : 'smooth',
  });
});
</script>

<template>
  <div class="space-y-4">
    <UInput
      v-model="busqueda"
      icon="i-lucide-search"
      size="xl"
      class="w-full"
      placeholder="Buscar en el menú"
      aria-label="Buscar en el menú"
    />

    <!-- Cargando: tarjetas con la forma de los productos. -->
    <div
      v-if="menu.estadoCarga === 'cargando' || menu.estadoCarga === 'sin_cargar'"
      class="space-y-3"
    >
      <div class="flex gap-2">
        <USkeleton v-for="n in 4" :key="n" class="h-10 w-28 rounded-lg" />
      </div>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-3">
        <USkeleton v-for="n in 6" :key="n" class="h-20 rounded-xl" />
      </div>
    </div>

    <UEmpty
      v-else-if="menu.estadoCarga === 'error'"
      icon="i-lucide-wifi-off"
      title="No pudimos cargar el menú"
      :description="menu.errorCarga"
      :actions="[
        {
          label: 'Reintentar',
          icon: 'i-lucide-rotate-cw',
          onClick: () => menu.cargar({ forzar: true }),
        },
      ]"
    />

    <UEmpty
      v-else-if="!menu.categorias.length"
      icon="i-lucide-book-open-text"
      title="El menú está vacío"
      description="El dueño o el administrador agrega los productos en Administración."
    />

    <template v-else>
      <div
        v-if="!busqueda"
        ref="filaCategorias"
        class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible"
        :class="desvanecido"
        role="group"
        aria-label="Categorías"
      >
        <UButton
          v-for="categoria in menu.categorias"
          :key="categoria.id"
          :label="categoria.nombre"
          :icon="categoria.apariencia.icono"
          size="lg"
          class="shrink-0"
          :color="categoriaActiva === categoria.id ? 'primary' : 'neutral'"
          :variant="categoriaActiva === categoria.id ? 'solid' : 'soft'"
          :aria-pressed="categoriaActiva === categoria.id"
          @click="categoriaElegida = categoria.id"
        />
      </div>

      <!-- Tantas columnas como quepan, sin que una tarjeta quede de menos de 15rem (240 px). -->
      <div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-3">
        <TarjetaProducto
          v-for="producto in productosVisibles"
          :key="producto.id"
          :producto="producto"
          :apariencia="producto.apariencia"
          :cantidad="cantidades[producto.id] ?? 0"
          @agregar="emit('agregar', producto)"
          @personalizar="emit('personalizar', producto)"
        />
      </div>

      <UEmpty
        v-if="busqueda && !productosVisibles.length"
        icon="i-lucide-search-x"
        title="No encontramos ese producto"
        :description="`Nada en el menú coincide con “${busqueda}”.`"
      />
    </template>
  </div>
</template>
