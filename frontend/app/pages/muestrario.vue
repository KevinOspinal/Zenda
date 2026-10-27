<!--
  Muestrario visual de la Fase 0: reúne colores, botones, mesas, toma de pedido, estados y
  respuestas de la app para aprobar el estilo antes de construir las pantallas reales.
  Es temporal: se elimina (con components/muestrario/) cuando empiecen las pantallas.
-->
<script setup>
useHead({ title: 'Muestrario · Zenda' });

const SECCIONES = Object.freeze([
  { id: 'colores', etiqueta: 'Colores' },
  { id: 'botones', etiqueta: 'Botones' },
  { id: 'mesas', etiqueta: 'Mesas' },
  { id: 'pedido', etiqueta: 'Pedido' },
  { id: 'estados', etiqueta: 'Estados' },
  { id: 'respuestas', etiqueta: 'Respuestas' },
]);
</script>

<template>
  <div class="min-h-dvh bg-default">
    <header class="sticky top-0 z-20 border-b border-default bg-default/85 backdrop-blur">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <NuxtLink to="/" aria-label="Ir al inicio">
          <LogoZenda />
        </NuxtLink>
        <div class="flex items-center gap-2">
          <IndicadorConexion estado="en_vivo" class="hidden sm:inline-flex" />
          <UColorModeButton size="lg" />
        </div>
      </div>
      <nav
        aria-label="Secciones del muestrario"
        class="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3"
      >
        <UButton
          v-for="seccion in SECCIONES"
          :key="seccion.id"
          :to="`#${seccion.id}`"
          :label="seccion.etiqueta"
          size="md"
          color="neutral"
          variant="soft"
          class="shrink-0"
        />
      </nav>
    </header>

    <main class="mx-auto max-w-6xl space-y-14 px-4 py-8 sm:py-10">
      <div class="space-y-3">
        <UBadge
          color="primary"
          variant="subtle"
          size="lg"
          icon="i-lucide-sparkles"
          label="Fase 0"
        />
        <h1 class="text-3xl font-bold tracking-tight text-highlighted sm:text-4xl">
          Así se verá Zenda
        </h1>
        <p class="max-w-2xl text-lg text-muted">
          Toca las tarjetas, agrega productos, envía un pedido a cocina, simula eventos en vivo y
          prueba el modo oscuro con el botón de arriba. Revísalo en el celular y en el computador.
        </p>
      </div>

      <MuestrarioColores />
      <MuestrarioBotones />
      <MuestrarioMesas />
      <MuestrarioPedido />
      <MuestrarioEstados />
      <MuestrarioRespuestas />
    </main>
  </div>
</template>
