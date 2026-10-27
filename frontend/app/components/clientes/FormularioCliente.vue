<!--
  Formulario para registrar o editar un cliente (a cuyo nombre se factura). Solo se piden
  los datos necesarios para la factura (Ley 1581 de 2012). Las reglas copian las del backend.
-->
<script setup>
import { z } from 'zod';

const props = defineProps({
  /** Cliente a editar. Sin él, se registra uno nuevo. */
  cliente: {
    type: /** @type {import('vue').PropType<import('~/stores/clientes.js').Cliente | null>} */ (
      Object
    ),
    default: null,
  },
});

const emit = defineEmits({
  /** @param {import('~/stores/clientes.js').Cliente} _cliente */
  guardado: (_cliente) => true,
  cancelar: () => true,
});

const clientes = useClientesStore();

const esquema = z
  .object({
    tipoDocumento: z.enum(['cc', 'nit', 'ce', 'pasaporte', 'otro']),
    numeroDocumento: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{3,20}$/, 'Solo letras y números, sin puntos ni guiones'),
    nombre: z.string().trim().min(1, 'Escribe el nombre').max(120),
    email: z.union([
      z.literal(''),
      z.string().trim().toLowerCase().pipe(z.email('Correo inválido')),
    ]),
    telefono: z.union([
      z.literal(''),
      z
        .string()
        .trim()
        .regex(/^\+?[0-9 ]{7,20}$/, 'Teléfono inválido'),
    ]),
  })
  .refine(
    (datos) =>
      !['cc', 'ce', 'nit'].includes(datos.tipoDocumento) || /^\d+$/.test(datos.numeroDocumento),
    { path: ['numeroDocumento'], message: 'La cédula y el NIT solo llevan números' },
  );

const datos = reactive({
  tipoDocumento: props.cliente?.tipoDocumento ?? 'cc',
  numeroDocumento: props.cliente?.numeroDocumento ?? '',
  nombre: props.cliente?.nombre ?? '',
  email: props.cliente?.email ?? '',
  telefono: props.cliente?.telefono ?? '',
});
const error = ref('');

async function guardar() {
  error.value = '';
  // Los campos opcionales vacíos se envían como null (o se omiten al crear).
  const cuerpo = {
    tipoDocumento: datos.tipoDocumento,
    numeroDocumento: datos.numeroDocumento.trim(),
    nombre: datos.nombre.trim(),
    email: datos.email.trim() || null,
    telefono: datos.telefono.trim() || null,
  };
  try {
    const guardado = props.cliente
      ? await clientes.actualizar(props.cliente.id, cuerpo)
      : await clientes.crear(cuerpo);
    emit('guardado', guardado);
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  }
}
</script>

<template>
  <UForm :schema="esquema" :state="datos" class="space-y-4" @submit="guardar">
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField label="Tipo de documento" name="tipoDocumento">
        <USelect v-model="datos.tipoDocumento" :items="TIPOS_DOCUMENTO" size="lg" class="w-full" />
      </UFormField>
      <UFormField label="Número" name="numeroDocumento">
        <UInput v-model="datos.numeroDocumento" size="lg" class="w-full" autocomplete="off" />
      </UFormField>
    </div>
    <UFormField label="Nombre o razón social" name="nombre">
      <UInput v-model="datos.nombre" size="lg" class="w-full" />
    </UFormField>
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField label="Correo" name="email" hint="Para enviarle la factura">
        <UInput v-model="datos.email" type="email" size="lg" class="w-full" inputmode="email" />
      </UFormField>
      <UFormField label="Teléfono" name="telefono" hint="Opcional">
        <UInput v-model="datos.telefono" type="tel" size="lg" class="w-full" inputmode="tel" />
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
        @click="emit('cancelar')"
      />
      <UButton
        type="submit"
        size="lg"
        loading-auto
        icon="i-lucide-check"
        :label="cliente ? 'Guardar cambios' : 'Registrar cliente'"
      />
    </div>
  </UForm>
</template>
