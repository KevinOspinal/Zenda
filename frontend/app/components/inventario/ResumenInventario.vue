<!--
  Contadores del inventario: por revisar (stock negativo), agotados, stock bajo y con stock
  (ver ESTADOS_STOCK). Cada contador es también un filtro: tocarlo muestra solo esos productos y
  tocarlo otra vez los muestra todos. Un contador en cero no filtra.
  Los números se animan al cambiar; el ícono de "por revisar" late mientras haya alguno.
-->
<script setup>
defineProps({
  /** Cuántos productos hay en cada estado (ver conteoPorEstado). */
  conteo: {
    type: /** @type {import('vue').PropType<Record<import('~/utils/inventario.js').EstadoStock, number>>} */ (
      Object
    ),
    required: true,
  },
});

/** Estado elegido, o null para ver todos los productos. */
const filtro = defineModel({
  type: /** @type {import('vue').PropType<import('~/utils/inventario.js').EstadoStock | null>} */ (
    String
  ),
  default: null,
});

// Colores de cada estado. Clases completas para que Tailwind las encuentre.
const ESTILO = Object.freeze({
  error: { icono: 'bg-error/10 text-error', elegido: 'border-error bg-error/10' },
  neutral: { icono: 'bg-elevated text-toned', elegido: 'border-inverted/40 bg-elevated' },
  warning: { icono: 'bg-warning/10 text-warning', elegido: 'border-warning bg-warning/10' },
  success: { icono: 'bg-success/10 text-success', elegido: 'border-success bg-success/10' },
});

/** @param {import('~/utils/inventario.js').EstadoStock} clave */
function alternar(clave) {
  filtro.value = filtro.value === clave ? null : clave;
}
</script>

<template>
  <!-- Las columnas dependen del ancho que le queda (se angosta cuando se abre la vista rápida). -->
  <div class="@container">
    <div
      class="grid grid-cols-2 gap-2 @2xl:grid-cols-4"
      role="group"
      aria-label="Filtrar el inventario"
    >
      <button
        v-for="(datos, clave) in ESTADOS_STOCK"
        :key="clave"
        type="button"
        class="flex min-h-16 items-center gap-2.5 rounded-xl border p-3 text-left transition-[background-color,border-color,scale] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary enabled:active:scale-[0.97] disabled:opacity-60 motion-reduce:transition-none"
        :class="
          filtro === clave
            ? ESTILO[/** @type {keyof typeof ESTILO} */ (datos.color)].elegido
            : 'border-default bg-default enabled:hover:bg-elevated/60'
        "
        :aria-pressed="filtro === clave"
        :disabled="conteo[clave] === 0 && filtro !== clave"
        @click="alternar(clave)"
      >
        <span
          class="grid size-9 shrink-0 place-items-center rounded-full"
          :class="ESTILO[/** @type {keyof typeof ESTILO} */ (datos.color)].icono"
        >
          <UIcon
            :name="datos.icono"
            class="size-5"
            :class="clave === 'revisar' && conteo.revisar > 0 && 'motion-safe:animate-latido'"
          />
        </span>
        <span class="min-w-0">
          <NumeroAnimado
            :valor="conteo[clave]"
            class="block text-2xl leading-none font-bold text-highlighted"
          />
          <span class="mt-1 block text-xs leading-tight font-medium text-muted">{{
            datos.plural
          }}</span>
        </span>
      </button>
    </div>
  </div>
</template>
