<!--
  Historial de turnos de caja: cuándo se abrió y cerró cada uno, quién, con qué base y cuánto
  se contó. Al tocar uno se ve su resumen y el resultado del arqueo.
-->
<script setup>
definePageMeta({ seccion: 'turnos' });

const pantallaGrande = useMediaQuery('(min-width: 1024px)');

const turnos = ref(/** @type {any[]} */ ([]));
const cargando = ref(true);
const error = ref('');
async function cargar() {
  error.value = '';
  try {
    turnos.value = await useApi().get('/caja/turnos');
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  } finally {
    cargando.value = false;
  }
}
cargar();

// Detalle de un turno con su resumen y arqueo.
const detalleAbierto = ref(false);
const detalle = ref(/** @type {any} */ (null));
const cargandoDetalle = ref(false);
/** @param {any} turno */
async function verTurno(turno) {
  detalleAbierto.value = true;
  cargandoDetalle.value = true;
  detalle.value = null;
  try {
    detalle.value = await useApi().get(`/caja/turnos/${turno.id}`);
  } finally {
    cargandoDetalle.value = false;
  }
}
</script>

<template>
  <div class="space-y-5">
    <div v-if="cargando" class="space-y-2">
      <USkeleton v-for="n in 5" :key="n" class="h-16 rounded-xl" />
    </div>
    <UEmpty
      v-else-if="error"
      icon="i-lucide-wifi-off"
      title="No pudimos cargar los turnos"
      :description="error"
      :actions="[{ label: 'Reintentar', icon: 'i-lucide-rotate-cw', onClick: cargar }]"
    />
    <UEmpty
      v-else-if="!turnos.length"
      icon="i-lucide-history"
      title="Aún no hay turnos"
      description="Cada vez que se abre y se cierra la caja queda un turno aquí."
    />

    <ul v-else class="space-y-2">
      <li v-for="turno in turnos" :key="turno.id">
        <button
          type="button"
          class="flex w-full flex-wrap items-center gap-3 rounded-xl bg-default p-4 text-left ring-1 ring-default transition hover:ring-accented active:scale-[0.99]"
          @click="verTurno(turno)"
        >
          <span class="grid size-10 place-items-center rounded-lg bg-elevated">
            <UIcon
              :name="turno.cerradoEn ? 'i-lucide-lock' : 'i-lucide-lock-open'"
              class="size-5 text-toned"
            />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block font-semibold text-highlighted">{{
              fechaRelativa(turno.abiertoEn)
            }}</span>
            <span class="block text-sm text-muted">
              Abrió {{ turno.abiertoPor?.nombre }}
              <template v-if="turno.cerradoEn"
                >· cerró {{ turno.cerradoPor?.nombre }}
                {{ fechaRelativa(turno.cerradoEn) }}</template
              >
            </span>
          </span>
          <UBadge
            v-if="!turno.cerradoEn"
            color="success"
            variant="subtle"
            icon="i-lucide-lock-open"
            label="Abierto"
          />
          <span v-else class="cifra text-sm text-muted"
            >Contado {{ formatearPesos(turno.montoContado) }}</span
          >
        </button>
      </li>
    </ul>

    <USlideover
      v-model:open="detalleAbierto"
      :side="pantallaGrande ? 'right' : 'bottom'"
      title="Turno de caja"
    >
      <template #body>
        <div v-if="cargandoDetalle" class="space-y-2">
          <USkeleton v-for="n in 4" :key="n" class="h-14 rounded-lg" />
        </div>
        <div v-else-if="detalle" class="space-y-5">
          <ChipEstado
            v-if="detalle.arqueo"
            :apariencia="aparienciaDeArqueo(detalle.arqueo.diferencia)"
            tamano="lg"
            variante="soft"
          />
          <UBadge
            v-else
            color="success"
            variant="subtle"
            size="lg"
            icon="i-lucide-lock-open"
            label="Turno abierto"
          />
          <dl class="cifra grid grid-cols-2 gap-3">
            <div class="rounded-xl bg-elevated/60 p-3">
              <dt class="text-sm text-muted">Base</dt>
              <dd class="font-bold">{{ formatearPesos(detalle.montoInicial) }}</dd>
            </div>
            <div class="rounded-xl bg-elevated/60 p-3">
              <dt class="text-sm text-muted">Vendido</dt>
              <dd class="font-bold">{{ formatearPesos(detalle.resumen.totalVendido) }}</dd>
            </div>
            <div class="rounded-xl bg-elevated/60 p-3">
              <dt class="text-sm text-muted">Propinas</dt>
              <dd class="font-bold">{{ formatearPesos(detalle.resumen.propinas) }}</dd>
            </div>
            <div class="rounded-xl bg-elevated/60 p-3">
              <dt class="text-sm text-muted">Efectivo esperado</dt>
              <dd class="font-bold">{{ formatearPesos(detalle.resumen.efectivoEsperado) }}</dd>
            </div>
            <div v-if="detalle.arqueo" class="rounded-xl bg-elevated/60 p-3">
              <dt class="text-sm text-muted">Contado</dt>
              <dd class="font-bold">{{ formatearPesos(detalle.arqueo.montoContado) }}</dd>
            </div>
            <div class="rounded-xl bg-elevated/60 p-3">
              <dt class="text-sm text-muted">Pedidos</dt>
              <dd class="font-bold">
                {{ detalle.resumen.pedidos.pagados }} pagados ·
                {{ detalle.resumen.pedidos.anulados }} anulados
              </dd>
            </div>
          </dl>
          <ul class="space-y-2">
            <li
              v-for="(monto, metodo) in detalle.resumen.ventasPorMetodo"
              :key="metodo"
              class="flex items-center justify-between"
            >
              <span class="flex items-center gap-2 text-toned"
                ><UIcon :name="METODOS_PAGO[metodo].icono" class="size-4" />{{
                  METODOS_PAGO[metodo].etiqueta
                }}</span
              >
              <span class="cifra font-semibold">{{ formatearPesos(monto) }}</span>
            </li>
          </ul>
        </div>
      </template>
    </USlideover>
  </div>
</template>
