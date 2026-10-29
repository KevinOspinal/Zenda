<!--
  Caja: abrir el turno, ver lo vendido, cobrar los pedidos, dividir y anular cuentas,
  registrar y despachar domicilios, reimprimir recibos y cerrar con arqueo.
  - Tablet horizontal y PC: pedidos por cobrar a la izquierda y el elegido a la derecha.
  - Celular: la lista y el detalle en un panel desde abajo.
  Atajos en PC: N venta de mostrador, D nuevo domicilio, C cobrar el pedido elegido,
  R últimos recibos (solo en negocios que entregan recibo de venta).
-->
<script setup>
definePageMeta({ seccion: 'caja' });

const caja = useCajaStore();
const pedidos = usePedidosStore();
const domicilios = useDomiciliosStore();
const sesion = useSesionStore();
const toast = useToast();
const pantallaGrande = useMediaQuery('(min-width: 1024px)');
const ahora = useNow({ interval: 60_000 });

caja.cargarTurno();
pedidos.cargarActivos();
domicilios.cargar();

const nuevoDomicilio = ref(false);

// Los negocios sin factura electrónica entregan recibo de venta y pueden reimprimirlo.
const entregaRecibos = computed(() => !facturaElectronica(sesion.negocio?.regimenImpuesto));
const verRecibos = ref(false);

// Pedido elegido. En pantallas grandes se elige el primero de una vez.
const seleccionadoId = ref('');
const seleccionado = computed(() => pedidos.porId[seleccionadoId.value] ?? null);
watchEffect(() => {
  if (pantallaGrande.value && !seleccionado.value && pedidos.lista.length) {
    seleccionadoId.value = pedidos.lista[0].id;
  }
});

const detalleAbierto = ref(false);
/** @param {string} id */
function seleccionar(id) {
  seleccionadoId.value = id;
  if (!pantallaGrande.value) detalleAbierto.value = true;
}

// Acciones sobre el pedido elegido.
const cobrando = ref(false);
const dividiendo = ref(false);
const anulando = ref(false);
function cobrar() {
  if (!seleccionado.value) return;
  detalleAbierto.value = false;
  cobrando.value = true;
}
/** Domicilio contra entrega que queda entregado apenas termine su cobro. */
const entregarAlCobrar = ref('');
/** @param {any} domicilio */
function cobrarYEntregar(domicilio) {
  seleccionadoId.value = domicilio.id;
  entregarAlCobrar.value = domicilio.id;
  cobrando.value = true;
}
watch(cobrando, (abierto) => {
  if (!abierto) entregarAlCobrar.value = '';
});

async function alCobrar() {
  const domicilioId = entregarAlCobrar.value;
  seleccionadoId.value = '';
  caja.cargarTurno();
  if (!domicilioId) return;
  try {
    await domicilios.entregar(domicilioId);
  } catch (fallo) {
    toast.add({
      title: fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO,
      description: 'Se cobró, pero no se pudo marcar como entregado. Inténtalo de nuevo.',
      icon: 'i-lucide-circle-alert',
      color: 'error',
    });
  }
}
/** Al dividir, queda elegida la cuenta nueva, lista para cobrar. */
const alDividir = (/** @type {{ nuevo: any }} */ { nuevo }) => (seleccionadoId.value = nuevo.id);

// Cerrar la caja: se usa una copia del turno, porque al cerrarse el turno deja de existir
// y el resumen del arqueo debe seguir visible.
const cerrando = ref(false);
const turnoParaCerrar = ref(/** @type {any} */ (null));
async function abrirCierre() {
  await caja.cargarTurno();
  turnoParaCerrar.value = caja.turno;
  cerrando.value = true;
}

defineShortcuts({
  n: () => navigateTo('/mostrador'),
  d: () => (nuevoDomicilio.value = true),
  c: cobrar,
  r: () => (verRecibos.value = entregaRecibos.value),
});
</script>

<template>
  <div class="space-y-5">
    <div
      v-if="caja.estadoTurno === 'cargando' || caja.estadoTurno === 'sin_cargar'"
      class="space-y-4"
    >
      <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <USkeleton v-for="n in 4" :key="n" class="h-20 rounded-xl" />
      </div>
      <USkeleton class="h-80 rounded-xl" />
    </div>

    <UEmpty
      v-else-if="caja.estadoTurno === 'error'"
      icon="i-lucide-wifi-off"
      title="No pudimos cargar la caja"
      :description="caja.errorTurno"
      :actions="[{ label: 'Reintentar', icon: 'i-lucide-rotate-cw', onClick: caja.cargarTurno }]"
    />

    <AbrirCaja v-else-if="!caja.turno" />

    <template v-else>
      <!-- Barra del turno: está abierto, desde cuándo y con qué base. Acciones secundarias. -->
      <div
        class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-default px-4 py-3 ring-1 ring-default"
      >
        <div class="flex min-w-0 items-center gap-3">
          <span class="relative flex size-3 shrink-0" aria-hidden="true">
            <span
              class="absolute inline-flex size-full rounded-full bg-primary opacity-60 motion-safe:animate-ping"
            />
            <span class="relative inline-flex size-3 rounded-full bg-primary" />
          </span>
          <p class="min-w-0 text-sm">
            <span class="font-semibold text-highlighted">Turno abierto</span>
            <span class="cifra text-muted">
              · desde {{ fechaRelativa(caja.turno.abiertoEn) }} ({{
                haceCuanto(caja.turno.abiertoEn, ahora)
              }}) · base {{ formatearPesos(caja.turno.montoInicial) }}
            </span>
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="entregaRecibos"
            icon="i-lucide-printer"
            color="neutral"
            variant="ghost"
            @click="verRecibos = true"
          >
            Últimos recibos
            <UKbd value="R" class="ms-1 hidden lg:inline-flex" />
          </UButton>
          <UButton
            icon="i-lucide-lock"
            color="neutral"
            variant="outline"
            label="Cerrar caja"
            @click="abrirCierre"
          />
        </div>
      </div>

      <!-- Lo que más hace la caja, en grande y fácil de tocar. -->
      <div class="grid grid-cols-2 gap-3">
        <NuxtLink
          to="/mostrador"
          class="group flex items-center gap-3 rounded-xl bg-primary p-3 text-inverted shadow-sm transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.99] motion-reduce:transition-none sm:p-4"
        >
          <span class="grid size-11 shrink-0 place-items-center rounded-lg bg-white/15">
            <UIcon name="i-lucide-shopping-bag" class="size-6" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold sm:text-lg">Venta de mostrador</span>
            <span class="hidden truncate text-sm opacity-85 sm:block">
              Toma el pedido y cobra al instante
            </span>
          </span>
          <UKbd value="N" color="neutral" class="hidden lg:inline-flex" />
        </NuxtLink>
        <button
          type="button"
          class="group flex items-center gap-3 rounded-xl bg-primary/10 p-3 text-left text-primary ring-1 ring-primary/25 transition hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.99] motion-reduce:transition-none sm:p-4"
          @click="nuevoDomicilio = true"
        >
          <span class="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10">
            <UIcon name="i-lucide-bike" class="size-6" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold sm:text-lg">Nuevo domicilio</span>
            <span class="hidden truncate text-sm text-muted sm:block">
              Pedido por WhatsApp o teléfono
            </span>
          </span>
          <UKbd value="D" class="hidden lg:inline-flex" />
        </button>
      </div>

      <ResumenTurno
        :resumen="caja.turno.resumen"
        :monto-inicial="caja.turno.montoInicial"
        :por-cobrar="pedidos.lista"
      />

      <DomiciliosEnCurso @cobrar-y-entregar="cobrarYEntregar" />

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <PedidosDeCaja
          class="lg:col-span-2"
          :pedidos="pedidos.lista"
          :seleccionado="seleccionadoId"
          @seleccionar="seleccionar"
          @nuevo-domicilio="nuevoDomicilio = true"
        />
        <div v-if="pantallaGrande" class="lg:col-span-3">
          <div class="sticky top-24 rounded-xl bg-default p-5 ring-1 ring-default">
            <DetallePedidoCaja
              v-if="seleccionado"
              :pedido="seleccionado"
              @cobrar="cobrar"
              @dividir="dividiendo = true"
              @anular="anulando = true"
            />
            <!-- Sin pedido elegido, el espacio se usa para ver cómo va el turno. -->
            <PanelDelTurno v-else :resumen="caja.turno.resumen" :con-recibos="entregaRecibos" />
          </div>
        </div>
        <!-- En celular y tablet vertical, cómo va el turno queda debajo de la lista. -->
        <div v-else class="rounded-xl bg-default p-4 ring-1 ring-default">
          <PanelDelTurno :resumen="caja.turno.resumen" :con-recibos="entregaRecibos" />
        </div>
      </div>

      <UDrawer v-if="!pantallaGrande" v-model:open="detalleAbierto" title="Cuenta">
        <template #body>
          <DetallePedidoCaja
            v-if="seleccionado"
            :pedido="seleccionado"
            @cobrar="cobrar"
            @dividir="((detalleAbierto = false), (dividiendo = true))"
            @anular="((detalleAbierto = false), (anulando = true))"
          />
        </template>
      </UDrawer>
    </template>

    <!-- Fuera de las condiciones: el resumen del cobro y del cierre deben seguir visibles. -->
    <ModalCobro v-model:abierto="cobrando" :pedido-id="seleccionadoId" @cobrado="alCobrar" />
    <ModalDividir v-model:abierto="dividiendo" :pedido="seleccionado" @dividido="alDividir" />
    <ModalAnular v-model:abierto="anulando" :pedido="seleccionado" @anulado="seleccionadoId = ''" />
    <CerrarCaja v-model:abierto="cerrando" :turno="turnoParaCerrar" />
    <NuevoDomicilio v-model:abierto="nuevoDomicilio" />
    <UltimosRecibos v-if="entregaRecibos" v-model:abierto="verRecibos" />
  </div>
</template>
