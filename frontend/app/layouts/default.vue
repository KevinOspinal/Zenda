<!--
  Layout principal (con sesión). Se adapta al dispositivo:
  - Celular: encabezado arriba y navegación inferior, al alcance del pulgar.
  - Tablet horizontal y PC: barra lateral con las secciones y el menú del usuario.
  Las secciones salen del rol (utils/roles.js); el título, de la sección de la página.
-->
<script setup>
const sesion = useSesionStore();
const conexion = useConexionStore();
const pedidos = usePedidosStore();
const ruta = useRoute();

const secciones = computed(() => (sesion.rol ? seccionesDe(sesion.rol) : []));
const seccionActual = computed(() => SECCIONES.find((s) => s.id === ruta.meta.seccion));
/** Título: el de la sección, o el que defina la página (por ejemplo, el detalle de un pedido). */
const titulo = computed(
  () =>
    seccionActual.value?.etiqueta ??
    /** @type {string | undefined} */ (ruta.meta.titulo) ??
    'Zenda',
);

/** Platos listos del mesero, sobre la sección Avisos. */
const insignias = computed(() =>
  // Avisos cuenta mesas con platos listos, no platos: así el número no se dispara.
  sesion.rol === 'mesero'
    ? { avisos: pedidos.pedidosConPlatosListos(sesion.usuario?.id).length }
    : {},
);

useHead(() => ({ title: titulo.value === 'Zenda' ? 'Zenda' : `${titulo.value} · Zenda` }));
</script>

<template>
  <div class="min-h-dvh bg-default lg:flex">
    <BarraLateral :secciones="secciones" :insignias="insignias" class="hidden lg:flex" />

    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-default bg-default/85 px-4 backdrop-blur lg:px-8"
      >
        <div class="flex min-w-0 items-center gap-3">
          <LogoZenda compacto class="lg:hidden" />
          <div class="min-w-0">
            <h1 class="truncate text-lg font-bold text-highlighted">
              {{ titulo }}
            </h1>
            <p class="truncate text-xs text-muted xl:hidden">{{ sesion.negocio?.nombre }}</p>
          </div>
        </div>
        <IndicadorConexion :estado="conexion.estado" />
      </header>

      <!-- Espacio abajo en el celular para que la navegación no tape el contenido. -->
      <main class="flex-1 px-4 pt-6 pb-28 lg:px-8 lg:pb-10">
        <slot />
      </main>
    </div>

    <NavegacionInferior :secciones="secciones" :insignias="insignias" class="lg:hidden" />
  </div>
</template>
