<!--
  Vista rápida de una cuenta, al lado de la lista (tablet horizontal y PC): la lista sigue a la
  vista y tocar otra cuenta cambia lo que se ve aquí. Arriba, el avatar, el nombre y el
  correo; en el centro, el detalle (DetalleUsuario); abajo, las acciones (AccionesDeCuenta),
  que hace la página.
-->
<script setup>
/** @typedef {import('~/utils/usuarios.js').Cuenta} Cuenta */

const props = defineProps({
  cuenta: { type: /** @type {import('vue').PropType<Cuenta>} */ (Object), required: true },
  estado: {
    type: /** @type {import('vue').PropType<import('~/utils/usuarios.js').EstadoCuenta>} */ (
      String
    ),
    required: true,
  },
  finBloqueo: { type: /** @type {import('vue').PropType<Date | null>} */ (Date), default: null },
  propia: { type: Boolean, default: false },
  /** Ver permisosSobreCuenta. */
  permisos: {
    type: /** @type {import('vue').PropType<ReturnType<typeof permisosSobreCuenta>>} */ (Object),
    required: true,
  },
});

const emit = defineEmits({
  cerrar: () => true,
  editar: () => true,
  restablecer: () => true,
  cambiarAcceso: () => true,
});

const rol = computed(() => ROLES[props.cuenta.rol]);
</script>

<template>
  <!-- Alto máximo: la pantalla menos el encabezado y la explicación de arriba, para que las
       acciones siempre se vean sin bajar. -->
  <aside
    class="flex max-h-[calc(100dvh-9.5rem)] flex-col overflow-hidden rounded-2xl border border-default bg-default shadow-xl"
    :aria-label="`Vista rápida de ${cuenta.nombre}`"
  >
    <header class="flex items-start gap-3 border-b border-default p-4">
      <AvatarCuenta :nombre="cuenta.nombre" :rol="cuenta.rol" :estado="estado" tamano="xl" />
      <div class="min-w-0 flex-1 pt-1">
        <h2 class="flex items-center gap-2 text-xl leading-tight font-bold text-highlighted">
          <span class="truncate">{{ cuenta.nombre }}</span>
          <UBadge
            v-if="propia"
            color="primary"
            variant="solid"
            size="sm"
            label="Tú"
            class="shrink-0 rounded-full"
          />
        </h2>
        <p class="mt-1 flex items-center gap-1.5 truncate text-sm text-muted">
          <UIcon :name="rol.icono" class="size-4 shrink-0" />
          {{ rol.etiqueta }}
        </p>
      </div>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="lg"
        aria-label="Cerrar la vista rápida"
        @click="emit('cerrar')"
      />
    </header>

    <div class="flex-1 overflow-y-auto p-4">
      <DetalleUsuario
        :cuenta="cuenta"
        :estado="estado"
        :fin-bloqueo="finBloqueo"
        :motivo="permisos.motivo"
      />
    </div>

    <footer
      v-if="permisos.editar || permisos.restablecer || permisos.cambiarAcceso"
      class="border-t border-default p-4"
    >
      <AccionesDeCuenta
        :permisos="permisos"
        :activa="cuenta.activo"
        @editar="emit('editar')"
        @restablecer="emit('restablecer')"
        @cambiar-acceso="emit('cambiarAcceso')"
      />
    </footer>
  </aside>
</template>
