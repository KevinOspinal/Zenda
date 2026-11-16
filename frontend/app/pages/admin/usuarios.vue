<!--
  Cuentas del negocio: quién entra a Zenda, con qué rol y si puede ingresar. Solo las ve y las
  maneja el administrador de Zenda: crea las cuentas (también la del dueño), les cambia el rol,
  las activa o desactiva y les restablece la contraseña. La propia se cambia en Perfil, y el
  acceso de un domiciliario, en Domiciliarios.

  - Arriba, contadores que también filtran (activos, bloqueados, inactivos), chips por rol y un
    buscador por nombre o correo. Las cuentas van ordenadas por rol (del dueño a la cocina) y
    cada tarjeta lleva el suyo, con su color.
  - Tocar una cuenta abre al lado una vista rápida en tablet horizontal y PC (PanelUsuario) y
    una hoja desde abajo en el celular: su estado explicado, su rol, a qué entra y sus acciones.
    Las mismas acciones están en el menú de cada tarjeta.
  - Desactivar pide confirmación (cierra sus sesiones); activar no, porque no quita nada.
  - Movimiento: las tarjetas entran en cascada, se reacomodan deslizándose al filtrar y la que
    cambia se resalta con una onda. Con "reducir movimiento" solo cambian de opacidad.
-->
<script setup>
definePageMeta({ seccion: 'usuarios' });

/** @typedef {import('~/utils/usuarios.js').Cuenta} Cuenta */

const toast = useToast();
const sesion = useSesionStore();
const pantallaGrande = useMediaQuery('(min-width: 1024px)');
const puedeGestionar = computed(() => puede(sesion.rol, 'gestionarUsuarios'));

const vista = useVistaDeUsuarios();
const { cuentas, estadoCarga, errorCarga, filtro, rolElegido, busqueda, conteo, roles } = vista;
const { visibles, elegidaId, elegida, resaltados } = vista;
const { estadoDe, finBloqueoDe, esPropia, permisosDe, cargar, verTodos } = vista;
cargar();

const contadores = computed(() =>
  /** @type {import('~/utils/usuarios.js').EstadoCuenta[]} */ (Object.keys(ESTADOS_CUENTA)).map(
    (clave) => ({
      clave,
      etiqueta: ESTADOS_CUENTA[clave].plural,
      icono: ESTADOS_CUENTA[clave].icono,
      color: ESTADOS_CUENTA[clave].color,
      cantidad: conteo.value[clave],
      latir: clave === 'bloqueado',
    }),
  ),
);

// ── Vista rápida (tablet y PC) u hoja de abajo (celular) ──
const hojaAbierta = ref(false);
/** @param {Cuenta} cuenta */
function elegir(cuenta) {
  if (pantallaGrande.value) {
    // Tocar otra vez la misma cuenta cierra la vista rápida.
    elegidaId.value = elegidaId.value === cuenta.id ? null : cuenta.id;
    return;
  }
  elegidaId.value = cuenta.id;
  hojaAbierta.value = true;
}
watch(pantallaGrande, (grande) => {
  if (grande) hojaAbierta.value = false;
  else elegidaId.value = null;
});

// ── Crear y editar ──
const formularioAbierto = ref(false);
const editada = ref(/** @type {Cuenta | null} */ (null));
/** @param {Cuenta | null} cuenta Sin cuenta, se crea una nueva. */
function abrirFormulario(cuenta) {
  editada.value = cuenta;
  formularioAbierto.value = true;
}
/** @param {Cuenta} cuenta */
function alGuardar(cuenta) {
  formularioAbierto.value = false;
  vista.alGuardar(cuenta);
  toast.add({
    title: editada.value ? 'Cambios guardados' : 'Usuario creado',
    description: editada.value ? cuenta.nombre : `${cuenta.nombre} ya puede ingresar a Zenda.`,
    icon: 'i-lucide-circle-check',
    color: 'success',
  });
}

// ── Restablecer la contraseña ──
const restableciendo = ref(false);
const cuentaARestablecer = ref(/** @type {Cuenta | null} */ (null));
/** @param {Cuenta} cuenta */
function abrirRestablecer(cuenta) {
  cuentaARestablecer.value = cuenta;
  restableciendo.value = true;
}
/**
 * El backend le pone la contraseña nueva, le quita el bloqueo y cierra sus sesiones.
 * @param {Cuenta} cuenta
 * @param {string} contrasenaNueva
 */
async function restablecer(cuenta, contrasenaNueva) {
  await useApi().post(`/usuarios/${cuenta.id}/restablecer-contrasena`, { contrasenaNueva });
  vista.alGuardar({ ...cuenta, bloqueado: false, bloqueadoHasta: null });
}

// ── Activar y desactivar ──
const confirmandoDesactivar = ref(false);
const cuentaADesactivar = ref(/** @type {Cuenta | null} */ (null));
/** @param {Cuenta} cuenta */
function cambiarAcceso(cuenta) {
  if (!cuenta.activo) {
    guardarAcceso(cuenta, true);
    return;
  }
  cuentaADesactivar.value = cuenta;
  confirmandoDesactivar.value = true;
}
/**
 * @param {Cuenta} cuenta
 * @param {boolean} activo
 */
async function guardarAcceso(cuenta, activo) {
  try {
    vista.alGuardar(await useApi().patch(`/usuarios/${cuenta.id}`, { activo }));
    confirmandoDesactivar.value = false;
    toast.add({
      title: activo ? `${cuenta.nombre} ya puede ingresar` : `${cuenta.nombre} quedó desactivado`,
      description: activo ? undefined : 'Cerramos su sesión en todos sus dispositivos.',
      icon: activo ? 'i-lucide-user-check' : 'i-lucide-user-x',
      color: activo ? 'success' : 'neutral',
    });
  } catch (fallo) {
    toast.add({
      title: activo ? 'No pudimos activarlo' : 'No pudimos desactivarlo',
      description: fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO,
      icon: 'i-lucide-circle-alert',
      color: 'error',
    });
  }
}

/**
 * Opciones del menú de cada tarjeta (las mismas de la vista rápida).
 * @param {Cuenta} cuenta
 */
function opcionesDe(cuenta) {
  const permisos = permisosDe(cuenta);
  return [
    permisos.editar && {
      label: 'Editar',
      icon: 'i-lucide-pencil',
      onSelect: () => abrirFormulario(cuenta),
    },
    permisos.restablecer && {
      label: 'Restablecer contraseña',
      icon: 'i-lucide-key-round',
      onSelect: () => abrirRestablecer(cuenta),
    },
    permisos.cambiarAcceso &&
      (cuenta.activo
        ? {
            label: 'Desactivar',
            icon: 'i-lucide-user-x',
            color: 'error',
            onSelect: () => cambiarAcceso(cuenta),
          }
        : {
            label: 'Activar',
            icon: 'i-lucide-user-check',
            onSelect: () => cambiarAcceso(cuenta),
          }),
  ].filter(Boolean);
}

// Escape cierra la vista rápida (si no hay un modal abierto: ahí Escape cierra el modal).
onKeyStroke('Escape', () => {
  if (!formularioAbierto.value && !restableciendo.value && !confirmandoDesactivar.value) {
    elegidaId.value = null;
  }
});

/** Retraso de la cascada de entrada: las primeras doce tarjetas, una tras otra. */
const retraso = (/** @type {number} */ indice) => `${Math.min(indice, 11) * 30}ms`;
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-muted">Quién entra a Zenda en este negocio y qué puede hacer.</p>
      <UButton
        v-if="puedeGestionar"
        size="lg"
        icon="i-lucide-user-plus"
        label="Nuevo usuario"
        @click="abrirFormulario(null)"
      />
    </div>

    <!-- Cargando: los contadores y las tarjetas con su forma. -->
    <div v-if="estadoCarga === 'cargando' || estadoCarga === 'sin_cargar'" class="space-y-5">
      <div class="grid grid-cols-3 gap-2">
        <USkeleton v-for="n in 3" :key="n" class="h-20 rounded-xl" />
      </div>
      <USkeleton class="h-11 w-full rounded-full sm:w-96" />
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <USkeleton v-for="n in 6" :key="n" class="h-28 rounded-xl" />
      </div>
    </div>

    <UEmpty
      v-else-if="estadoCarga === 'error'"
      icon="i-lucide-wifi-off"
      title="No pudimos cargar los usuarios"
      :description="errorCarga"
      :actions="[{ label: 'Reintentar', icon: 'i-lucide-rotate-cw', onClick: cargar }]"
    />

    <!-- La lista a la izquierda y, en tablet horizontal y PC, la vista rápida a la derecha. -->
    <div v-else class="lg:relative lg:flex lg:items-start lg:gap-6">
      <div class="min-w-0 flex-1 space-y-4">
        <ContadoresFiltro
          v-model="filtro"
          :contadores="contadores"
          etiqueta="Filtrar las cuentas"
        />

        <FiltroRoles v-model="rolElegido" :roles="roles" :total="cuentas.length" />

        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <UInput
            v-model="busqueda"
            type="search"
            icon="i-lucide-search"
            size="lg"
            placeholder="Buscar por nombre o correo"
            aria-label="Buscar por nombre o correo"
            class="w-full sm:w-80"
          >
            <template v-if="busqueda" #trailing>
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                icon="i-lucide-x"
                aria-label="Borrar la búsqueda"
                @click="busqueda = ''"
              />
            </template>
          </UInput>
          <p class="cifra text-sm text-muted" aria-live="polite">
            {{ visibles.length }} de {{ cuentas.length }}
            {{ cuentas.length === 1 ? 'persona' : 'personas' }}
          </p>
        </div>

        <!-- Las columnas dependen del espacio que le queda (se angosta con la vista rápida). -->
        <div class="@container">
          <UEmpty
            v-if="!visibles.length"
            icon="i-lucide-search-x"
            :title="busqueda.trim() ? 'Nadie con ese nombre o correo' : 'Nadie por aquí'"
            description="Prueba con otra búsqueda o mira todas las cuentas."
            :actions="[{ label: 'Ver todas', icon: 'i-lucide-users', onClick: verTodos }]"
          />

          <TransitionGroup
            tag="div"
            name="tarjeta"
            type="transition"
            appear
            appear-from-class="tarjeta-aparece-desde"
            appear-active-class="tarjeta-aparece-activa"
            class="relative grid grid-cols-1 gap-3 @lg:grid-cols-2 @4xl:grid-cols-3 @6xl:grid-cols-4"
            @before-leave="fijarAlSalir"
          >
            <TarjetaUsuario
              v-for="(cuenta, indice) in visibles"
              :key="cuenta.id"
              :style="{ '--retraso': retraso(indice) }"
              :cuenta="cuenta"
              :estado="estadoDe(cuenta)"
              :fin-bloqueo="finBloqueoDe(cuenta)"
              :propia="esPropia(cuenta)"
              :busqueda="busqueda"
              :opciones="opcionesDe(cuenta)"
              :resaltado="resaltados.has(cuenta.id)"
              :seleccionado="elegidaId === cuenta.id && pantallaGrande"
              @seleccionar="elegir"
            />
          </TransitionGroup>
        </div>
      </div>

      <!-- Vista rápida (tablet horizontal y PC): empieza a la altura de los contadores y se
           queda a la vista al bajar, con sus botones siempre en pantalla. -->
      <Transition name="vista-rapida" @before-leave="fijarPanelAlSalir">
        <PanelUsuario
          v-if="pantallaGrande && elegida"
          :key="elegida.id"
          :cuenta="elegida"
          :estado="estadoDe(elegida)"
          :fin-bloqueo="finBloqueoDe(elegida)"
          :propia="esPropia(elegida)"
          :permisos="permisosDe(elegida)"
          class="sticky top-22 w-80 shrink-0 xl:w-96"
          @cerrar="elegidaId = null"
          @editar="elegida && abrirFormulario(elegida)"
          @restablecer="elegida && abrirRestablecer(elegida)"
          @cambiar-acceso="elegida && cambiarAcceso(elegida)"
        />
      </Transition>
    </div>

    <!-- Celular: el mismo detalle en una hoja desde abajo. -->
    <USlideover
      v-if="!pantallaGrande"
      v-model:open="hojaAbierta"
      side="bottom"
      :title="elegida?.nombre ?? ''"
      :description="elegida ? ROLES[elegida.rol].etiqueta : ''"
      :ui="{ content: 'max-h-[88dvh]' }"
    >
      <template #body>
        <DetalleUsuario
          v-if="elegida"
          :cuenta="elegida"
          :estado="estadoDe(elegida)"
          :fin-bloqueo="finBloqueoDe(elegida)"
          :motivo="permisosDe(elegida).motivo"
        />
      </template>
      <template v-if="elegida && opcionesDe(elegida).length" #footer>
        <AccionesDeCuenta
          :permisos="permisosDe(elegida)"
          :activa="elegida.activo"
          @editar="elegida && abrirFormulario(elegida)"
          @restablecer="elegida && abrirRestablecer(elegida)"
          @cambiar-acceso="elegida && cambiarAcceso(elegida)"
        />
      </template>
    </USlideover>

    <USlideover
      v-model:open="formularioAbierto"
      :side="pantallaGrande ? 'right' : 'bottom'"
      :title="editada ? `Editar a ${editada.nombre}` : 'Nuevo usuario'"
      :ui="{ content: pantallaGrande ? '' : 'max-h-[92dvh]' }"
    >
      <template #body>
        <FormularioUsuario
          :key="editada?.id ?? 'nuevo'"
          :usuario="editada"
          :unico-dueno="editada ? permisosDe(editada).motivo === 'unico_dueno' : false"
          @guardado="alGuardar"
          @cancelar="formularioAbierto = false"
        />
      </template>
    </USlideover>

    <RestablecerContrasena
      v-model:abierto="restableciendo"
      :cuenta="cuentaARestablecer"
      :restablecer="restablecer"
    />

    <UModal
      v-model:open="confirmandoDesactivar"
      :title="`¿Desactivar a ${cuentaADesactivar?.nombre ?? ''}?`"
      description="No podrá ingresar a Zenda y se cerrará su sesión en todos sus dispositivos. Su historial (pedidos, cobros, auditoría) se conserva, y lo puedes activar de nuevo cuando quieras."
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            size="lg"
            label="Cancelar"
            @click="confirmandoDesactivar = false"
          />
          <UButton
            color="error"
            size="lg"
            icon="i-lucide-user-x"
            label="Desactivar"
            loading-auto
            @click="cuentaADesactivar && guardarAcceso(cuentaADesactivar, false)"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
