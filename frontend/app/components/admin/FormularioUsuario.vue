<!--
  Crear un empleado (con su contraseña inicial) o editar uno: nombre, rol y si está activo.
  Solo el dueño puede hacerlo; los roles asignables son administrador, cajero, mesero y
  cocina (la cuenta compartida de la tableta de la cocina).
  Cambiar el rol o desactivar a alguien cierra sus sesiones (regla del backend).
-->
<script setup>
import { z } from 'zod';

const props = defineProps({
  /** Empleado a editar; sin él, se crea uno nuevo. */
  usuario: { type: /** @type {import('vue').PropType<any>} */ (Object), default: null },
});

const emit = defineEmits({ guardado: () => true, cancelar: () => true });

const ROLES_ASIGNABLES = Object.freeze([
  {
    value: 'administrador',
    label: 'Administrador',
    description: 'Menú, inventario, reportes y caja',
  },
  { value: 'cajero', label: 'Cajero', description: 'Cobrar, abrir y cerrar la caja' },
  { value: 'mesero', label: 'Mesero', description: 'Tomar pedidos y enviarlos a la cocina' },
  {
    value: 'cocina',
    label: 'Cocina',
    description: 'La tableta de la cocina: ve las comandas y marca los platos listos',
  },
]);

const contrasenaNueva = z
  .string()
  .min(8, 'Debe tener al menos 8 caracteres')
  .max(128)
  .regex(/[A-Za-zÁÉÍÓÚáéíóúÑñ]/, 'Debe tener al menos una letra')
  .regex(/\d/, 'Debe tener al menos un número');

const esquema = computed(() =>
  z.object({
    nombre: z.string().trim().min(1, 'Escribe el nombre').max(120),
    email: props.usuario
      ? z.string()
      : z.string().trim().toLowerCase().pipe(z.email('Escribe un correo válido')),
    rol: z.enum(['administrador', 'cajero', 'mesero', 'cocina']),
    contrasena: props.usuario ? z.string() : contrasenaNueva,
    activo: z.boolean(),
  }),
);

const datos = reactive({
  nombre: props.usuario?.nombre ?? '',
  email: props.usuario?.email ?? '',
  rol: props.usuario?.rol ?? 'mesero',
  contrasena: '',
  activo: props.usuario?.activo ?? true,
});
const error = ref('');

async function guardar() {
  error.value = '';
  try {
    if (props.usuario) {
      await useApi().patch(`/usuarios/${props.usuario.id}`, {
        nombre: datos.nombre.trim(),
        rol: datos.rol,
        activo: datos.activo,
      });
    } else {
      await useApi().post('/usuarios', {
        nombre: datos.nombre.trim(),
        email: datos.email.trim(),
        rol: datos.rol,
        contrasena: datos.contrasena,
      });
    }
    emit('guardado');
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  }
}
</script>

<template>
  <UForm :schema="esquema" :state="datos" class="space-y-4" @submit="guardar">
    <UFormField label="Nombre" name="nombre">
      <UInput v-model="datos.nombre" size="lg" class="w-full" autocomplete="off" />
    </UFormField>
    <UFormField
      label="Correo"
      name="email"
      :help="usuario ? 'El correo no se puede cambiar.' : 'Con él ingresará a Zenda.'"
    >
      <UInput
        v-model="datos.email"
        type="email"
        size="lg"
        class="w-full"
        :disabled="Boolean(usuario)"
        autocomplete="off"
      />
    </UFormField>
    <UFormField label="Rol" name="rol">
      <URadioGroup v-model="datos.rol" :items="ROLES_ASIGNABLES" variant="card" />
    </UFormField>
    <UFormField
      v-if="!usuario"
      label="Contraseña inicial"
      name="contrasena"
      help="Mínimo 8 caracteres, con al menos una letra y un número. Entrégasela en persona."
    >
      <UInput
        v-model="datos.contrasena"
        type="password"
        size="lg"
        class="w-full"
        autocomplete="new-password"
      />
    </UFormField>
    <USwitch
      v-else
      v-model="datos.activo"
      size="lg"
      label="Puede ingresar"
      description="Apágalo cuando la persona deje de trabajar en el negocio."
    />
    <UAlert
      v-if="usuario && (datos.rol !== usuario.rol || datos.activo !== usuario.activo)"
      color="info"
      variant="subtle"
      icon="i-lucide-info"
      title="Se cerrará su sesión en todos sus dispositivos"
      description="Así el cambio aplica de inmediato."
    />

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
        :label="usuario ? 'Guardar cambios' : 'Crear empleado'"
      />
    </div>
  </UForm>
</template>
