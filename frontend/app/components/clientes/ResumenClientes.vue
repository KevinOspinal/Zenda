<!--
  Lo que se ve a la derecha de la lista (tablet horizontal y PC) mientras no hay un cliente
  elegido: la invitación a elegir uno y cuántos clientes tienen correo, porque sin correo la
  factura electrónica no les llega. Desde aquí se puede ver solo a los que no lo tienen.
-->
<script setup>
const props = defineProps({
  /** Cuántos clientes se conocen. */
  total: { type: Number, required: true },
  /** Cuántos de ellos no tienen correo. */
  sinCorreo: { type: Number, required: true },
  /** Si la lista ya muestra solo a los que no tienen correo. */
  filtrando: { type: Boolean, default: false },
  /** Si hay más clientes que los de la lista (el API envía 50 por vez). */
  parcial: { type: Boolean, default: false },
});

const emit = defineEmits({
  /** @param {boolean} _soloSinCorreo */
  filtrar: (_soloSinCorreo) => true,
});

const conCorreo = computed(() => props.total - props.sinCorreo);
const porcentaje = computed(() =>
  props.total ? Math.round((conCorreo.value / props.total) * 100) : 0,
);

const avisoSinCorreo = computed(() =>
  props.sinCorreo === 1
    ? 'A 1 cliente no le llega la factura electrónica: pídele el correo cuando vuelva.'
    : `A ${props.sinCorreo} clientes no les llega la factura electrónica: pídeles el correo cuando vuelvan.`,
);

// La barra arranca vacía y se llena al aparecer.
const llena = ref(false);
onMounted(() => requestAnimationFrame(() => (llena.value = true)));
</script>

<template>
  <aside
    aria-label="Resumen de los clientes"
    class="rounded-2xl border border-dashed border-accented bg-default/60 p-6"
  >
    <div class="text-center">
      <span
        aria-hidden="true"
        class="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary"
      >
        <UIcon name="i-lucide-contact" class="size-7" />
      </span>
      <h2 class="mt-3 text-lg font-semibold text-highlighted">Elige un cliente</h2>
      <p class="mt-1 text-sm text-pretty text-muted">
        Verás a qué correo le llega la factura, cómo contactarlo y su documento.
      </p>
    </div>

    <div v-if="total" class="mt-6 space-y-3 rounded-xl bg-elevated/60 p-4">
      <div class="flex items-baseline justify-between gap-3">
        <p id="medidor-correo" class="text-sm font-medium text-toned">Con correo para la factura</p>
        <p class="cifra shrink-0 text-sm font-semibold text-highlighted">
          {{ conCorreo }} de {{ total }}
        </p>
      </div>
      <div
        role="meter"
        aria-labelledby="medidor-correo"
        aria-valuemin="0"
        :aria-valuemax="total"
        :aria-valuenow="conCorreo"
        :aria-valuetext="`${conCorreo} de ${total} clientes tienen correo`"
        class="h-2 overflow-hidden rounded-full bg-accented"
      >
        <div
          class="h-full rounded-full bg-success transition-[width] duration-700 ease-out motion-reduce:transition-none"
          :style="{ width: `${llena ? porcentaje : 0}%` }"
        />
      </div>

      <p v-if="sinCorreo" class="flex items-start gap-1.5 text-sm text-muted">
        <UIcon name="i-lucide-mail-x" class="mt-0.5 size-4 shrink-0 text-warning" />
        <span>{{ avisoSinCorreo }}</span>
      </p>
      <p v-else class="flex items-center gap-1.5 text-sm text-muted">
        <UIcon name="i-lucide-mail-check" class="size-4 shrink-0 text-success" />
        Todos reciben la factura por correo.
      </p>

      <UButton
        v-if="sinCorreo"
        block
        color="neutral"
        variant="outline"
        :icon="filtrando ? 'i-lucide-users' : 'i-lucide-mail-x'"
        :label="filtrando ? 'Ver a todos' : `Ver solo los ${sinCorreo} sin correo`"
        @click="emit('filtrar', !filtrando)"
      />
      <p v-if="parcial" class="text-xs text-dimmed">Cuenta solo los clientes de la lista.</p>
    </div>

    <p class="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted">
      Para buscar, oprime <UKbd value="/" />
    </p>
  </aside>
</template>
