<!--
  Botones de una cuenta al pie de la vista rápida y de la hoja del celular: «Restablecer
  contraseña», «Editar» y «Desactivar» o «Activar», según lo que se pueda hacer con ella (ver
  permisosSobreCuenta). Las acciones las hace la página.
  La principal (rellena y a todo el ancho) es la que más se necesita: «Activar» si la cuenta
  está inactiva y, si no, «Restablecer contraseña» (el empleado que olvidó la suya o quedó
  bloqueado).
-->
<script setup>
const props = defineProps({
  /** Ver permisosSobreCuenta. */
  permisos: {
    type: /** @type {import('vue').PropType<{ editar: boolean, restablecer: boolean, cambiarAcceso: boolean }>} */ (
      Object
    ),
    required: true,
  },
  /** La cuenta puede ingresar (decide entre «Desactivar» y «Activar»). */
  activa: { type: Boolean, required: true },
});

const emit = defineEmits({
  editar: () => true,
  restablecer: () => true,
  cambiarAcceso: () => true,
});

/**
 * @typedef {object} Accion
 * @property {'restablecer' | 'editar' | 'cambiarAcceso'} evento
 * @property {string} label
 * @property {string} icon
 * @property {'primary' | 'neutral' | 'error'} color
 */

/** Las acciones permitidas, la principal primero. */
const acciones = computed(() => {
  /** @type {Accion[]} */
  const lista = [];
  const activar = props.permisos.cambiarAcceso && !props.activa;
  if (activar) {
    lista.push({
      evento: 'cambiarAcceso',
      label: 'Activar',
      icon: 'i-lucide-user-check',
      color: 'primary',
    });
  }
  if (props.permisos.restablecer) {
    lista.push({
      evento: 'restablecer',
      label: 'Restablecer contraseña',
      icon: 'i-lucide-key-round',
      color: activar ? 'neutral' : 'primary',
    });
  }
  if (props.permisos.editar) {
    lista.push({ evento: 'editar', label: 'Editar', icon: 'i-lucide-pencil', color: 'neutral' });
  }
  if (props.permisos.cambiarAcceso && props.activa) {
    lista.push({
      evento: 'cambiarAcceso',
      label: 'Desactivar',
      icon: 'i-lucide-user-x',
      color: 'error',
    });
  }
  return lista;
});

/** @param {Accion['evento']} evento */
function hacer(evento) {
  if (evento === 'restablecer') emit('restablecer');
  else if (evento === 'editar') emit('editar');
  else emit('cambiarAcceso');
}
</script>

<template>
  <div
    v-if="acciones.length"
    class="grid w-full gap-2"
    :class="acciones.length > 1 && 'grid-cols-2'"
  >
    <UButton
      v-for="(accion, indice) in acciones"
      :key="accion.evento + accion.label"
      block
      size="xl"
      :color="accion.color"
      :variant="indice === 0 ? 'solid' : 'soft'"
      :icon="accion.icon"
      :label="accion.label"
      :class="indice === 0 && acciones.length === 3 && 'col-span-2'"
      @click="hacer(accion.evento)"
    />
  </div>
</template>
