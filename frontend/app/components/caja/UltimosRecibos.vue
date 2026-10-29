<!--
  Últimos recibos de venta, para reimprimir uno rápido desde la caja (por ejemplo, si la
  impresora falló o el cliente lo pide de nuevo). Se busca uno viejo por su número.
  La reimpresión sale marcada como COPIA (ver useImpresionDeRecibo).
-->
<script setup>
const abierto = defineModel('abierto', { type: Boolean, default: false });

const recibos = useRecibosStore();
const toast = useToast();
const { imprimir } = useImpresionDeRecibo();

/** Lo que se escribe en el buscador: solo cuentan los dígitos ("000007" busca el 7). */
const busqueda = ref('');
const numeroBuscado = computed(() => Number(busqueda.value.replace(/\D/g, '')) || null);

// Al abrir, siempre se ven los últimos recibos.
watch(
  abierto,
  (estaAbierto) => {
    if (!estaAbierto) return;
    busqueda.value = '';
    recibos.cargar();
  },
  { immediate: true },
);

// Se busca cuando se deja de escribir, sin repetir la consulta que ya se hizo.
watchDebounced(
  numeroBuscado,
  (numero) => {
    if (abierto.value && numero !== recibos.numeroBuscado) recibos.cargar(numero);
  },
  { debounce: 350 },
);

/** @param {any} recibo */
const metodosDePago = (recibo) =>
  [...new Set(recibo.pedido.pagos.map((/** @type {any} */ pago) => pago.metodo))]
    .map((metodo) => METODOS_PAGO[/** @type {keyof typeof METODOS_PAGO} */ (metodo)].etiqueta)
    .join(' + ');

/** Id del recibo que se está preparando para imprimir. */
const imprimiendo = ref('');

/** @param {any} recibo */
async function reimprimir(recibo) {
  imprimiendo.value = recibo.id;
  try {
    const pedido = await recibos.traerPedido(recibo.pedidoId);
    await imprimir(pedido, { copia: true });
  } catch (error) {
    toast.add({
      title: error instanceof ErrorApi ? error.message : MENSAJE_ERROR_GENERICO,
      description: 'No se pudo preparar el recibo. Inténtalo de nuevo.',
      icon: 'i-lucide-circle-alert',
      color: 'error',
    });
  } finally {
    imprimiendo.value = '';
  }
}
</script>

<template>
  <USlideover
    v-model:open="abierto"
    title="Últimos recibos"
    description="Reimprime un recibo: sale marcado como copia."
  >
    <template #body>
      <div class="space-y-4">
        <UInput
          v-model="busqueda"
          icon="i-lucide-search"
          size="lg"
          class="w-full"
          inputmode="numeric"
          maxlength="10"
          placeholder="Buscar por número de recibo"
          aria-label="Buscar por número de recibo"
        />

        <div v-if="recibos.estadoCarga === 'cargando'" class="space-y-2">
          <USkeleton v-for="n in 4" :key="n" class="h-20 rounded-xl" />
        </div>

        <UEmpty
          v-else-if="recibos.estadoCarga === 'error'"
          icon="i-lucide-wifi-off"
          title="No pudimos cargar los recibos"
          description="Revisa la conexión e inténtalo de nuevo."
          :actions="[
            {
              label: 'Reintentar',
              icon: 'i-lucide-rotate-cw',
              onClick: () => recibos.cargar(numeroBuscado),
            },
          ]"
        />

        <UEmpty
          v-else-if="!recibos.lista.length && recibos.numeroBuscado"
          variant="naked"
          icon="i-lucide-search-x"
          :title="`No encontramos el recibo No. ${numeroDeRecibo(recibos.numeroBuscado)}`"
          description="Revisa el número e inténtalo de nuevo."
        />

        <UEmpty
          v-else-if="!recibos.lista.length"
          variant="naked"
          icon="i-lucide-receipt"
          title="Aún no hay recibos"
          description="Cada venta cobrada genera su recibo y aparece aquí."
        />

        <ul v-else class="space-y-2" aria-label="Recibos de venta">
          <li
            v-for="recibo in recibos.lista"
            :key="recibo.id"
            class="flex items-center gap-3 rounded-xl bg-default p-3 ring-1 ring-default"
          >
            <div class="min-w-0 flex-1">
              <p class="flex items-baseline justify-between gap-2">
                <span class="cifra font-semibold text-highlighted">
                  No. {{ numeroDeRecibo(recibo.numero) }}
                </span>
                <span class="cifra font-bold text-highlighted">
                  {{ formatearPesos(recibo.pedido.total) }}
                </span>
              </p>
              <p class="truncate text-sm text-muted">
                {{ nombreDelPedido(recibo.pedido) }} · {{ fechaRelativa(recibo.emitidoEn) }}
              </p>
              <p class="text-xs text-muted">{{ metodosDePago(recibo) }}</p>
            </div>
            <UButton
              icon="i-lucide-printer"
              label="Reimprimir"
              size="lg"
              variant="soft"
              :loading="imprimiendo === recibo.id"
              :aria-label="`Reimprimir recibo No. ${numeroDeRecibo(recibo.numero)}`"
              @click="reimprimir(recibo)"
            />
          </li>
        </ul>
      </div>
    </template>
  </USlideover>
</template>
