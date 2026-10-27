<!--
  Caja: abrir el turno, ver lo vendido, cobrar los pedidos, dividir y anular cuentas, y
  cerrar con arqueo.
  - Tablet horizontal y PC: pedidos por cobrar a la izquierda y el elegido a la derecha.
  - Celular: la lista y el detalle en un panel desde abajo.
  Atajos en PC: N venta de mostrador, C cobrar el pedido elegido.
-->
<script setup>
definePageMeta({ seccion: 'caja' });

const caja = useCajaStore();
const pedidos = usePedidosStore();
const pantallaGrande = useMediaQuery('(min-width: 1024px)');

caja.cargarTurno();
pedidos.cargarActivos();

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
function alCobrar() {
  seleccionadoId.value = '';
  caja.cargarTurno();
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
  c: cobrar,
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
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-muted">
          Turno abierto {{ fechaRelativa(caja.turno.abiertoEn) }} · base de
          {{ formatearPesos(caja.turno.montoInicial) }}
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton to="/mostrador" icon="i-lucide-shopping-bag" variant="soft" size="lg">
            Venta de mostrador
            <UKbd value="N" class="ms-1 hidden lg:inline-flex" />
          </UButton>
          <UButton
            icon="i-lucide-lock"
            color="neutral"
            variant="outline"
            size="lg"
            label="Cerrar caja"
            @click="abrirCierre"
          />
        </div>
      </div>

      <ResumenTurno :resumen="caja.turno.resumen" />

      <div class="grid gap-5 lg:grid-cols-5">
        <PedidosDeCaja
          class="lg:col-span-2"
          :pedidos="pedidos.lista"
          :seleccionado="seleccionadoId"
          @seleccionar="seleccionar"
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
            <UEmpty
              v-else
              variant="naked"
              icon="i-lucide-mouse-pointer-click"
              title="Elige un pedido"
              description="Toca un pedido de la lista para ver su cuenta y cobrarlo."
            />
          </div>
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
  </div>
</template>
