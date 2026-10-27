<!--
  Tarjeta de un indicador del periodo: título, cifra grande (con animación si es dinero) y
  un detalle opcional debajo. La primera del tablero se muestra destacada.
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
</script>

<template>
  <div
    class="flex flex-col gap-2 rounded-xl p-4 ring-1"
    :class="destacada ? 'bg-primary/10 ring-primary/30' : 'bg-default ring-default'"
  >
    <p class="flex items-center gap-2 text-sm font-medium text-muted">
      <UIcon :name="icono" class="size-4" :class="destacada ? 'text-primary' : ''" />
      {{ titulo }}
    </p>
    <CifraAnimada
      v-if="valor"
      :valor="valor"
      class="font-bold tracking-tight text-highlighted"
      :class="destacada ? 'text-4xl' : 'text-2xl'"
    />
    <p v-else class="cifra text-2xl font-bold tracking-tight text-highlighted">{{ texto }}</p>
    <p v-if="detalle" class="text-sm text-muted">{{ detalle }}</p>
  </div>
</template>
