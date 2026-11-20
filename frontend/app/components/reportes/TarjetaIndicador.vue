<!--
  Tarjeta de un indicador del periodo: título, cifra grande (con animación si es dinero) y
  un detalle opcional debajo. La primera del tablero se muestra destacada.
  La cifra nunca se parte ni se sale: su tamaño depende del ancho de la tarjeta (consulta de
  contenedor), así cabe "$ 31.555.000" aunque la tarjeta sea angosta.
-->
<script setup>
defineProps({
  titulo: { type: String, required: true },
  icono: { type: String, required: true },
  /** Valor en pesos (texto del API). Si no es dinero, usar `texto`. */
  valor: { type: String, default: '' },
  /** Valor que no es dinero, ya formateado (por ejemplo, "12 ventas"). */
  texto: { type: String, default: '' },
  detalle: { type: String, default: '' },
  destacada: { type: Boolean, default: false },
});

// Tamaño de la cifra según el ancho de la tarjeta (clases completas para que Tailwind las vea).
const TAMANO_DESTACADA = 'text-3xl @[17rem]:text-4xl';
const TAMANO_NORMAL = 'text-lg @[8.5rem]:text-xl @[10rem]:text-2xl';
</script>

<template>
  <div
    class="@container flex min-w-0 flex-col gap-2 rounded-xl p-4 ring-1"
    :class="destacada ? 'bg-primary/10 ring-primary/30' : 'bg-default ring-default'"
  >
    <p class="flex items-center gap-2 text-sm font-medium text-muted">
      <UIcon :name="icono" class="size-4" :class="destacada ? 'text-primary' : ''" />
      {{ titulo }}
    </p>
    <CifraAnimada
      v-if="valor"
      :valor="valor"
      class="font-bold tracking-tight whitespace-nowrap text-highlighted"
      :class="destacada ? TAMANO_DESTACADA : TAMANO_NORMAL"
    />
    <p
      v-else
      class="cifra font-bold tracking-tight whitespace-nowrap text-highlighted"
      :class="TAMANO_NORMAL"
    >
      {{ texto }}
    </p>
    <p v-if="detalle" class="text-sm text-muted">{{ detalle }}</p>
  </div>
</template>
