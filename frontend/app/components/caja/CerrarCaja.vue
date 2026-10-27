<!--
  Cerrar la caja con arqueo: se cuenta el efectivo (por billetes y monedas, o escribiendo
  el total), se compara en vivo con lo que debería haber y se cierra el turno. Si quedan
  pedidos sin cobrar, no se puede cerrar (regla del backend). Al terminar muestra el
  resultado: cuadra, sobra o falta.
-->
<script setup>
const props = defineProps({
  /** Turno abierto con su resumen (GET /caja/actual). */
  turno: { type: /** @type {import('vue').PropType<any>} */ (Object), default: null },
});

const abierto = defineModel('abierto', { type: Boolean, default: false });
const emit = defineEmits({ cerrada: () => true });

const caja = useCajaStore();
const pantallaGrande = useMediaQuery('(min-width: 1024px)');

const modo = ref(/** @type {'contar' | 'escribir'} */ ('contar'));
const conteo = ref(/** @type {Record<number, number>} */ ({}));
const totalEscrito = ref('');
const cerrando = ref(false);
const error = ref('');
const cierre = ref(/** @type {any} */ (null));

watch(
  abierto,
  (estaAbierto) => {
    if (!estaAbierto) return;
    conteo.value = {};
    totalEscrito.value = '';
    error.value = '';
    cierre.value = null;
  },
  { immediate: true },
);

const resumen = computed(() => props.turno?.resumen ?? null);
const pendientes = computed(() => resumen.value?.pedidos.abiertos ?? 0);

/** Efectivo contado: por denominaciones o el total escrito. Null si aún no hay un valor. */
const contado = computed(() => {
  if (modo.value === 'escribir') {
    return totalEscrito.value && esMontoValido(totalEscrito.value)
      ? aDecimal(totalEscrito.value)
      : null;
  }
  return totalDelConteo(conteo.value);
});
const arqueo = computed(() =>
  contado.value && resumen.value
    ? aparienciaDeArqueo(contado.value.minus(resumen.value.efectivoEsperado))
    : null,
);

async function cerrar() {
  if (!contado.value) return;
  cerrando.value = true;
  error.value = '';
  try {
    cierre.value = await caja.cerrar(montoComoTexto(contado.value));
    emit('cerrada');
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  } finally {
    cerrando.value = false;
  }
}

const resultado = computed(() =>
  cierre.value ? aparienciaDeArqueo(cierre.value.arqueo.diferencia) : null,
);
</script>

<template>
  <UModal
    v-model:open="abierto"
    :title="cierre ? 'Caja cerrada' : 'Cerrar la caja'"
    :fullscreen="!pantallaGrande"
    :dismissible="!cerrando"
    :ui="{ content: 'lg:max-w-3xl' }"
  >
    <template #body>
      <!-- Resultado del arqueo. -->
      <div v-if="cierre && resultado" class="space-y-5 py-2 text-center">
        <div
          class="mx-auto grid size-20 place-items-center rounded-full"
          :class="
            resultado.tipo === 'cuadra'
              ? 'bg-success/15'
              : resultado.tipo === 'sobrante'
                ? 'bg-info/15'
                : 'bg-error/15'
          "
        >
          <UIcon
            :name="resultado.tipo === 'cuadra' ? 'i-lucide-party-popper' : 'i-lucide-scale'"
            class="size-11 motion-safe:animate-bounce"
            :class="
              resultado.tipo === 'cuadra'
                ? 'text-success'
                : resultado.tipo === 'sobrante'
                  ? 'text-info'
                  : 'text-error'
            "
          />
        </div>
        <ChipEstado :apariencia="resultado" tamano="lg" variante="soft" class="text-xl" />
        <div class="mx-auto grid max-w-md grid-cols-2 gap-3 text-left">
          <div class="rounded-xl bg-elevated/60 p-3">
            <p class="text-sm text-muted">Esperado</p>
            <p class="cifra font-bold">{{ formatearPesos(cierre.arqueo.efectivoEsperado) }}</p>
          </div>
          <div class="rounded-xl bg-elevated/60 p-3">
            <p class="text-sm text-muted">Contado</p>
            <p class="cifra font-bold">{{ formatearPesos(cierre.arqueo.montoContado) }}</p>
          </div>
          <div class="rounded-xl bg-elevated/60 p-3">
            <p class="text-sm text-muted">Vendido</p>
            <p class="cifra font-bold">{{ formatearPesos(cierre.resumen.totalVendido) }}</p>
          </div>
          <div class="rounded-xl bg-elevated/60 p-3">
            <p class="text-sm text-muted">Propinas</p>
            <p class="cifra font-bold">{{ formatearPesos(cierre.resumen.propinas) }}</p>
          </div>
        </div>
      </div>

      <!-- No se puede cerrar con pedidos sin cobrar. -->
      <UAlert
        v-else-if="pendientes > 0"
        color="warning"
        variant="subtle"
        icon="i-lucide-receipt"
        :title="`Hay ${pendientes} ${pendientes === 1 ? 'pedido' : 'pedidos'} sin cobrar`"
        description="Cóbralos o anúlalos antes de cerrar la caja."
      />

      <!-- Contar el efectivo. -->
      <div v-else-if="resumen" class="space-y-5">
        <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Forma de contar">
          <UButton
            v-for="opcion in [
              {
                valor: 'contar',
                etiqueta: 'Contar billetes y monedas',
                icono: 'i-lucide-banknote',
              },
              { valor: 'escribir', etiqueta: 'Escribir el total', icono: 'i-lucide-pencil' },
            ]"
            :key="opcion.valor"
            :label="opcion.etiqueta"
            :icon="opcion.icono"
            size="lg"
            block
            role="radio"
            :aria-checked="modo === opcion.valor"
            :color="modo === opcion.valor ? 'primary' : 'neutral'"
            :variant="modo === opcion.valor ? 'soft' : 'outline'"
            @click="modo = /** @type {any} */ (opcion.valor)"
          />
        </div>

        <ConteoEfectivo v-if="modo === 'contar'" v-model="conteo" />
        <CampoDinero v-else v-model="totalEscrito" etiqueta="Efectivo contado" autofocus />

        <!-- Comparación en vivo. -->
        <div
          class="grid gap-3 rounded-2xl bg-elevated/60 p-4 ring-1 ring-default sm:grid-cols-3"
          aria-live="polite"
        >
          <div>
            <p class="text-sm text-muted">Debería haber</p>
            <p class="cifra text-xl font-bold text-highlighted">
              {{ formatearPesos(resumen.efectivoEsperado) }}
            </p>
          </div>
          <div>
            <p class="text-sm text-muted">Contado</p>
            <p class="cifra text-xl font-bold text-highlighted">
              {{ contado ? formatearPesos(contado) : '—' }}
            </p>
          </div>
          <div class="flex items-center sm:justify-end">
            <ChipEstado v-if="arqueo" :apariencia="arqueo" tamano="lg" variante="soft" />
          </div>
        </div>

        <ul class="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <li
            v-for="(monto, metodo) in resumen.ventasPorMetodo"
            :key="metodo"
            class="rounded-lg bg-default p-2 ring-1 ring-default"
          >
            <span class="flex items-center gap-1 text-muted">
              <UIcon :name="METODOS_PAGO[metodo].icono" class="size-4" />
              {{ METODOS_PAGO[metodo].etiqueta }}
            </span>
            <span class="cifra font-semibold text-highlighted">{{ formatearPesos(monto) }}</span>
          </li>
        </ul>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="error"
          role="alert"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton v-if="cierre" size="xl" block label="Listo" @click="abierto = false" />
        <template v-else>
          <UButton
            color="neutral"
            variant="ghost"
            size="lg"
            label="Volver"
            :disabled="cerrando"
            @click="abierto = false"
          />
          <UButton
            v-if="pendientes === 0"
            size="lg"
            icon="i-lucide-lock"
            label="Cerrar caja"
            :loading="cerrando"
            :disabled="!contado"
            @click="cerrar"
          />
        </template>
      </div>
    </template>
  </UModal>
</template>
