<!--
  Contadores del mapa de mesas: libres, ocupadas, con platos listos y las que llevan mucho
  esperando la cocina (ver FILTROS_MESAS). Cada contador es también un filtro: tocarlo muestra
  solo esas mesas y tocarlo otra vez las muestra todas. Un contador en cero no filtra.
  Los números se animan al cambiar; la campana se mece mientras haya platos listos.
-->
<script setup>
defineProps({
  /** Cuántas mesas hay en cada filtro (ver conteoPorFiltro). */
  conteo: {
    type: /** @type {import('vue').PropType<Record<import('~/utils/mesas.js').FiltroMesas, number>>} */ (
      Object
    ),
    required: true,
  },
});

/** Filtro elegido, o null para ver todas las mesas. */
const filtro = defineModel({
  type: /** @type {import('vue').PropType<import('~/utils/mesas.js').FiltroMesas | null>} */ (
    String
  ),
  default: null,
});

// Colores de cada filtro. Clases completas para que Tailwind las encuentre.
const ESTILO = Object.freeze({
  success: { icono: 'bg-success/10 text-success', elegido: 'border-success bg-success/10' },
  warning: { icono: 'bg-warning/10 text-warning', elegido: 'border-warning bg-warning/10' },
  info: { icono: 'bg-info/10 text-info', elegido: 'border-info bg-info/10' },
  error: { icono: 'bg-error/10 text-error', elegido: 'border-error bg-error/10' },
});

/** @param {import('~/utils/mesas.js').FiltroMesas} clave */
function alternar(clave) {
  filtro.value = filtro.value === clave ? null : clave;
}
</script>

<template>
  <!-- Las columnas dependen del ancho que le queda (se angosta cuando se abre la vista rápida). -->
  <div class="@container">
    <div class="grid grid-cols-2 gap-2 @2xl:grid-cols-4" role="group" aria-label="Filtrar mesas">
      <button
        v-for="(datos, clave) in FILTROS_MESAS"
        :key="clave"
        type="button"
        class="flex min-h-16 items-center gap-2.5 rounded-xl border p-3 text-left transition-[background-color,border-color,scale] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary enabled:active:scale-[0.97] disabled:opacity-60 motion-reduce:transition-none"
        :class="
          filtro === clave
            ? ESTILO[datos.color].elegido
            : 'border-default bg-default enabled:hover:bg-elevated/60'
        "
        :aria-pressed="filtro === clave"
        :disabled="conteo[clave] === 0 && filtro !== clave"
        @click="alternar(clave)"
      >
        <span
          class="grid size-9 shrink-0 place-items-center rounded-full"
          :class="ESTILO[datos.color].icono"
        >
          <UIcon
            :name="datos.icono"
            class="size-5"
            :class="
              clave === 'listos' && conteo.listos > 0 && 'origin-top motion-safe:animate-campana'
            "
          />
        </span>
        <span class="min-w-0">
          <NumeroAnimado
            :valor="conteo[clave]"
            class="block text-2xl leading-none font-bold text-highlighted"
          />
          <span class="mt-1 block text-xs leading-tight font-medium text-muted">{{
            datos.etiqueta
          }}</span>
        </span>
      </button>
    </div>
  </div>
</template>
