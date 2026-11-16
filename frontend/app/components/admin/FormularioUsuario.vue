<!--
  Crear una cuenta del negocio (con su contraseña inicial) o editar una: nombre, rol y si está
  activa. Solo lo hace el administrador de Zenda. Los roles asignables son dueño, administrador,
  cajero, mesero y cocina (la cuenta compartida de la tableta de la cocina).

  - Cada rol es una tarjeta con su ícono, en su tono, y lo que hace.
  - La contraseña inicial muestra sus requisitos mientras se escribe y se puede generar
    (CampoContrasenaNueva).

  Reglas del backend:
  - Cambiar el rol o desactivar a alguien cierra sus sesiones.
  - La cuenta de un administrador de Zenda solo cambia de nombre: no cambia de rol ni se
    desactiva. Al único dueño activo tampoco se le quita el acceso (responde DUENO_PROTEGIDO):
    con `unicoDueno`, su rol y su acceso quedan fijos y se explica por qué.
-->
<script setup>
import { z } from 'zod';

const props = defineProps({
  /** Cuenta a editar; sin ella, se crea una nueva. */
  usuario: { type: /** @type {import('vue').PropType<any>} */ (Object), default: null },
  /** Es el único dueño activo del negocio: no cambia de rol ni se desactiva. */
  unicoDueno: { type: Boolean, default: false },
});

const emit = defineEmits({
  /** @param {import('~/utils/usuarios.js').Cuenta} _cuenta La cuenta como quedó. */
  guardado: (_cuenta) => true,
  cancelar: () => true,
});

/** Las tarjetas de los roles, como las recibe URadioGroup. */
const ROLES_DEL_FORMULARIO = ROLES_ASIGNABLES.map((rol) => ({
  value: rol,
  label: ROLES[rol].etiqueta,
  description: DESCRIPCION_DE_ROL[rol],
  disabled: false,
}));

/** La cuenta del administrador de Zenda solo cambia de nombre. */
const esCuentaZenda = computed(() => props.usuario?.rol === 'administrador_zenda');
/** El rol y el acceso no se pueden cambiar (único dueño activo). */
const accesoFijo = computed(() => Boolean(props.usuario) && props.unicoDueno);
const rolesDisponibles = computed(() =>
  ROLES_DEL_FORMULARIO.map((rol) => ({
    ...rol,
    disabled: accesoFijo.value && rol.value !== props.usuario?.rol,
  })),
);

const esquema = computed(() =>
  z.object({
    nombre: z.string().trim().min(1, 'Escribe el nombre').max(120),
    email: props.usuario
      ? z.string()
      : z.string().trim().toLowerCase().pipe(z.email('Escribe un correo válido')),
    rol: esCuentaZenda.value ? z.string() : z.enum(ROLES_ASIGNABLES),
    contrasena: props.usuario ? z.string() : esquemaContrasenaNueva,
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

/** Cambiar el rol o quitarle el acceso cierra sus sesiones: se avisa antes de guardar. */
const cierraSesiones = computed(
  () =>
    Boolean(props.usuario) &&
    (datos.rol !== props.usuario.rol || (props.usuario.activo && !datos.activo)),
);

async function guardar() {
  error.value = '';
  try {
    /** @type {import('~/utils/usuarios.js').Cuenta} */
    let cuenta;
    if (props.usuario) {
      const nombre = datos.nombre.trim();
      cuenta = await useApi().patch(
        `/usuarios/${props.usuario.id}`,
        esCuentaZenda.value ? { nombre } : { nombre, rol: datos.rol, activo: datos.activo },
      );
    } else {
      cuenta = await useApi().post('/usuarios', {
        nombre: datos.nombre.trim(),
        email: datos.email.trim(),
        rol: datos.rol,
        contrasena: datos.contrasena,
      });
    }
    emit('guardado', cuenta);
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  }
}
</script>

<template>
  <UForm :schema="esquema" :state="datos" class="space-y-5" @submit="guardar">
    <UFormField label="Nombre" name="nombre">
      <UInput
        v-model="datos.nombre"
        size="lg"
        class="w-full"
        icon="i-lucide-user"
        autocomplete="off"
      />
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
        :icon="usuario ? 'i-lucide-lock' : 'i-lucide-mail'"
        :disabled="Boolean(usuario)"
        autocomplete="off"
      />
    </UFormField>

    <UFormField v-if="!esCuentaZenda" label="Rol" name="rol">
      <URadioGroup
        v-model="datos.rol"
        :items="rolesDisponibles"
        variant="card"
        indicator="end"
        :ui="{
          fieldset: 'grid gap-2 sm:grid-cols-2',
          item: 'items-center p-3 transition-[background-color,border-color] duration-150',
        }"
      >
        <template #label="{ item }">
          <span class="flex items-center gap-2.5">
            <span
              class="grid size-8 shrink-0 place-items-center rounded-lg"
              :class="[TONOS_DE_ROL[item.value].fondo, TONOS_DE_ROL[item.value].texto]"
            >
              <UIcon :name="ROLES[item.value].icono" class="size-4.5" />
            </span>
            {{ item.label }}
          </span>
        </template>
        <template #description="{ item }">
          <span class="mt-1 block text-xs leading-snug">{{ item.description }}</span>
        </template>
      </URadioGroup>
    </UFormField>
    <UAlert
      v-else
      color="neutral"
      variant="subtle"
      icon="i-lucide-shield-user"
      title="Cuenta del administrador de Zenda"
      description="Solo cambia el nombre: no cambia de rol ni se desactiva, para que el negocio siempre tenga quien lo atienda."
    />
    <UAlert
      v-if="accesoFijo"
      color="neutral"
      variant="subtle"
      icon="i-lucide-crown"
      title="Es el único dueño activo"
      description="No cambia de rol ni se desactiva. Para entregarle el negocio a otra persona, crea primero al nuevo dueño."
    />

    <UFormField
      v-if="!usuario"
      label="Contraseña inicial"
      name="contrasena"
      help="Entrégasela en persona. Después la puede cambiar en su Perfil."
    >
      <CampoContrasenaNueva v-model="datos.contrasena" />
    </UFormField>
    <div
      v-else-if="!esCuentaZenda"
      class="rounded-xl p-3 ring-1 transition-colors duration-200"
      :class="datos.activo ? 'ring-default' : 'bg-elevated/50 ring-accented'"
    >
      <USwitch
        v-model="datos.activo"
        size="lg"
        :disabled="accesoFijo"
        label="Puede ingresar"
        :description="
          datos.activo
            ? 'Apágalo cuando la persona deje de trabajar en el negocio.'
            : 'No podrá ingresar a Zenda hasta que lo vuelvas a encender.'
        "
      />
    </div>

    <Transition
      enter-from-class="opacity-0 -translate-y-1"
      enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
      leave-to-class="opacity-0"
      leave-active-class="transition duration-150 ease-in motion-reduce:transition-none"
    >
      <UAlert
        v-if="cierraSesiones"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        title="Se cerrará su sesión en todos sus dispositivos"
        description="Así el cambio aplica de inmediato."
      />
    </Transition>

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
        :icon="usuario ? 'i-lucide-check' : 'i-lucide-user-plus'"
        :label="usuario ? 'Guardar cambios' : 'Crear usuario'"
      />
    </div>
  </UForm>
</template>
