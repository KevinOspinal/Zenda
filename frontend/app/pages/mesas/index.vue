<!--
  Mapa de mesas en vivo. Cada mesa se dibuja vista desde arriba, con una silla por puesto, y si
  está ocupada cuenta qué pasa: cómo va la cocina, si falta enviar el pedido, cuánto llevan
  esperando, quién la atiende y su total (ver TarjetaMesa).

  - Arriba, contadores que también filtran (libres, ocupadas, platos listos, esperando mucho) y
    las zonas. Con "Todas", las mesas se agrupan por zona.
  - Tocar una mesa libre empieza un pedido. Tocar una ocupada abre su pedido en el celular; en
    tablet horizontal y PC abre al lado una vista rápida (PanelMesa) y el mapa sigue a la vista.
    Una mesa que ya pagó sigue ocupada hasta que le entreguen los platos.
  - Sin caja abierta no se pueden tomar pedidos: se avisa arriba.
  - Movimiento: las mesas entran en cascada al abrir la pantalla y, al filtrar, se reacomodan
    deslizándose. Con "reducir movimiento" solo cambian de opacidad.
-->
<script setup>
definePageMeta({ seccion: 'mesas' });

const mesas = useMesasStore();
const pedidos = usePedidosStore();
const caja = useCajaStore();
const sesion = useSesionStore();
const toast = useToast();
const pantallaGrande = useMediaQuery('(min-width: 1024px)');

const {
  zonaActiva,
  filtro,
  datosPorMesa,
  conteo,
  mesasVisibles,
  grupos,
  mesaElegidaId,
  mesaElegida,
  datosElegida,
  verTodas,
} = useMapaDeMesas();

/** Trae las mesas, los pedidos activos y si la caja está abierta. */
function cargar() {
  return Promise.all([mesas.cargar(), pedidos.cargarActivos(), caja.cargarEstado()]);
}
cargar();

/** @param {import('~/stores/mesas.js').Mesa} mesa */
async function abrirMesa(mesa) {
  let pedido = datosPorMesa.value.get(mesa.id)?.pedido;
  if (!pedido && mesa.estado === 'ocupada') {
    // Ocupada sin pedido a la vista: quizá se ocupó en otro dispositivo hace un instante. Si
    // tampoco aparece al traer los pedidos, no tiene nada en curso y se puede tomar uno nuevo.
    await pedidos.cargarActivos();
    pedido = datosPorMesa.value.get(mesa.id)?.pedido;
  }
  if (pedido) {
    // En tablet horizontal y PC, la vista rápida; tocar otra vez la misma mesa la cierra.
    if (pantallaGrande.value) {
      mesaElegidaId.value = mesaElegidaId.value === mesa.id ? null : mesa.id;
      return;
    }
    return navigateTo(`/pedidos/${pedido.id}`);
  }
  if (caja.abierta === false) {
    toast.add({
      title: 'La caja está cerrada',
      description: 'Hay que abrirla para tomar pedidos.',
      icon: 'i-lucide-lock',
      color: 'warning',
    });
    return;
  }
  return navigateTo(`/pedidos/nuevo?mesa=${mesa.id}`);
}

// Cobro desde la vista rápida. Vive aquí y no en el panel: si la mesa se libera al cobrar, el
// panel se cierra, pero el resumen del cobro (con el cambio) debe seguir a la vista.
const cobrando = ref(false);
const pedidoPorCobrar = ref('');
function cobrarElegida() {
  pedidoPorCobrar.value = datosElegida.value?.pedido?.id ?? '';
  cobrando.value = Boolean(pedidoPorCobrar.value);
}

// Escape cierra la vista rápida (si no se está cobrando: ahí Escape cierra el cobro).
onKeyStroke('Escape', () => {
  if (!cobrando.value) mesaElegidaId.value = null;
});
// Al pasar al celular, la vista rápida no se muestra: se olvida la mesa elegida.
watch(pantallaGrande, (grande) => {
  if (!grande) mesaElegidaId.value = null;
});

/**
 * Antes de salir, la tarjeta se queda donde estaba (posición absoluta) para que las demás se
 * deslicen a ocupar su lugar en lugar de saltar.
 * @param {Element} elemento
 */
function fijarAlSalir(elemento) {
  const tarjeta = /** @type {HTMLElement} */ (elemento);
  const { offsetLeft, offsetTop, offsetWidth, offsetHeight } = tarjeta;
  Object.assign(tarjeta.style, {
    left: `${offsetLeft}px`,
    top: `${offsetTop}px`,
    width: `${offsetWidth}px`,
    height: `${offsetHeight}px`,
  });
}

/**
 * Al cerrarse, la vista rápida se desvanece en su sitio (posición absoluta dentro de su fila):
 * así el mapa recupera el ancho de una vez y las mesas se deslizan a su lugar, en vez de saltar
 * cuando el panel termina de irse.
 * @param {Element} elemento
 */
function fijarPanelAlSalir(elemento) {
  const panel = /** @type {HTMLElement} */ (elemento);
  const fila = panel.parentElement;
  if (!fila) return;
  const lugar = panel.getBoundingClientRect();
  const origen = fila.getBoundingClientRect();
  Object.assign(panel.style, {
    top: `${lugar.top - origen.top}px`,
    left: `${lugar.left - origen.left}px`,
    width: `${lugar.width}px`,
    height: `${lugar.height}px`,
  });
}

/** Retraso de la cascada de entrada: las primeras doce mesas, una tras otra. */
const retraso = (/** @type {number} */ indice) => `${Math.min(indice, 11) * 30}ms`;
</script>

<template>
  <div>
    <!-- Cargando: los contadores y las tarjetas con su forma. -->
    <div
      v-if="mesas.estadoCarga === 'cargando' || mesas.estadoCarga === 'sin_cargar'"
      class="space-y-5"
    >
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <USkeleton v-for="n in 4" :key="n" class="h-16 rounded-xl" />
      </div>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <USkeleton v-for="n in 8" :key="n" class="h-52 rounded-xl" />
      </div>
    </div>

    <UEmpty
      v-else-if="mesas.estadoCarga === 'error'"
      icon="i-lucide-wifi-off"
      title="No pudimos cargar las mesas"
      :description="mesas.errorCarga"
      :actions="[{ label: 'Reintentar', icon: 'i-lucide-rotate-cw', onClick: cargar }]"
    />

    <UEmpty
      v-else-if="!mesas.lista.length"
      icon="i-lucide-armchair"
      title="Aún no hay mesas"
      description="El dueño o el administrador las crea en «Mesas y zonas»."
      :actions="
        puede(sesion.rol, 'gestionarMesas')
          ? [{ label: 'Crear mesas', icon: 'i-lucide-plus', to: '/admin/mesas' }]
          : []
      "
    />

    <!-- El mapa a la izquierda y, en tablet horizontal y PC, la vista rápida a la derecha. -->
    <div v-else class="lg:relative lg:flex lg:items-start lg:gap-6">
      <div class="min-w-0 flex-1 space-y-5">
        <UAlert
          v-if="caja.abierta === false"
          color="warning"
          variant="subtle"
          icon="i-lucide-lock"
          title="La caja está cerrada"
          :description="
            puede(sesion.rol, 'manejarCaja')
              ? 'Ábrela para empezar a tomar pedidos.'
              : 'Pide al cajero que la abra para tomar pedidos.'
          "
          :actions="
            puede(sesion.rol, 'manejarCaja')
              ? [{ label: 'Ir a la caja', to: '/caja', color: 'warning', variant: 'outline' }]
              : []
          "
        />

        <ResumenMesas v-model="filtro" :conteo="conteo" />

        <div class="flex flex-wrap items-center justify-between gap-3">
          <SelectorZona
            v-if="mesas.zonas.length > 1"
            v-model="zonaActiva"
            :zonas="[TODAS_LAS_ZONAS, ...mesas.zonas]"
            class="min-w-0"
          />
          <UButton
            v-if="puede(sesion.rol, 'gestionarMesas')"
            to="/admin/mesas"
            color="neutral"
            variant="ghost"
            icon="i-lucide-pencil"
            label="Editar mesas"
            class="ms-auto"
          />
        </div>

        <!-- El mapa: sus columnas dependen del espacio que le queda (se angosta con el panel). -->
        <div class="@container space-y-6">
          <UEmpty
            v-if="!mesasVisibles.length"
            icon="i-lucide-search-x"
            title="Ninguna mesa en este filtro"
            description="Cuando alguna mesa entre aquí, aparece sola."
            :actions="[{ label: 'Ver todas', icon: 'i-lucide-layout-grid', onClick: verTodas }]"
          />

          <section v-for="grupo in grupos" :key="grupo.zona || 'todas'" class="space-y-3">
            <h2 v-if="grupo.zona" class="flex items-baseline gap-2">
              <span class="text-lg font-bold text-highlighted">{{ grupo.zona }}</span>
              <span class="cifra text-sm text-muted"
                >{{ grupo.libres }} de {{ grupo.total }} libres</span
              >
            </h2>
            <!-- type="transition": el halo de las mesas con platos listos es una animación sin
                 fin; sin esto, Vue esperaría a que termine para dar por hecha la entrada. -->
            <TransitionGroup
              tag="div"
              name="mesa"
              type="transition"
              appear
              appear-from-class="mesa-aparece-desde"
              appear-active-class="mesa-aparece-activa"
              class="relative grid grid-cols-2 gap-3 @lg:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5"
              @before-leave="fijarAlSalir"
            >
              <TarjetaMesa
                v-for="(mesa, indice) in grupo.mesas"
                :key="mesa.id"
                :style="{ '--retraso': retraso(indice) }"
                :mesa="mesa"
                :tiene-platos-listos="datosPorMesa.get(mesa.id)?.platosListos"
                :minutos-abierta="datosPorMesa.get(mesa.id)?.minutos ?? null"
                :total="datosPorMesa.get(mesa.id)?.total ?? null"
                :pagada="datosPorMesa.get(mesa.id)?.pagada"
                :avance="datosPorMesa.get(mesa.id)?.avance ?? null"
                :minutos-esperando="datosPorMesa.get(mesa.id)?.minutosEsperando ?? null"
                :sin-enviar="datosPorMesa.get(mesa.id)?.sinEnviar"
                :mesero="datosPorMesa.get(mesa.id)?.mesero ?? null"
                :resaltada="mesas.resaltadas.has(mesa.id)"
                :seleccionada="mesaElegidaId === mesa.id"
                :bloqueada="caja.abierta === false"
                @seleccionar="abrirMesa"
              />
            </TransitionGroup>
          </section>
        </div>
      </div>

      <!-- Vista rápida (tablet horizontal y PC): empieza a la altura de los contadores y se
           queda a la vista al bajar por el mapa, con sus botones siempre en pantalla. -->
      <Transition name="panel" @before-leave="fijarPanelAlSalir">
        <PanelMesa
          v-if="pantallaGrande && mesaElegida && datosElegida?.pedido"
          :mesa="mesaElegida"
          :datos="datosElegida"
          class="sticky top-22 w-80 shrink-0 xl:w-96"
          @cerrar="mesaElegidaId = null"
          @cobrar="cobrarElegida"
        />
      </Transition>
    </div>

    <ModalCobro
      v-if="puede(sesion.rol, 'cobrar')"
      v-model:abierto="cobrando"
      :pedido-id="pedidoPorCobrar"
    />
  </div>
</template>

<style scoped>
/* Al abrir la pantalla: las mesas entran en cascada (cada una trae su --retraso). */
.mesa-aparece-desde {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
.mesa-aparece-activa {
  transition:
    opacity 250ms ease-out,
    transform 250ms ease-out;
  transition-delay: var(--retraso, 0ms);
}

/* Al filtrar: las que entran aparecen, las que salen se desvanecen en su sitio y las demás
   se deslizan a su nuevo lugar. */
.mesa-enter-from,
.mesa-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
.mesa-enter-active {
  transition:
    opacity 200ms ease-out,
    transform 200ms ease-out;
}
.mesa-leave-active {
  position: absolute;
  transition:
    opacity 150ms ease-in,
    transform 150ms ease-in;
}
.mesa-move {
  transition: transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* La vista rápida entra deslizándose desde la derecha y, al cerrarse, se desvanece en su sitio
   (ver fijarPanelAlSalir) mientras el mapa se ensancha. */
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
  .mesa-aparece-desde,
  .mesa-enter-from,
  .mesa-leave-to,
  .panel-enter-from {
    transform: none;
  }
  .mesa-aparece-activa {
    transition-delay: 0ms;
  }
  .mesa-move {
    transition: none;
  }
}
</style>
