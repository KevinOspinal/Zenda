<!--
  Configuración del negocio (solo el dueño): sus datos, la propina sugerida en mesa, de 0 a
  10 % (Ley 1935 de 2018) con una vista previa, y el valor del domicilio por defecto. Cada
  cambio queda en la auditoría.
  Los datos del negocio se ven pero no se editan aquí: el backend solo permite cambiar la
  propina sugerida y el valor del domicilio.
-->
<script setup>
definePageMeta({ seccion: 'configuracion' });

const toast = useToast();

const negocio = ref(/** @type {any} */ (null));
const cargando = ref(true);
const error = ref('');
const propina = ref(10);
const guardando = ref(false);
/** Valor del domicilio por defecto, como lo escribe CampoDinero ("3000"). */
const valorDomicilio = ref('');

async function cargar() {
  error.value = '';
  try {
    negocio.value = await useApi().get('/negocios/actual');
    propina.value = Number(negocio.value.propinaSugerida);
    // Si el API no lo trae, el campo queda vacío y el resto de la configuración sigue igual.
    valorDomicilio.value = negocio.value.valorDomicilio
      ? montoComoTexto(negocio.value.valorDomicilio)
      : '';
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  } finally {
    cargando.value = false;
  }
}
cargar();

/** Base de ejemplo para la vista previa (valor de la cuenta antes de impuestos). */
const BASE_DE_EJEMPLO = '50000';
const ejemplo = computed(() =>
  aDecimal(BASE_DE_EJEMPLO).times(propina.value).dividedBy(100).floor(),
);
const cambio = computed(
  () => negocio.value && Number(negocio.value.propinaSugerida) !== propina.value,
);

const cambioDomicilio = computed(
  () =>
    negocio.value &&
    esMontoValido(valorDomicilio.value) &&
    !aDecimal(negocio.value.valorDomicilio ?? 0).equals(valorDomicilio.value),
);

async function guardarDomicilio() {
  try {
    negocio.value = await useApi().patch('/negocios/actual', {
      valorDomicilio: valorDomicilio.value,
    });
    toast.add({
      title: 'Valor del domicilio actualizado',
      description: `Los domicilios nuevos proponen ${formatearPesos(valorDomicilio.value)}.`,
      icon: 'i-lucide-circle-check',
      color: 'success',
    });
  } catch (fallo) {
    toast.add({
      title: fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO,
      icon: 'i-lucide-circle-alert',
      color: 'error',
    });
  }
}

async function guardar() {
  guardando.value = true;
  try {
    negocio.value = await useApi().patch('/negocios/actual', { propinaSugerida: propina.value });
    toast.add({
      title: 'Propina sugerida actualizada',
      description: `Ahora se sugiere el ${formatearPorcentaje(propina.value)}.`,
      icon: 'i-lucide-circle-check',
      color: 'success',
    });
  } catch (fallo) {
    toast.add({
      title: fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO,
      icon: 'i-lucide-circle-alert',
      color: 'error',
    });
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6">
    <div v-if="cargando" class="space-y-3">
      <USkeleton class="h-40 rounded-xl" />
      <USkeleton class="h-48 rounded-xl" />
    </div>
    <UEmpty
      v-else-if="error"
      icon="i-lucide-wifi-off"
      title="No pudimos cargar la configuración"
      :description="error"
      :actions="[{ label: 'Reintentar', icon: 'i-lucide-rotate-cw', onClick: cargar }]"
    />

    <template v-else-if="negocio">
      <section class="space-y-3 rounded-xl bg-default p-5 ring-1 ring-default">
        <h2 class="text-lg font-semibold text-highlighted">Datos del negocio</h2>
        <dl class="grid gap-3 sm:grid-cols-2">
          <div>
            <dt class="text-sm text-muted">Nombre</dt>
            <dd class="font-medium text-highlighted">{{ negocio.nombre }}</dd>
          </div>
          <div>
            <dt class="text-sm text-muted">NIT</dt>
            <dd class="font-medium text-highlighted">{{ negocio.nit }}</dd>
          </div>
          <div>
            <dt class="text-sm text-muted">Ciudad</dt>
            <dd class="font-medium text-highlighted">{{ negocio.ciudad || '—' }}</dd>
          </div>
          <div>
            <dt class="text-sm text-muted">Impuesto</dt>
            <dd class="font-medium text-highlighted">
              {{ NOMBRES_REGIMEN[negocio.regimenImpuesto] }}
            </dd>
          </div>
        </dl>
      </section>

      <section class="space-y-5 rounded-xl bg-default p-5 ring-1 ring-default">
        <div>
          <h2 class="text-lg font-semibold text-highlighted">Propina sugerida</h2>
          <p class="text-sm text-muted">
            La que se le sugiere al cliente al cobrar en mesa. Por ley no puede pasar del 10 % y
            siempre es voluntaria. En 0 % no se sugiere.
          </p>
        </div>
        <div class="flex items-center gap-4">
          <USlider
            v-model="propina"
            :min="0"
            :max="10"
            :step="0.5"
            class="flex-1"
            aria-label="Propina sugerida"
          />
          <span class="cifra w-20 text-right text-3xl font-bold text-highlighted">{{
            formatearPorcentaje(propina)
          }}</span>
        </div>
        <p class="cifra rounded-xl bg-primary/10 px-4 py-3 text-sm text-default">
          <template v-if="propina > 0">
            En una cuenta de {{ formatearPesos(BASE_DE_EJEMPLO) }} antes de impuestos se sugieren
            <span class="font-bold">{{ formatearPesos(ejemplo) }}</span
            >.
          </template>
          <template v-else
            >No se sugerirá propina; el cliente igual puede darla si quiere.</template
          >
        </p>
        <div class="flex justify-end">
          <UButton
            size="lg"
            icon="i-lucide-check"
            label="Guardar"
            :loading="guardando"
            :disabled="!cambio"
            @click="guardar"
          />
        </div>
      </section>

      <section class="space-y-4 rounded-xl bg-default p-5 ring-1 ring-default">
        <div>
          <h2 class="text-lg font-semibold text-highlighted">Valor del domicilio</h2>
          <p class="text-sm text-muted">
            El que se propone en cada domicilio nuevo. En cada pedido se puede cambiar, por ejemplo
            si es lejos. Se suma al total de la cuenta.
          </p>
        </div>
        <CampoDinero v-model="valorDomicilio" etiqueta="Valor del domicilio por defecto" />
        <div class="flex justify-end">
          <UButton
            size="lg"
            icon="i-lucide-check"
            label="Guardar"
            loading-auto
            :disabled="!cambioDomicilio"
            @click="guardarDomicilio"
          />
        </div>
      </section>
    </template>
  </div>
</template>
