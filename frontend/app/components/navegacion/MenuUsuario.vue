<!--
  Menú del usuario: quién está en la sesión y accesos a su perfil, al modo cocina y a salir.
  Va al pie de la barra lateral (tablet y PC).
-->
<script setup>
const sesion = useSesionStore();

const opciones = computed(() => [
  [
    { label: 'Mi perfil', icon: 'i-lucide-circle-user', to: '/perfil' },
    // Solo quien prepara platos puede usar el dispositivo como pantalla de cocina.
    ...(puede(sesion.rol, 'prepararPlatos')
      ? [{ label: 'Usar como pantalla de cocina', icon: 'i-lucide-chef-hat', to: '/cocina' }]
      : []),
  ],
  [
    {
      label: 'Cerrar sesión',
      icon: 'i-lucide-log-out',
      color: /** @type {const} */ ('error'),
      onSelect: () => sesion.salir(),
    },
  ],
]);
</script>

<template>
  <UDropdownMenu :items="opciones" :content="{ side: 'top', align: 'start' }" class="w-full">
    <UButton
      color="neutral"
      variant="ghost"
      block
      class="justify-start gap-3 px-2 py-2"
      :aria-label="`Opciones de ${sesion.usuario?.nombre ?? 'la cuenta'}`"
    >
      <UAvatar :alt="sesion.usuario?.nombre" size="md" />
      <span class="min-w-0 flex-1 text-left">
        <span class="block truncate font-semibold text-highlighted">{{
          sesion.usuario?.nombre
        }}</span>
        <span class="block truncate text-xs text-muted">
          {{ sesion.rol ? ROLES[sesion.rol].etiqueta : '' }}
        </span>
      </span>
      <UIcon name="i-lucide-chevrons-up-down" class="size-4 shrink-0 text-muted" />
    </UButton>
  </UDropdownMenu>
</template>
