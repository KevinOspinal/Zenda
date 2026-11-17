<!--
  Avatar sin foto: las iniciales de un nombre en un círculo de color (el API no guarda fotos de
  personas). Apagado, se ve en gris (por ejemplo, una cuenta inactiva). En la esquina puede
  llevar una marca (slot `marca`), como el candado de una cuenta bloqueada.
  Es decorativo: el nombre se dice en texto al lado.
-->
<script setup>
const props = defineProps({
  nombre: { type: String, required: true },
  /** Clases de fondo y de texto, por ejemplo TONOS_DE_ROL.cajero o tonoDeTexto(id). */
  tono: {
    type: /** @type {import('vue').PropType<{ fondo: string, texto: string }>} */ (Object),
    required: true,
  },
  tamano: {
    type: /** @type {import('vue').PropType<'md' | 'lg' | 'xl'>} */ (String),
    default: 'lg',
  },
  apagado: { type: Boolean, default: false },
});

// Clases completas para que Tailwind las encuentre.
const TAMANOS = Object.freeze({
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-16 text-xl',
});

const iniciales = computed(() => inicialesDe(props.nombre) || '?');
</script>

<template>
  <span aria-hidden="true" class="relative inline-grid shrink-0 place-items-center">
    <span
      class="grid place-items-center rounded-full font-bold tracking-tight transition-[filter,opacity] duration-200"
      :class="[TAMANOS[tamano], tono.fondo, tono.texto, apagado && 'opacity-60 grayscale']"
    >
      {{ iniciales }}
    </span>
    <slot name="marca" />
  </span>
</template>
