<!--
  Avatar de una cuenta: sus iniciales en el tono de su rol (AvatarIniciales) y, en la esquina,
  un candado si está bloqueada o una persona tachada si está inactiva. Inactiva, se ve en gris.
  Es decorativo: el nombre y el estado se dicen en texto al lado.
-->
<script setup>
const props = defineProps({
  nombre: { type: String, required: true },
  rol: {
    type: /** @type {import('vue').PropType<import('~/utils/roles.js').Rol>} */ (String),
    required: true,
  },
  estado: {
    type: /** @type {import('vue').PropType<import('~/utils/usuarios.js').EstadoCuenta>} */ (
      String
    ),
    default: 'activo',
  },
  tamano: {
    type: /** @type {import('vue').PropType<'md' | 'lg' | 'xl'>} */ (String),
    default: 'lg',
  },
});

// Tamaño de la marca de la esquina según el del avatar. Clases completas para Tailwind.
const MARCAS = Object.freeze({
  md: { marca: 'size-4.5', icono: 'size-2.5' },
  lg: { marca: 'size-5', icono: 'size-3' },
  xl: { marca: 'size-6', icono: 'size-3.5' },
});

const medidas = computed(() => MARCAS[props.tamano]);
</script>

<template>
  <AvatarIniciales
    :nombre="nombre"
    :tono="TONOS_DE_ROL[rol]"
    :tamano="tamano"
    :apagado="estado === 'inactivo'"
  >
    <template v-if="estado !== 'activo'" #marca>
      <span
        class="absolute -right-0.5 -bottom-0.5 grid place-items-center rounded-full ring-2 ring-(--ui-bg)"
        :class="[
          medidas.marca,
          estado === 'bloqueado' ? 'bg-warning text-inverted' : 'bg-accented text-toned',
        ]"
      >
        <UIcon :name="ESTADOS_CUENTA[estado].icono" :class="medidas.icono" />
      </span>
    </template>
  </AvatarIniciales>
</template>
