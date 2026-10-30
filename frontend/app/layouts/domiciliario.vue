<!--
  Layout del domiciliario: pensado para el celular, en la calle y con una mano. Arriba, su
  saludo, el negocio, la conexión y un menú (ajustes y salir). Sin barra de navegación: su
  pantalla es una sola (sus entregas) y abajo queda libre para el botón "Entregado".
-->
<script setup>
const sesion = useSesionStore();
const conexion = useConexionStore();

/** Solo el primer nombre: el saludo cabe en cualquier celular. */
const primerNombre = computed(() => sesion.usuario?.nombre.split(' ')[0] ?? '');

const opciones = computed(() => [
  [{ label: 'Ajustes y contraseña', icon: 'i-lucide-settings', to: '/perfil' }],
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
  <div class="min-h-dvh bg-default">
    <header
      class="sticky top-0 z-20 border-b border-default bg-default/90 backdrop-blur pt-[env(safe-area-inset-top)]"
    >
      <div class="mx-auto flex h-16 max-w-xl items-center justify-between gap-3 px-4">
        <div class="flex min-w-0 items-center gap-3">
          <LogoZenda compacto />
          <div class="min-w-0">
            <p class="truncate text-lg font-bold text-highlighted">Hola, {{ primerNombre }}</p>
            <p class="truncate text-xs text-muted">{{ sesion.negocio?.nombre }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <IndicadorConexion :estado="conexion.estado" />
          <UDropdownMenu :items="opciones" :content="{ align: 'end' }">
            <UButton
              color="neutral"
              variant="ghost"
              size="xl"
              icon="i-lucide-circle-user"
              aria-label="Opciones de la cuenta"
            />
          </UDropdownMenu>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-xl px-4 pt-4 pb-32">
      <slot />
    </main>
  </div>
</template>
