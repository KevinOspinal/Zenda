<!--
  Empleados del negocio: nombre, rol y estado. El dueño los crea, les cambia el rol, los
  desactiva y les restablece la contraseña; el administrador solo los ve.
-->
<script setup>
import { z } from 'zod';

definePageMeta({ seccion: 'usuarios' });

const sesion = useSesionStore();
const toast = useToast();
const pantallaGrande = useMediaQuery('(min-width: 1024px)');
const puedeGestionar = computed(() => puede(sesion.rol, 'gestionarUsuarios'));

const usuarios = ref(/** @type {any[]} */ ([]));
const cargando = ref(true);
const error = ref('');
async function cargar() {
  error.value = '';
  try {
    usuarios.value = await useApi().get('/usuarios');
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  } finally {
    cargando.value = false;
  }
}
cargar();

// Crear y editar.
const panelAbierto = ref(false);
const editado = ref(/** @type {any} */ (null));
/** @param {any} usuario */
function abrir(usuario) {
  editado.value = usuario;
  panelAbierto.value = true;
}
function alGuardar() {
  panelAbierto.value = false;
  toast.add({ title: 'Empleado guardado', icon: 'i-lucide-circle-check', color: 'success' });
  cargar();
}

// Restablecer la contraseña de un empleado.
const restableciendo = ref(false);
const contrasenaNueva = ref('');
const errorContrasena = ref('');
const esquemaContrasena = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Za-zÁÉÍÓÚáéíóúÑñ]/)
  .regex(/\d/);
/** @param {any} usuario */
function abrirRestablecer(usuario) {
  editado.value = usuario;
  contrasenaNueva.value = '';
  errorContrasena.value = '';
  restableciendo.value = true;
}
async function restablecer() {
  errorContrasena.value = '';
  try {
    await useApi().post(`/usuarios/${editado.value.id}/restablecer-contrasena`, {
      contrasenaNueva: contrasenaNueva.value,
    });
    restableciendo.value = false;
    toast.add({
      title: 'Contraseña restablecida',
      description: `Entrégale la nueva contraseña a ${editado.value.nombre} en persona.`,
      icon: 'i-lucide-key-round',
      color: 'success',
    });
  } catch (fallo) {
    errorContrasena.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  }
}

/** Estado de un empleado para mostrar. */
function estadoDe(/** @type {any} */ usuario) {
  if (!usuario.activo) return { etiqueta: 'Inactivo', color: 'neutral', icono: 'i-lucide-user-x' };
  if (usuario.bloqueado) return { etiqueta: 'Bloqueado', color: 'warning', icono: 'i-lucide-lock' };
  return { etiqueta: 'Activo', color: 'success', icono: 'i-lucide-circle-check' };
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-muted">
        {{ usuarios.length }} {{ usuarios.length === 1 ? 'persona' : 'personas' }}
      </p>
      <UButton
        v-if="puedeGestionar"
        size="lg"
        icon="i-lucide-user-plus"
        label="Nuevo empleado"
        @click="abrir(null)"
      />
    </div>

    <div v-if="cargando" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <USkeleton v-for="n in 5" :key="n" class="h-24 rounded-xl" />
    </div>
    <UEmpty
      v-else-if="error"
      icon="i-lucide-wifi-off"
      title="No pudimos cargar los empleados"
      :description="error"
      :actions="[{ label: 'Reintentar', icon: 'i-lucide-rotate-cw', onClick: cargar }]"
    />

    <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="usuario in usuarios"
        :key="usuario.id"
        class="flex items-start gap-3 rounded-xl bg-default p-4 ring-1 ring-default"
        :class="!usuario.activo && 'opacity-60'"
      >
        <UAvatar :alt="usuario.nombre" size="lg" />
        <div class="min-w-0 flex-1 space-y-1.5">
          <p class="truncate font-semibold text-highlighted">{{ usuario.nombre }}</p>
          <p class="truncate text-sm text-muted">{{ usuario.email }}</p>
          <div class="flex flex-wrap gap-1.5">
            <UBadge
              color="primary"
              variant="subtle"
              :icon="ROLES[usuario.rol].icono"
              :label="ROLES[usuario.rol].etiqueta"
            />
            <UBadge
              :color="/** @type {any} */ (estadoDe(usuario).color)"
              variant="subtle"
              :icon="estadoDe(usuario).icono"
              :label="estadoDe(usuario).etiqueta"
            />
          </div>
        </div>
        <UDropdownMenu
          v-if="puedeGestionar && usuario.rol !== 'dueno'"
          :items="[
            [
              { label: 'Editar', icon: 'i-lucide-pencil', onSelect: () => abrir(usuario) },
              {
                label: 'Restablecer contraseña',
                icon: 'i-lucide-key-round',
                onSelect: () => abrirRestablecer(usuario),
              },
            ],
          ]"
        >
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-ellipsis-vertical"
            :aria-label="`Opciones de ${usuario.nombre}`"
          />
        </UDropdownMenu>
      </div>
    </div>

    <USlideover
      v-model:open="panelAbierto"
      :side="pantallaGrande ? 'right' : 'bottom'"
      :title="editado ? `Editar a ${editado.nombre}` : 'Nuevo empleado'"
    >
      <template #body>
        <FormularioUsuario
          :key="editado?.id ?? 'nuevo'"
          :usuario="editado"
          @guardado="alGuardar"
          @cancelar="panelAbierto = false"
        />
      </template>
    </USlideover>

    <UModal
      v-model:open="restableciendo"
      :title="`Restablecer la contraseña de ${editado?.nombre ?? ''}`"
      description="Sus sesiones abiertas se cerrarán. Entrégale la nueva contraseña en persona."
    >
      <template #body>
        <UFormField
          label="Contraseña nueva"
          help="Mínimo 8 caracteres, con al menos una letra y un número."
        >
          <UInput
            v-model="contrasenaNueva"
            type="password"
            size="lg"
            class="w-full"
            autocomplete="new-password"
          />
        </UFormField>
        <UAlert
          v-if="errorContrasena"
          class="mt-3"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="errorContrasena"
        />
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            size="lg"
            label="Cancelar"
            @click="restableciendo = false"
          />
          <UButton
            size="lg"
            icon="i-lucide-key-round"
            label="Restablecer"
            loading-auto
            :disabled="!esquemaContrasena.safeParse(contrasenaNueva).success"
            @click="restablecer"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
