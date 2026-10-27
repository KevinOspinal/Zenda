<!--
  Muestrario: cómo responde la app (temporal, Fase 0): avisos, carga, estados vacíos,
  conexión y la confirmación de una acción que no se puede deshacer.
-->
<script setup>
const toast = useToast();

/** Ejemplos de avisos: éxito, error con reintento, deshacer y aviso en vivo. */
const AVISOS = Object.freeze([
  {
    boton: 'Éxito',
    color: 'success',
    aviso: {
      title: 'Pedido enviado a cocina',
      description: 'Mesa 4',
      icon: 'i-lucide-circle-check',
      color: 'success',
    },
  },
  {
    boton: 'Error',
    color: 'error',
    aviso: {
      title: 'No se pudo guardar',
      description: MENSAJE_SIN_CONEXION,
      icon: 'i-lucide-wifi-off',
      color: 'error',
      actions: [
        { label: 'Reintentar', icon: 'i-lucide-rotate-cw', color: 'error', variant: 'outline' },
      ],
    },
  },
  {
    boton: 'Deshacer',
    color: 'neutral',
    aviso: {
      title: 'Quitaste 1 IND Classic Artesanal',
      icon: 'i-lucide-trash-2',
      color: 'neutral',
      actions: [
        { label: 'Deshacer', icon: 'i-lucide-undo-2', color: 'neutral', variant: 'outline' },
      ],
    },
  },
  {
    boton: 'Aviso en vivo',
    color: 'info',
    aviso: {
      title: '¡Listo para llevar!',
      description: 'Terraza 1 · La Texana 2P',
      icon: 'i-lucide-bell-ring',
      color: 'info',
    },
  },
]);

const cargando = ref(true);

// Confirmación de una acción irreversible: anular un pedido exige un motivo.
const confirmacionAbierta = ref(false);
const MOTIVOS = ['El cliente se fue', 'Pedido duplicado', 'Error al tomar el pedido'];
const motivo = ref('');
function anular() {
  confirmacionAbierta.value = false;
  toast.add({
    title: 'Pedido anulado',
    description: `Motivo: ${motivo.value}`,
    icon: 'i-lucide-ban',
    color: 'error',
  });
  motivo.value = '';
}
</script>

<template>
  <SeccionMuestrario
    id="respuestas"
    titulo="Respuestas de la app"
    descripcion="Toda acción tiene respuesta visible: avisos claros, carga con la forma del contenido, estados vacíos que dicen qué hacer y confirmación solo para lo que no se puede deshacer."
  >
    <div class="grid gap-4 md:grid-cols-2">
      <div class="space-y-3 rounded-xl bg-default p-5 ring-1 ring-default">
        <p class="text-sm font-semibold text-muted">Avisos (toca para verlos)</p>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="ejemplo in AVISOS"
            :key="ejemplo.boton"
            :label="ejemplo.boton"
            :color="ejemplo.color"
            variant="soft"
            size="lg"
            @click="toast.add(ejemplo.aviso)"
          />
        </div>
        <p class="pt-2 text-sm font-semibold text-muted">Conexión</p>
        <div class="flex flex-wrap gap-2">
          <IndicadorConexion estado="en_vivo" />
          <IndicadorConexion estado="reconectando" />
          <IndicadorConexion estado="sin_conexion" />
        </div>
        <p class="pt-2 text-sm font-semibold text-muted">Acción que no se puede deshacer</p>
        <UButton
          color="error"
          variant="soft"
          size="lg"
          icon="i-lucide-ban"
          label="Anular pedido"
          @click="confirmacionAbierta = true"
        />
      </div>

      <div class="space-y-3 rounded-xl bg-default p-5 ring-1 ring-default">
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm font-semibold text-muted">Cargando (con la forma del contenido)</p>
          <USwitch v-model="cargando" label="Simular carga" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <template v-if="cargando">
            <USkeleton v-for="n in 4" :key="n" class="h-32 rounded-xl" />
          </template>
          <template v-else>
            <TarjetaMesa :mesa="{ id: 'a', nombre: 'Mesa 1', capacidad: 4, estado: 'libre' }" />
            <TarjetaMesa
              :mesa="{ id: 'b', nombre: 'Mesa 2', capacidad: 2, estado: 'ocupada' }"
              :minutos-abierta="12"
              total="24000"
            />
            <TarjetaMesa :mesa="{ id: 'c', nombre: 'Mesa 3', capacidad: 4, estado: 'libre' }" />
            <TarjetaMesa :mesa="{ id: 'd', nombre: 'Mesa 4', capacidad: 6, estado: 'libre' }" />
          </template>
        </div>
      </div>
    </div>

    <UEmpty
      variant="outline"
      icon="i-lucide-armchair"
      title="Aún no hay mesas"
      description="Crea la primera para empezar a tomar pedidos."
      :actions="[{ label: 'Crear mesa', icon: 'i-lucide-plus', size: 'lg' }]"
    />

    <UModal
      v-model:open="confirmacionAbierta"
      title="¿Anular el pedido de la Mesa 4?"
      description="Se devuelve el inventario y el pedido sale del resumen de caja. Queda registrado en la auditoría."
    >
      <template #body>
        <UFormField label="Motivo" required>
          <div class="mb-3 flex flex-wrap gap-2">
            <UButton
              v-for="sugerido in MOTIVOS"
              :key="sugerido"
              :label="sugerido"
              color="neutral"
              :variant="motivo === sugerido ? 'solid' : 'outline'"
              @click="motivo = sugerido"
            />
          </div>
          <UInput v-model="motivo" size="xl" class="w-full" placeholder="Escribe el motivo" />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            size="lg"
            label="Volver"
            @click="confirmacionAbierta = false"
          />
          <UButton
            color="error"
            size="lg"
            icon="i-lucide-ban"
            label="Anular pedido"
            :disabled="motivo.trim().length < 3"
            @click="anular"
          />
        </div>
      </template>
    </UModal>
  </SeccionMuestrario>
</template>
