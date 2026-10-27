<!--
  Tablero de cocina en vivo: las comandas en tres columnas (Pendiente, Preparando y Listo),
  la que más espera primero, con el tiempo de cada una en el color de su urgencia.
  Las comandas nuevas entran con sonido; los cambios de otros dispositivos llegan solos.
  Siempre en modo oscuro: se lee mejor de lejos y cansa menos la vista.
-->
<script setup>
definePageMeta({ layout: 'cocina', colorMode: 'dark' });
useHead({ title: 'Cocina · Zenda' });

const pedidos = usePedidosStore();
const conexion = useConexionStore();
const toast = useToast();
const ahora = useNow({ interval: 15_000 });

pedidos.cargarActivos();

const tablero = computed(() => armarTablero(pedidos.lista, ahora.value));

const COLUMNAS = Object.freeze([
  {
    id: /** @type {const} */ ('pendiente'),
    titulo: 'Pendiente',
    icono: 'i-lucide-clock',
    ayuda: 'Toca un plato para empezarlo.',
  },
  {
    id: /** @type {const} */ ('preparando'),
    titulo: 'Preparando',
    icono: 'i-lucide-flame',
    ayuda: 'Toca un plato cuando esté listo.',
  },
  {
    id: /** @type {const} */ ('listo'),
    titulo: 'Listo',
    icono: 'i-lucide-bell-ring',
    ayuda: 'Esperando a que el mesero los lleve.',
  },
]);

/** Platos que se están actualizando (para no tocarlos dos veces). */
const ocupados = ref(/** @type {Set<string>} */ (new Set()));

/**
 * Cambia el estado de un plato. Se ve al instante; si falla, se avisa y se pone al día.
 * @param {string} pedidoId
 * @param {any} item
 * @param {'preparando' | 'listo' | 'entregado'} estado
 */
async function cambiar(pedidoId, item, estado) {
  ocupados.value.add(item.id);
  try {
    await pedidos.cambiarEstadoCocina(pedidoId, item.id, estado);
  } catch (error) {
    toast.add({
      title: error instanceof ErrorApi ? error.message : MENSAJE_ERROR_GENERICO,
      icon: 'i-lucide-circle-alert',
      color: 'error',
    });
    pedidos.alCambiarPedido({ id: pedidoId });
  } finally {
    ocupados.value.delete(item.id);
  }
}

/**
 * Tocar un plato lo avanza un paso. En la cocina llega hasta "listo"; entregarlo es del mesero.
 * @param {import('~/utils/cocina.js').ComandaDelTablero} comanda
 * @param {any} item
 */
function avanzar(comanda, item) {
  const siguiente = siguienteEstadoCocina(item.estadoCocina);
  if (siguiente === 'preparando' || siguiente === 'listo')
    cambiar(comanda.pedido.id, item, siguiente);
}

/**
 * Marca como listo todo lo que falta de una comanda.
 * @param {import('~/utils/cocina.js').ComandaDelTablero} comanda
 */
async function todoListo(comanda) {
  const faltan = comanda.items.filter((item) =>
    ['pendiente', 'preparando'].includes(item.estadoCocina),
  );
  for (const item of faltan) await cambiar(comanda.pedido.id, item, 'listo');
}

/**
 * La comanda ya salió de la cocina: sus platos listos quedan entregados.
 * @param {import('~/utils/cocina.js').ComandaDelTablero} comanda
 */
async function entregar(comanda) {
  const listos = comanda.items.filter((item) => item.estadoCocina === 'listo');
  for (const item of listos) await cambiar(comanda.pedido.id, item, 'entregado');
}

// Anuncio para lectores de pantalla cuando llega una comanda nueva.
const anuncio = ref('');
watch(
  () => tablero.value.pendiente.map((comanda) => comanda.pedido.id),
  (_actuales, anteriores = []) => {
    const nuevas = tablero.value.pendiente.filter((c) => !anteriores.includes(c.pedido.id));
    if (nuevas.length && anteriores.length) {
      anuncio.value = `Nueva comanda: ${nuevas.map((c) => c.pedido.mesa?.nombre ?? 'Mostrador').join(', ')}`;
    }
  },
);
</script>

<template>
  <div class="space-y-4">
    <UAlert
      v-if="conexion.estado !== 'en_vivo'"
      :color="conexion.estado === 'sin_conexion' ? 'error' : 'warning'"
      variant="solid"
      icon="i-lucide-wifi-off"
      :title="
        conexion.estado === 'sin_conexion'
          ? 'Sin conexión: los cambios no se están guardando'
          : 'Reconectando…'
      "
      description="Las comandas nuevas aparecen cuando vuelva la conexión."
    />

    <div
      v-if="pedidos.estadoCarga === 'cargando' || pedidos.estadoCarga === 'sin_cargar'"
      class="grid gap-4 lg:grid-cols-3"
    >
      <USkeleton v-for="n in 3" :key="n" class="h-[60vh] rounded-2xl" />
    </div>

    <UEmpty
      v-else-if="pedidos.estadoCarga === 'error'"
      icon="i-lucide-wifi-off"
      title="No pudimos cargar las comandas"
      :description="pedidos.errorCarga"
      :actions="[
        { label: 'Reintentar', icon: 'i-lucide-rotate-cw', onClick: pedidos.cargarActivos },
      ]"
    />

    <div v-else class="grid gap-4 lg:grid-cols-3">
      <section
        v-for="columna in COLUMNAS"
        :key="columna.id"
        class="flex min-h-[60vh] flex-col gap-3 rounded-2xl bg-muted/60 p-3"
        :aria-labelledby="`columna-${columna.id}`"
      >
        <header class="flex items-center justify-between gap-2 px-1 pt-1">
          <h2
            :id="`columna-${columna.id}`"
            class="flex items-center gap-2 text-xl font-bold text-highlighted"
          >
            <UIcon :name="columna.icono" class="size-6" />
            {{ columna.titulo }}
          </h2>
          <span
            class="cifra grid h-8 min-w-8 place-items-center rounded-full bg-elevated px-2 text-lg font-bold text-highlighted"
          >
            {{ tablero[columna.id].length }}
          </span>
        </header>
        <p class="px-1 text-sm text-muted">{{ columna.ayuda }}</p>

        <TransitionGroup
          tag="div"
          class="flex flex-col gap-3"
          enter-from-class="opacity-0 scale-95"
          enter-active-class="transition duration-300 motion-reduce:transition-none"
          leave-to-class="opacity-0"
          leave-active-class="transition duration-200 motion-reduce:transition-none"
        >
          <TarjetaComanda
            v-for="comanda in tablero[columna.id]"
            :key="comanda.pedido.id"
            :comanda="comanda"
            :ocupados="ocupados"
            @avanzar="(item) => avanzar(comanda, item)"
            @todo-listo="todoListo(comanda)"
            @entregar="entregar(comanda)"
          />
        </TransitionGroup>

        <p v-if="!tablero[columna.id].length" class="m-auto py-10 text-center text-muted">
          Sin comandas
        </p>
      </section>
    </div>

    <p class="sr-only" aria-live="polite">{{ anuncio }}</p>
  </div>
</template>
