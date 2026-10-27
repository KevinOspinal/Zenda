<!--
  Muestrario: colores con significado y tipografía de Zenda (temporal, Fase 0).
-->
<script setup>
/** Cada color del tema con su uso. Clases completas para que Tailwind las encuentre. */
const COLORES = Object.freeze([
  { nombre: 'Primario', uso: 'Marca y acción principal', muestra: 'bg-primary' },
  { nombre: 'Secundario', uso: 'Acentos y transferencias', muestra: 'bg-secondary' },
  { nombre: 'Éxito', uso: 'Listo, pagado, cuadra', muestra: 'bg-success' },
  { nombre: 'Información', uso: 'Avisos en vivo', muestra: 'bg-info' },
  { nombre: 'Atención', uso: 'Preparando, ocupada', muestra: 'bg-warning' },
  { nombre: 'Error', uso: 'Anulado, faltante', muestra: 'bg-error' },
  { nombre: 'Neutro', uso: 'Fondos, bordes y textos', muestra: 'bg-neutral-500' },
]);
</script>

<template>
  <SeccionMuestrario
    id="colores"
    titulo="Colores y tipografía"
    descripcion="Verde esmeralda como marca y grises cálidos de fondo. El color siempre significa algo y nunca va solo: lo acompañan un ícono y una palabra."
  >
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      <div
        v-for="color in COLORES"
        :key="color.nombre"
        class="overflow-hidden rounded-xl bg-default ring-1 ring-default"
      >
        <div class="h-16" :class="color.muestra" />
        <div class="space-y-0.5 p-3">
          <p class="text-sm font-semibold text-highlighted">{{ color.nombre }}</p>
          <p class="text-xs text-muted">{{ color.uso }}</p>
        </div>
      </div>
    </div>

    <div class="grid gap-4 rounded-xl bg-elevated/50 p-5 ring-1 ring-default md:grid-cols-2">
      <div class="space-y-2">
        <p class="text-2xl font-bold text-highlighted">Título de pantalla</p>
        <p class="text-lg font-semibold text-highlighted">Título de sección</p>
        <p>Texto normal: la tipografía es Plus Jakarta Sans, moderna y muy legible.</p>
        <p class="text-sm text-muted">Texto de ayuda, más pequeño y suave.</p>
      </div>
      <div class="space-y-1 md:text-right">
        <p class="text-sm font-medium text-muted">Total a cobrar</p>
        <p class="cifra text-5xl font-bold tracking-tight text-highlighted sm:text-6xl">
          {{ formatearPesos('38000') }}
        </p>
        <p class="cifra text-sm text-muted">
          Base {{ formatearPesos('35185.18') }} · INC {{ formatearPesos('2814.82') }}
        </p>
      </div>
    </div>
  </SeccionMuestrario>
</template>
