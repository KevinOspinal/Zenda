<!--
  Barra lateral de navegación para tablet horizontal y PC: logo, negocio, secciones del rol
  y el menú del usuario al pie.
  Entre 1024 y 1280 px (tablet horizontal, portátil pequeño) se vuelve compacta: solo íconos,
  con el nombre al pasar el dedo o el mouse, para dejarle el espacio al contenido.
-->
<script setup>
/** @typedef {import('~/utils/roles.js').Seccion} Seccion */

const props = defineProps({
  secciones: { type: /** @type {import('vue').PropType<Seccion[]>} */ (Array), required: true },
  /** Números para mostrar junto a una sección, por ejemplo { avisos: 2 }. */
  insignias: {
    type: /** @type {import('vue').PropType<Record<string, number>>} */ (Object),
    default: () => ({}),
  },
});

const sesion = useSesionStore();
const compacta = useMediaQuery('(max-width: 1279px)');

const opciones = computed(() =>
  props.secciones.map((seccion) => {
    const cantidad = props.insignias[seccion.id];
    return {
      label: seccion.etiqueta,
      icon: seccion.icono,
      to: seccion.ruta,
      // Compacta no hay espacio para el número: un punto sobre el ícono avisa que hay algo.
      ...(cantidad && compacta.value
        ? { chip: { color: /** @type {const} */ ('info'), size: /** @type {const} */ ('md') } }
        : {}),
      ...(cantidad && !compacta.value
        ? { badge: { label: String(cantidad), color: /** @type {const} */ ('info') } }
        : {}),
    };
  }),
);
</script>

<template>
  <aside
    class="sticky top-0 h-dvh shrink-0 flex-col border-r border-default bg-elevated/40"
    :class="compacta ? 'w-20' : 'w-64'"
    aria-label="Navegación principal"
  >
    <div
      class="flex h-16 items-center border-b border-default"
      :class="compacta ? 'justify-center' : 'px-5'"
    >
      <LogoZenda :compacto="compacta" />
    </div>

    <div v-if="!compacta" class="px-5 pt-5 pb-3">
      <p class="text-xs font-medium tracking-wide text-dimmed uppercase">Negocio</p>
      <p class="truncate font-semibold text-highlighted">{{ sesion.negocio?.nombre }}</p>
      <p class="text-xs text-muted">NIT {{ sesion.negocio?.nit }}</p>
    </div>

    <UNavigationMenu
      orientation="vertical"
      :items="opciones"
      :collapsed="compacta"
      tooltip
      class="flex-1 overflow-y-auto"
      :class="compacta ? 'px-3 pt-4' : 'px-3'"
      :ui="{
        link: compacta ? 'justify-center py-3' : 'py-2.5 text-base',
        linkLeadingIcon: compacta ? 'size-6' : 'size-5',
      }"
    />

    <div class="border-t border-default p-3">
      <MenuUsuario :compacto="compacta" />
    </div>
  </aside>
</template>
