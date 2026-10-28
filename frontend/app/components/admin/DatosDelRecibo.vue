<!--
  Datos del negocio que aparecen en el recibo de venta: dirección, teléfono y un mensaje al
  pie. El nombre y el NIT vienen del registro del negocio.
-->
<script setup>
import { z } from 'zod';

const props = defineProps({
  /** Negocio de GET /negocios/actual. */
  negocio: { type: /** @type {import('vue').PropType<any>} */ (Object), required: true },
});
const emit = defineEmits({
  /** @param {any} _negocio */
  guardado: (_negocio) => true,
});

const toast = useToast();

const esquema = z.object({
  direccion: z.string().trim().max(200, 'Máximo 200 caracteres'),
  telefono: z.union([
    z.literal(''),
    z
      .string()
      .trim()
      .regex(/^\+?[0-9 ]{7,20}$/, 'Escribe un teléfono válido'),
  ]),
  pieRecibo: z.string().trim().max(200, 'Máximo 200 caracteres'),
});
const datos = reactive({
  direccion: props.negocio.direccion ?? '',
  telefono: props.negocio.telefono ?? '',
  pieRecibo: props.negocio.pieRecibo ?? '',
});

async function guardar() {
  try {
    // Los campos vacíos se borran.
    const negocio = await useApi().patch('/negocios/actual', {
      direccion: datos.direccion.trim() || null,
      telefono: datos.telefono.trim() || null,
      pieRecibo: datos.pieRecibo.trim() || null,
    });
    toast.add({
      title: 'Datos del recibo guardados',
      icon: 'i-lucide-circle-check',
      color: 'success',
    });
    emit('guardado', negocio);
  } catch (fallo) {
    toast.add({
      title: fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO,
      icon: 'i-lucide-circle-alert',
      color: 'error',
    });
  }
}
</script>

<template>
  <section class="space-y-4 rounded-xl bg-default p-5 ring-1 ring-default">
    <div>
      <h2 class="text-lg font-semibold text-highlighted">Datos del recibo</h2>
      <p class="text-sm text-muted">Aparecen en el recibo de venta, debajo del nombre y el NIT.</p>
    </div>
    <UForm :schema="esquema" :state="datos" class="space-y-4" @submit="guardar">
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Dirección" name="direccion" hint="Opcional">
          <UInput
            v-model="datos.direccion"
            size="lg"
            class="w-full"
            placeholder="Carrera 2 # 98-22"
          />
        </UFormField>
        <UFormField label="Teléfono" name="telefono" hint="Opcional">
          <UInput v-model="datos.telefono" type="tel" inputmode="tel" size="lg" class="w-full" />
        </UFormField>
      </div>
      <UFormField label="Mensaje al pie" name="pieRecibo" hint="Opcional">
        <UInput
          v-model="datos.pieRecibo"
          size="lg"
          class="w-full"
          placeholder="¡Gracias por tu compra!"
        />
      </UFormField>
      <div class="flex justify-end">
        <UButton type="submit" size="lg" icon="i-lucide-check" label="Guardar" loading-auto />
      </div>
    </UForm>
  </section>
</template>
