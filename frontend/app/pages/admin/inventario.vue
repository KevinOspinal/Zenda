<!--
  Inventario: el stock de los productos que lo controlan, en tarjetas que cuentan de un vistazo
  qué hay que atender (ver TarjetaInventario).

  - Arriba, contadores que también filtran (por revisar, agotados, stock bajo, con stock) y un
    buscador. Sin filtro ni búsqueda, los productos se agrupan por categoría de la carta; dentro
    de cada grupo, lo más urgente va primero.
  - Tocar un producto abre al lado una vista rápida en tablet horizontal y PC (PanelInventario)
    y una hoja desde abajo en el celular: su stock, la gráfica de cómo ha cambiado y el historial.
  - «Compra» y «Ajustar» están en cada tarjeta y en la vista rápida (para quien puede).
  - En vivo: cobrar descuenta del inventario y anular lo devuelve; los productos que cambian se
    resaltan y su número cuenta hasta el nuevo.
  - Movimiento: las tarjetas entran en cascada y, al filtrar o al cambiar de estado, se
    reacomodan deslizándose. Con "reducir movimiento" solo cambian de opacidad.
-->
<script setup>
definePageMeta({ seccion: 'inventario' });

const inventario = useInventarioStore();
const sesion = useSesionStore();
const toast = useToast();
const pantallaGrande = useMediaQuery('(min-width: 1024px)');
const puedeRegistrar = computed(() => puede(sesion.rol, 'registrarInventario'));

const { filtro, busqueda, conteo, visibles, grupos, elegidoId, elegido, verTodos } =
  useVistaDeInventario();

const cargar = () => inventario.cargar();
cargar();

// ── Vista rápida (tablet y PC) u hoja de abajo (celular) ──
const hojaAbierta = ref(false);
/** @param {import('~/utils/inventario.js').ProductoDeInventario} producto */
function elegir(producto) {
  if (pantallaGrande.value) {
    // Tocar otra vez el mismo producto cierra la vista rápida.
    elegidoId.value = elegidoId.value === producto.id ? null : producto.id;
    return;
  }
  elegidoId.value = producto.id;
  hojaAbierta.value = true;
}
watch(pantallaGrande, (grande) => {
  if (grande) hojaAbierta.value = false;
  else elegidoId.value = null;
});

// ── Compras y ajustes ──
const movimientoAbierto = ref(false);
const tipoMovimiento = ref(/** @type {'compra' | 'ajuste'} */ ('compra'));
const productoDelMovimiento = ref(
  /** @type {import('~/utils/inventario.js').ProductoDeInventario | null} */ (null),
);
/**
 * @param {import('~/utils/inventario.js').ProductoDeInventario} producto
 * @param {'compra' | 'ajuste'} tipo
 */
function registrarMovimiento(producto, tipo) {
  productoDelMovimiento.value = producto;
  tipoMovimiento.value = tipo;
  movimientoAbierto.value = true;
}
/** @param {{ productoId: string, nombre: string, stock: string }} resultado */
function alRegistrar(resultado) {
  inventario.alRegistrarMovimiento(resultado);
  toast.add({
    title: tipoMovimiento.value === 'compra' ? 'Compra registrada' : 'Ajuste registrado',
    description: `${resultado.nombre}: quedan ${formatearCantidad(resultado.stock)}`,
    icon: 'i-lucide-circle-check',
    color: 'success',
  });
}

// Escape cierra la vista rápida (si no hay un modal abierto: ahí Escape cierra el modal).
onKeyStroke('Escape', () => {
  if (!movimientoAbierto.value) elegidoId.value = null;
});

/** Retraso de la cascada de entrada: las primeras doce tarjetas, una tras otra. */
const retraso = (/** @type {number} */ indice) => `${Math.min(indice, 11) * 30}ms`;
</script>

<template>
  <div class="space-y-5">
    <p class="text-muted">
      Productos que descuentan inventario al cobrarse (actívalo en cada producto del menú).
    </p>

    <!-- Cargando: los contadores y las tarjetas con su forma. -->
    <div
      v-if="inventario.estadoCarga === 'cargando' || inventario.estadoCarga === 'sin_cargar'"
      class="space-y-5"
    >
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <USkeleton v-for="n in 4" :key="n" class="h-16 rounded-xl" />
      </div>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <USkeleton v-for="n in 6" :key="n" class="h-44 rounded-xl" />
      </div>
    </div>

    <UEmpty
      v-else-if="inventario.estadoCarga === 'error'"
      icon="i-lucide-wifi-off"
      title="No pudimos cargar el inventario"
      :description="inventario.errorCarga"
      :actions="[{ label: 'Reintentar', icon: 'i-lucide-rotate-cw', onClick: cargar }]"
    />

    <UEmpty
      v-else-if="!inventario.productos.length"
      icon="i-lucide-package"
      title="Ningún producto controla inventario"
      description="En el menú, activa «Controla inventario» en los productos que quieras contar (por ejemplo, bebidas)."
      :actions="[{ label: 'Ir al menú', icon: 'i-lucide-book-open-text', to: '/admin/menu' }]"
    />

    <!-- El inventario a la izquierda y, en tablet horizontal y PC, la vista rápida a la derecha. -->
    <div v-else class="lg:relative lg:flex lg:items-start lg:gap-6">
      <div class="min-w-0 flex-1 space-y-5">
        <ResumenInventario v-model="filtro" :conteo="conteo" />

        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <UInput
            v-model="busqueda"
            type="search"
            icon="i-lucide-search"
            size="lg"
            placeholder="Buscar producto"
            aria-label="Buscar producto"
            class="w-full sm:w-72"
          >
            <template v-if="busqueda" #trailing>
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                icon="i-lucide-x"
                aria-label="Borrar la búsqueda"
                @click="busqueda = ''"
              />
            </template>
          </UInput>
          <p class="cifra text-sm text-muted" aria-live="polite">
            {{ visibles.length }} de {{ inventario.productos.length }}
            {{ inventario.productos.length === 1 ? 'producto' : 'productos' }}
          </p>
        </div>

        <!-- Las columnas dependen del espacio que le queda (se angosta con la vista rápida). -->
        <div class="@container space-y-6">
          <UEmpty
            v-if="!visibles.length"
            icon="i-lucide-search-x"
            :title="busqueda.trim() ? 'Ningún producto con ese nombre' : 'Ningún producto aquí'"
            description="Prueba con otra búsqueda o mira todo el inventario."
            :actions="[{ label: 'Ver todo', icon: 'i-lucide-layout-grid', onClick: verTodos }]"
          />

          <section v-for="grupo in grupos" :key="grupo.clave" class="space-y-3">
            <h2 v-if="grupo.nombre" class="flex items-center gap-2">
              <span
                class="grid size-7 place-items-center rounded-lg"
                :class="
                  grupo.apariencia
                    ? [grupo.apariencia.fondo, grupo.apariencia.texto]
                    : 'bg-elevated text-muted'
                "
              >
                <UIcon :name="grupo.apariencia?.icono ?? 'i-lucide-package'" class="size-4" />
              </span>
              <span class="text-lg font-bold text-highlighted">{{ grupo.nombre }}</span>
              <span class="cifra text-sm text-muted">
                {{ grupo.productos.length }}
                <template v-if="grupo.porAtender"> · {{ grupo.porAtender }} por atender</template>
              </span>
            </h2>
            <TransitionGroup
              tag="div"
              name="producto"
              type="transition"
              appear
              appear-from-class="producto-aparece-desde"
              appear-active-class="producto-aparece-activa"
              class="relative grid grid-cols-1 gap-3 @sm:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4"
              @before-leave="fijarAlSalir"
            >
              <TarjetaInventario
                v-for="(producto, indice) in grupo.productos"
                :key="producto.id"
                :style="{ '--retraso': retraso(indice) }"
                :producto="producto"
                :categoria="inventario.categoriaPorProducto.get(producto.id) ?? null"
                :resaltado="inventario.resaltados.has(producto.id)"
                :seleccionado="elegidoId === producto.id && pantallaGrande"
                :puede-registrar="puedeRegistrar"
                @seleccionar="elegir"
                @registrar="registrarMovimiento"
              />
            </TransitionGroup>
          </section>
        </div>
      </div>

      <!-- Vista rápida (tablet horizontal y PC): empieza a la altura de los contadores y se
           queda a la vista al bajar, con sus botones siempre en pantalla. -->
      <Transition name="panel" @before-leave="fijarPanelAlSalir">
        <PanelInventario
          v-if="pantallaGrande && elegido"
          :producto="elegido"
          :categoria="inventario.categoriaPorProducto.get(elegido.id) ?? null"
          :puede-registrar="puedeRegistrar"
          class="sticky top-22 w-80 shrink-0 xl:w-96"
          @cerrar="elegidoId = null"
          @registrar="(tipo) => elegido && registrarMovimiento(elegido, tipo)"
        />
      </Transition>
    </div>

    <!-- Celular: el mismo detalle en una hoja desde abajo. -->
    <USlideover
      v-if="!pantallaGrande"
      v-model:open="hojaAbierta"
      side="bottom"
      :title="elegido?.nombre ?? ''"
      :description="
        elegido ? (inventario.categoriaPorProducto.get(elegido.id)?.nombre ?? 'Sin categoría') : ''
      "
      :ui="{ content: 'max-h-[88dvh]' }"
    >
      <template #body>
        <DetalleStock v-if="elegido" :producto="elegido" />
      </template>
      <template v-if="puedeRegistrar && elegido" #footer>
        <div class="grid w-full grid-cols-2 gap-2">
          <UButton
            block
            size="xl"
            icon="i-lucide-truck"
            label="Compra"
            @click="registrarMovimiento(elegido, 'compra')"
          />
          <UButton
            block
            size="xl"
            color="neutral"
            variant="soft"
            icon="i-lucide-scale"
            label="Ajustar"
            @click="registrarMovimiento(elegido, 'ajuste')"
          />
        </div>
      </template>
    </USlideover>

    <MovimientoInventario
      v-model:abierto="movimientoAbierto"
      :producto="productoDelMovimiento"
      :tipo="tipoMovimiento"
      @registrado="alRegistrar"
    />
  </div>
</template>

<style scoped>
/* Al abrir la pantalla: las tarjetas entran en cascada (cada una trae su --retraso). */
.producto-aparece-desde {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
.producto-aparece-activa {
  transition:
    opacity 250ms ease-out,
    transform 250ms ease-out;
  transition-delay: var(--retraso, 0ms);
}

/* Al filtrar o al cambiar de estado: las que entran aparecen, las que salen se desvanecen en su
   sitio y las demás se deslizan a su nuevo lugar. */
.producto-enter-from,
.producto-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
.producto-enter-active {
  transition:
    opacity 200ms ease-out,
    transform 200ms ease-out;
}
.producto-leave-active {
  position: absolute;
  transition:
    opacity 150ms ease-in,
    transform 150ms ease-in;
}
.producto-move {
  transition: transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* La vista rápida entra deslizándose desde la derecha y, al cerrarse, se desvanece en su sitio
   (ver fijarPanelAlSalir) mientras el inventario se ensancha. */
.panel-enter-from {
  opacity: 0;
  transform: translateX(16px);
}
.panel-enter-active {
  transition:
    opacity 250ms ease-out,
    transform 250ms ease-out;
}
.panel-leave-to {
  opacity: 0;
}
.panel-leave-active {
  position: absolute;
  transition: opacity 150ms ease-in;
}

@media (prefers-reduced-motion: reduce) {
  .producto-aparece-desde,
  .producto-enter-from,
  .producto-leave-to,
  .panel-enter-from {
    transform: none;
  }
  .producto-aparece-activa {
    transition-delay: 0ms;
  }
  .producto-move {
    transition: none;
  }
}
</style>
