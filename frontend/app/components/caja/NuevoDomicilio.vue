<!--
  Registrar un domicilio que llegó por WhatsApp o por teléfono: a nombre de quién, a dónde se
  lleva, con cuánto paga y el valor del domicilio (el del negocio, que se cambia si es lejos).
  Al guardarlo se pasa a tomar los productos del pedido.
  Solo se piden los datos necesarios para entregar (Ley 1581 de 2012).
-->
<script setup>
import { z } from 'zod';

const abierto = defineModel('abierto', { type: Boolean, default: false });

const domicilios = useDomiciliosStore();
const toast = useToast();

/** Por dónde llegó: un domicilio no se pide en el local. */
const ORIGENES = Object.freeze(
  /** @type {const} */ (['whatsapp', 'telefono', 'otro']).map((origen) => ({
    value: origen,
    label: ORIGENES_PEDIDO[origen].etiqueta,
    icon: ORIGENES_PEDIDO[origen].icono,
  })),
);

const esquema = z.object({
  nombreCliente: z.string().trim().min(1, 'Escribe el nombre del cliente').max(80),
  telefono: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{7,20}$/, 'Escribe un teléfono válido'),
  direccion: z.string().trim().min(1, 'Escribe la dirección').max(200),
  indicaciones: z.string().trim().max(300, 'Máximo 300 caracteres'),
  origen: z.enum(['whatsapp', 'telefono', 'otro']),
  valorDomicilio: z.string().refine((valor) => !valor || esMontoValido(valor), 'Valor inválido'),
  pagaCon: z.string().refine((valor) => !valor || esMontoValido(valor), 'Valor inválido'),
});

const VACIO = Object.freeze({
  nombreCliente: '',
  telefono: '',
  direccion: '',
  indicaciones: '',
  origen: 'whatsapp',
  valorDomicilio: '',
  pagaCon: '',
});
const datos = reactive({ ...VACIO });
const error = ref('');

// Al abrir, el formulario empieza limpio con el valor del domicilio del negocio.
watch(
  abierto,
  async (estaAbierto) => {
    if (!estaAbierto) return;
    Object.assign(datos, VACIO);
    error.value = '';
    try {
      const negocio = await useApi().get('/negocios/actual');
      if (!datos.valorDomicilio) datos.valorDomicilio = montoComoTexto(negocio.valorDomicilio);
    } catch {
      // Sin el valor del negocio: si se deja vacío, el backend usa el del negocio.
    }
  },
  { immediate: true },
);

async function guardar() {
  error.value = '';
  try {
    const pedido = await domicilios.crear({
      nombreCliente: datos.nombreCliente.trim(),
      origen: datos.origen,
      ...(datos.valorDomicilio ? { valorDomicilio: datos.valorDomicilio } : {}),
      entrega: {
        telefono: datos.telefono.trim(),
        direccion: datos.direccion.trim(),
        ...(datos.indicaciones.trim() ? { indicaciones: datos.indicaciones.trim() } : {}),
        ...(datos.pagaCon ? { pagaCon: datos.pagaCon } : {}),
      },
    });
    abierto.value = false;
    toast.add({
      title: `Domicilio ${nombreDelPedido(pedido)} registrado`,
      description: 'Ahora agrega los productos del pedido.',
      icon: 'i-lucide-bike',
      color: 'success',
    });
    await navigateTo(`/pedidos/${pedido.id}`);
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  }
}
</script>

<template>
  <UModal
    v-model:open="abierto"
    title="Nuevo domicilio"
    description="Los datos para llevarlo. Después agregas los productos."
  >
    <template #body>
      <UForm :schema="esquema" :state="datos" class="space-y-4" @submit="guardar">
        <UFormField label="¿Por dónde llegó?" name="origen">
          <URadioGroup
            v-model="datos.origen"
            :items="ORIGENES"
            orientation="horizontal"
            variant="card"
          />
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Nombre del cliente" name="nombreCliente">
            <UInput v-model="datos.nombreCliente" size="lg" class="w-full" autofocus />
          </UFormField>
          <UFormField label="Teléfono" name="telefono">
            <UInput
              v-model="datos.telefono"
              type="tel"
              inputmode="tel"
              size="lg"
              class="w-full"
              autocomplete="off"
            />
          </UFormField>
        </div>
        <UFormField label="Dirección" name="direccion">
          <UInput
            v-model="datos.direccion"
            size="lg"
            class="w-full"
            placeholder="Calle 10 # 5-20, barrio San Antonio"
          />
        </UFormField>
        <UFormField label="Indicaciones" name="indicaciones" hint="Opcional">
          <UTextarea
            v-model="datos.indicaciones"
            :rows="2"
            class="w-full"
            placeholder="Apto 302, timbre dañado"
          />
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="Valor del domicilio"
            name="valorDomicilio"
            help="Cámbialo si es lejos."
          >
            <CampoDinero v-model="datos.valorDomicilio" etiqueta="Valor del domicilio" />
          </UFormField>
          <UFormField
            label="¿Con cuánto paga?"
            name="pagaCon"
            hint="Opcional"
            help="Para que el domiciliario lleve el cambio."
          >
            <CampoDinero v-model="datos.pagaCon" etiqueta="Con cuánto paga" />
          </UFormField>
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="error"
          role="alert"
        />

        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            size="lg"
            label="Cancelar"
            @click="abierto = false"
          />
          <UButton
            type="submit"
            size="lg"
            loading-auto
            icon="i-lucide-arrow-right"
            trailing
            label="Registrar y agregar productos"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
