<!--
  Administración del menú: categorías y productos. Cada producto muestra su precio, su
  impuesto y si controla inventario; el interruptor lo activa o desactiva al instante.
  Crear y editar se hace en un panel lateral (desde abajo en el celular).
-->
<script setup>
definePageMeta({ seccion: 'menu' });

const toast = useToast();
const menuParaPedidos = useMenuStore();
const pantallaGrande = useMediaQuery('(min-width: 1024px)');

const categorias = ref(/** @type {any[]} */ ([]));
const productos = ref(/** @type {any[]} */ ([]));
const cargando = ref(true);
const error = ref('');
const categoriaActiva = ref('');

async function cargar() {
  error.value = '';
  try {
    const [listaCategorias, listaProductos] = await Promise.all([
      useApi().get('/categorias'),
      useApi().get('/productos'),
    ]);
    categorias.value = listaCategorias;
    productos.value = listaProductos;
    if (!categorias.value.some((c) => c.id === categoriaActiva.value)) {
      categoriaActiva.value = categorias.value[0]?.id ?? '';
    }
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  } finally {
    cargando.value = false;
  }
}
cargar();

/** Después de un cambio: recargar y poner al día el menú con el que se toman pedidos. */
function alCambiar() {
  cargar();
  menuParaPedidos.cargar({ forzar: true });
}

const productosVisibles = computed(() =>
  productos.value.filter((producto) => producto.categoriaId === categoriaActiva.value),
);

// Activar o desactivar un producto al instante (con reversión si falla).
/** @param {any} producto */
async function alternarActivo(producto) {
  producto.activo = !producto.activo;
  try {
    await useApi().patch(`/productos/${producto.id}`, { activo: producto.activo });
    menuParaPedidos.cargar({ forzar: true });
  } catch (fallo) {
    producto.activo = !producto.activo;
    toast.add({
      title: fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO,
      icon: 'i-lucide-circle-alert',
      color: 'error',
    });
  }
}

// Paneles de producto y de categoría.
const panelProducto = ref(false);
const productoEditado = ref(/** @type {any} */ (null));
/** @param {any} producto */
function editarProducto(producto) {
  productoEditado.value = producto;
  panelProducto.value = true;
}
/** @param {any} producto */
function alGuardarProducto(producto) {
  panelProducto.value = false;
  toast.add({
    title: 'Producto guardado',
    description: producto.nombre,
    icon: 'i-lucide-circle-check',
    color: 'success',
  });
  alCambiar();
}

const panelCategoria = ref(false);
const categoriaEditada = ref(/** @type {any} */ (null));
/** @param {any} categoria */
function editarCategoria(categoria) {
  categoriaEditada.value = categoria;
  panelCategoria.value = true;
}
function alGuardarCategoria() {
  panelCategoria.value = false;
  alCambiar();
}
</script>

<template>
  <div class="space-y-5">
    <div v-if="cargando" class="space-y-3">
      <div class="flex gap-2">
        <USkeleton v-for="n in 4" :key="n" class="h-10 w-28 rounded-lg" />
      </div>
      <USkeleton v-for="n in 5" :key="n" class="h-16 rounded-xl" />
    </div>
    <UEmpty
      v-else-if="error"
      icon="i-lucide-wifi-off"
      title="No pudimos cargar el menú"
      :description="error"
      :actions="[{ label: 'Reintentar', icon: 'i-lucide-rotate-cw', onClick: cargar }]"
    />

    <template v-else>
      <!-- Categorías. -->
      <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Categorías">
        <UButton
          v-for="(categoria, posicion) in categorias"
          :key="categoria.id"
          :label="categoria.nombre"
          :icon="aparienciaDeCategoria(categoria.nombre, posicion).icono"
          size="lg"
          :color="categoriaActiva === categoria.id ? 'primary' : 'neutral'"
          :variant="categoriaActiva === categoria.id ? 'solid' : 'soft'"
          :aria-pressed="categoriaActiva === categoria.id"
          @click="categoriaActiva = categoria.id"
        />
        <UButton
          icon="i-lucide-plus"
          label="Categoría"
          size="lg"
          color="neutral"
          variant="outline"
          @click="editarCategoria(null)"
        />
      </div>

      <UEmpty
        v-if="!categorias.length"
        icon="i-lucide-book-open-text"
        title="El menú está vacío"
        description="Crea la primera categoría (por ejemplo, Hamburguesas) y luego sus productos."
        :actions="[
          { label: 'Nueva categoría', icon: 'i-lucide-plus', onClick: () => editarCategoria(null) },
        ]"
      />

      <template v-else>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-muted">
            {{ productosVisibles.length }}
            {{ productosVisibles.length === 1 ? 'producto' : 'productos' }}
          </p>
          <div class="flex gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              label="Editar categoría"
              @click="editarCategoria(categorias.find((c) => c.id === categoriaActiva))"
            />
            <UButton icon="i-lucide-plus" label="Nuevo producto" @click="editarProducto(null)" />
          </div>
        </div>

        <ul class="space-y-2">
          <li
            v-for="producto in productosVisibles"
            :key="producto.id"
            class="flex items-center gap-3 rounded-xl bg-default p-3 ring-1 ring-default"
            :class="!producto.activo && 'opacity-60'"
          >
            <button
              type="button"
              class="min-w-0 flex-1 text-left"
              :aria-label="`Editar ${producto.nombre}`"
              @click="editarProducto(producto)"
            >
              <span class="block truncate font-semibold text-highlighted">{{
                producto.nombre
              }}</span>
              <span class="flex flex-wrap items-center gap-2 text-sm">
                <span class="cifra font-semibold text-primary">{{
                  formatearPesos(producto.precio)
                }}</span>
                <UBadge
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  :label="TIPOS_IMPUESTO[producto.tipoImpuesto].etiqueta"
                />
                <UBadge
                  v-if="producto.controlaStock"
                  color="info"
                  variant="subtle"
                  size="sm"
                  icon="i-lucide-package"
                  :label="`Stock ${formatearCantidad(producto.stock)}`"
                />
              </span>
            </button>
            <USwitch
              :model-value="producto.activo"
              :aria-label="`${producto.activo ? 'Desactivar' : 'Activar'} ${producto.nombre}`"
              @update:model-value="alternarActivo(producto)"
            />
          </li>
        </ul>
        <UEmpty
          v-if="!productosVisibles.length"
          variant="naked"
          icon="i-lucide-utensils"
          title="Esta categoría no tiene productos"
          :actions="[
            { label: 'Nuevo producto', icon: 'i-lucide-plus', onClick: () => editarProducto(null) },
          ]"
        />
      </template>
    </template>

    <USlideover
      v-model:open="panelProducto"
      :side="pantallaGrande ? 'right' : 'bottom'"
      :title="productoEditado ? 'Editar producto' : 'Nuevo producto'"
    >
      <template #body>
        <FormularioProducto
          :key="productoEditado?.id ?? 'nuevo'"
          :producto="productoEditado"
          :categorias="categorias"
          :categoria-inicial="categoriaActiva"
          @guardado="alGuardarProducto"
          @cancelar="panelProducto = false"
        />
      </template>
    </USlideover>

    <UModal
      v-model:open="panelCategoria"
      :title="categoriaEditada ? 'Editar categoría' : 'Nueva categoría'"
    >
      <template #body>
        <FormularioCategoria
          :key="categoriaEditada?.id ?? 'nueva'"
          :categoria="categoriaEditada"
          :orden-nuevo="categorias.length"
          @guardado="alGuardarCategoria"
          @eliminado="alGuardarCategoria"
          @cancelar="panelCategoria = false"
        />
      </template>
    </UModal>
  </div>
</template>
