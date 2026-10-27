<!--
  Muestrario: todos los estados del negocio con su color, ícono y etiqueta
  (temporal, Fase 0). Vienen de utils/estados.js, igual que en la app real.
-->
<script setup>
/** Comandas de ejemplo con distintos tiempos de espera. */
const ESPERAS = [6, 14, 26];

/** Resultados de arqueo de ejemplo: cuadra, sobra y falta. */
const ARQUEOS = ['0', '2000', '-500'];

// Clases del tiempo de espera según la urgencia (completas para Tailwind).
const CLASES_URGENCIA = Object.freeze({
  normal: 'bg-elevated text-toned ring-default',
  atencion: 'bg-warning/10 text-warning ring-warning/40',
  urgente: 'bg-error/10 text-error ring-error/50',
});

const metodoElegido = ref('efectivo');
</script>

<template>
  <SeccionMuestrario
    id="estados"
    titulo="Estados"
    descripcion="Cada estado tiene siempre el mismo color, ícono y palabra en todas las pantallas."
  >
    <div class="grid gap-4 md:grid-cols-2">
      <div class="space-y-3 rounded-xl bg-default p-5 ring-1 ring-default">
        <p class="text-sm font-semibold text-muted">Platos en la cocina</p>
        <div class="flex flex-wrap gap-2">
          <ChipEstado
            v-for="(apariencia, estado) in ESTADOS_COCINA"
            :key="estado"
            :apariencia="apariencia"
            tamano="lg"
          />
        </div>
        <p class="pt-2 text-sm font-semibold text-muted">Pedidos</p>
        <div class="flex flex-wrap gap-2">
          <ChipEstado
            v-for="(apariencia, estado) in ESTADOS_PEDIDO"
            :key="estado"
            :apariencia="apariencia"
            tamano="lg"
          />
        </div>
      </div>

      <div class="space-y-3 rounded-xl bg-default p-5 ring-1 ring-default">
        <p class="text-sm font-semibold text-muted">Tiempo de espera de una comanda</p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="minutos in ESPERAS"
            :key="minutos"
            class="cifra inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-lg font-bold ring-1"
            :class="[
              CLASES_URGENCIA[urgenciaDeEspera(minutos).nivel],
              urgenciaDeEspera(minutos).late && 'motion-safe:animate-pulse',
            ]"
          >
            <UIcon name="i-lucide-timer" class="size-5" />
            {{ duracionCorta(minutos) }}
          </span>
        </div>
        <p class="text-xs text-muted">
          Menos de {{ MINUTOS_ATENCION }} min: normal · de {{ MINUTOS_ATENCION }} a
          {{ MINUTOS_URGENTE }}: atención · más de {{ MINUTOS_URGENTE }}: urgente.
        </p>

        <p class="pt-2 text-sm font-semibold text-muted">Arqueo de caja</p>
        <div class="flex flex-wrap gap-2">
          <ChipEstado
            v-for="diferencia in ARQUEOS"
            :key="diferencia"
            :apariencia="aparienciaDeArqueo(diferencia)"
            tamano="lg"
            variante="soft"
          />
        </div>
      </div>
    </div>

    <div class="space-y-3 rounded-xl bg-default p-5 ring-1 ring-default">
      <p class="text-sm font-semibold text-muted">Métodos de pago (así se eligen al cobrar)</p>
      <div
        class="grid grid-cols-2 gap-3 sm:grid-cols-4"
        role="radiogroup"
        aria-label="Método de pago"
      >
        <button
          v-for="(metodo, clave) in METODOS_PAGO"
          :key="clave"
          type="button"
          role="radio"
          :aria-checked="metodoElegido === clave"
          class="flex flex-col items-center gap-2 rounded-xl p-4 font-semibold ring-1 transition active:scale-[0.98] motion-reduce:transition-none"
          :class="
            metodoElegido === clave
              ? 'bg-primary/10 text-primary ring-2 ring-primary'
              : 'bg-default text-toned ring-default hover:ring-accented'
          "
          @click="metodoElegido = clave"
        >
          <UIcon :name="metodo.icono" class="size-8" />
          {{ metodo.etiqueta }}
        </button>
      </div>
    </div>
  </SeccionMuestrario>
</template>
