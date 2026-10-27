<!--
  Perfil: quién está en la sesión, preferencias del dispositivo, modo cocina, cambiar la
  contraseña y cerrar sesión.
-->
<script setup>
definePageMeta({ seccion: 'perfil' });

const sesion = useSesionStore();
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6">
    <!-- Quién está en la sesión. -->
    <section class="flex items-center gap-4 rounded-xl bg-default p-5 ring-1 ring-default">
      <UAvatar :alt="sesion.usuario?.nombre" size="3xl" />
      <div class="min-w-0 flex-1 space-y-1.5">
        <p class="truncate text-lg font-bold text-highlighted">{{ sesion.usuario?.nombre }}</p>
        <p class="truncate text-sm text-muted">{{ sesion.usuario?.email }}</p>
        <div class="flex flex-wrap gap-2">
          <UBadge
            v-if="sesion.rol"
            color="primary"
            variant="subtle"
            :icon="ROLES[sesion.rol].icono"
            :label="ROLES[sesion.rol].etiqueta"
          />
          <UBadge
            color="neutral"
            variant="subtle"
            icon="i-lucide-store"
            :label="sesion.negocio?.nombre ?? ''"
          />
        </div>
      </div>
    </section>

    <PreferenciasDispositivo />

    <!-- Convertir este equipo en la pantalla de la cocina. -->
    <section
      class="flex flex-col gap-4 rounded-xl bg-default p-5 ring-1 ring-default sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <h2 class="text-lg font-semibold text-highlighted">Pantalla de cocina</h2>
        <p class="text-sm text-muted">
          Convierte este dispositivo en el tablero de comandas de la cocina.
        </p>
      </div>
      <UButton
        v-if="puede(sesion.rol, 'prepararPlatos')"
        to="/cocina"
        size="lg"
        icon="i-lucide-chef-hat"
        label="Usar como cocina"
      />
    </section>

    <FormularioContrasena />

    <UButton
      color="error"
      variant="soft"
      size="xl"
      block
      icon="i-lucide-log-out"
      label="Cerrar sesión"
      @click="sesion.salir()"
    />
  </div>
</template>
