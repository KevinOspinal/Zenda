<!--
  Aviso temporal para las secciones que todavía no se construyen: qué tendrá la sección y
  en qué fase llega. Se reemplaza por la pantalla real en su fase.
-->
<script setup>
const props = defineProps({
  /** Id de la sección (utils/roles.js): de ahí salen el ícono y el título. */
  seccion: { type: String, default: '' },
  /** Para pantallas que no son una sección del menú (por ejemplo, la cocina). */
  icono: { type: String, default: '' },
  titulo: { type: String, default: '' },
  /** Fase del plan en la que llega la pantalla real. */
  fase: { type: Number, required: true },
  /** Qué tendrá la pantalla. */
  descripcion: { type: String, required: true },
});

const datosSeccion = computed(() => SECCIONES.find((s) => s.id === props.seccion));
</script>

<template>
  <div class="grid min-h-[60vh] place-items-center">
    <div class="max-w-md space-y-4 text-center">
      <UEmpty
        variant="naked"
        size="lg"
        :icon="icono || datosSeccion?.icono"
        :title="titulo || datosSeccion?.etiqueta"
        :description="descripcion"
      />
      <UBadge
        color="primary"
        variant="subtle"
        size="lg"
        icon="i-lucide-hammer"
        :label="`Llega en la Fase ${fase}`"
      />
    </div>
  </div>
</template>
