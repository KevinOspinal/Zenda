<!--
  Contadores que también filtran, por ejemplo las cuentas activas, bloqueadas e inactivas.
  Tocar uno muestra solo esos y tocarlo otra vez los muestra todos; uno en cero no filtra.
  Cada contador tiene ícono, número y nombre (el color nunca va solo). Los números se animan
  al cambiar y el ícono de los que piden atención (`latir`) late mientras haya alguno.
  En un espacio angosto (celular), el ícono va arriba del número para que quepan tres.
-->
<script setup>
/**
 * @typedef {object} Contador
 * @property {string} clave
 * @property {string} etiqueta Nombre en plural: "Bloqueados".
 * @property {string} icono
 * @property {'success' | 'warning' | 'error' | 'neutral' | 'info' | 'primary'} color
 * @property {number} cantidad
 * @property {boolean} [latir] Pide atención mientras haya alguno.
 */

const props = defineProps({
  contadores: {
    type: /** @type {import('vue').PropType<Contador[]>} */ (Array),
    required: true,
  },
  /** Para lectores de pantalla: "Filtrar las cuentas". */
  etiqueta: { type: String, required: true },
});

/** Clave elegida, o null para ver todos. */
const filtro = defineModel({
  type: /** @type {import('vue').PropType<string | null>} */ (String),
  default: null,
});

// Colores de cada contador. Clases completas para que Tailwind las encuentre.
const ESTILO = Object.freeze({
  success: { icono: 'bg-success/10 text-success', elegido: 'border-success bg-success/10' },
  warning: { icono: 'bg-warning/10 text-warning', elegido: 'border-warning bg-warning/10' },
  error: { icono: 'bg-error/10 text-error', elegido: 'border-error bg-error/10' },
  info: { icono: 'bg-info/10 text-info', elegido: 'border-info bg-info/10' },
  primary: { icono: 'bg-primary/10 text-primary', elegido: 'border-primary bg-primary/10' },
  neutral: { icono: 'bg-elevated text-toned', elegido: 'border-inverted/40 bg-elevated' },
});

// Columnas según cuántos contadores hay (clases completas para Tailwind).
const COLUMNAS = Object.freeze({
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2 @2xl:grid-cols-4',
});
const columnas = computed(
  () => COLUMNAS[/** @type {2 | 3 | 4} */ (props.contadores.length)] ?? 'grid-cols-2',
);

/** @param {string} clave */
function alternar(clave) {
  filtro.value = filtro.value === clave ? null : clave;
}
</script>

<template>
  <div class="@container">
    <div class="grid gap-2" :class="columnas" role="group" :aria-label="etiqueta">
      <button
        v-for="contador in contadores"
        :key="contador.clave"
        type="button"
        class="flex min-h-16 flex-col items-start gap-2 rounded-xl border p-3 text-left transition-[background-color,border-color,scale] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary enabled:active:scale-[0.97] disabled:opacity-60 motion-reduce:transition-none @lg:flex-row @lg:items-center @lg:gap-2.5"
        :class="
          filtro === contador.clave
            ? ESTILO[contador.color].elegido
            : 'border-default bg-default enabled:hover:bg-elevated/60'
        "
        :aria-pressed="filtro === contador.clave"
        :disabled="contador.cantidad === 0 && filtro !== contador.clave"
        @click="alternar(contador.clave)"
      >
        <span
          class="grid size-8 shrink-0 place-items-center rounded-full @lg:size-9"
          :class="ESTILO[contador.color].icono"
        >
          <UIcon
            :name="contador.icono"
            class="size-4.5 @lg:size-5"
            :class="contador.latir && contador.cantidad > 0 && 'motion-safe:animate-latido'"
          />
        </span>
        <span class="min-w-0">
          <NumeroAnimado
            :valor="contador.cantidad"
            class="block text-2xl leading-none font-bold text-highlighted"
          />
          <span class="mt-1 block truncate text-xs leading-tight font-medium text-muted">{{
            contador.etiqueta
          }}</span>
        </span>
      </button>
    </div>
  </div>
</template>
