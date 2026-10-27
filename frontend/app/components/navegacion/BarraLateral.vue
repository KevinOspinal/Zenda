<!--
  Barra lateral de navegación para tablet horizontal y PC: logo, negocio, secciones del rol
  y el menú del usuario al pie.
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

const opciones = computed(() =>
  props.secciones.map((seccion) => ({
    label: seccion.etiqueta,
    icon: seccion.icono,
    to: seccion.ruta,
    badge: props.insignias[seccion.id]
      ? { label: String(props.insignias[seccion.id]), color: /** @type {const} */ ('info') }
      : undefined,
  })),
);
</script>

<template>
  <aside
    class="sticky top-0 h-dvh w-64 shrink-0 flex-col border-r border-default bg-elevated/40"
    aria-label="Navegación principal"
  >
    <div class="flex h-16 items-center border-b border-default px-5">
      <LogoZenda />
    </div>

    <div class="px-5 pt-5 pb-3">
      <p class="text-xs font-medium tracking-wide text-dimmed uppercase">Negocio</p>
      <p class="truncate font-semibold text-highlighted">{{ sesion.negocio?.nombre }}</p>
      <p class="text-xs text-muted">NIT {{ sesion.negocio?.nit }}</p>
    </div>

    <UNavigationMenu
      orientation="vertical"
      :items="opciones"
      class="flex-1 overflow-y-auto px-3"
      :ui="{ link: 'py-2.5 text-base', linkLeadingIcon: 'size-5' }"
    />

    <div class="border-t border-default p-3">
      <MenuUsuario />
    </div>
  </aside>
</template>
