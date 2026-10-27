<!--
  Auditoría (solo el dueño): quién anuló ventas, cambió precios, cerró la caja o ajustó el
  inventario, y cuándo. Se filtra por acción y por fechas. El registro no se puede editar.
-->
<script setup>
definePageMeta({ seccion: 'auditoria' });

const accion = ref('todas');
const desde = ref('');
const hasta = ref('');
const registros = ref(/** @type {any[]} */ ([]));
const cargando = ref(true);
const error = ref('');

const OPCIONES_ACCION = [
  { value: 'todas', label: 'Todas las acciones' },
  ...Object.entries(ACCIONES_AUDITORIA).map(([valor, apariencia]) => ({
    value: valor,
    label: apariencia.etiqueta,
  })),
];

async function cargar() {
  cargando.value = true;
  error.value = '';
  try {
    registros.value = await useApi().get('/auditoria', {
      ...(accion.value !== 'todas' ? { accion: accion.value } : {}),
      ...(desde.value ? { desde: desde.value } : {}),
      ...(hasta.value ? { hasta: hasta.value } : {}),
    });
  } catch (fallo) {
    error.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
  } finally {
    cargando.value = false;
  }
}
cargar();
watch([accion, desde, hasta], cargar);

/** Nombres legibles de los datos que guarda cada registro. */
const NOMBRES_DETALLE = Object.freeze({
  anterior: 'Antes',
  nuevo: 'Ahora',
  motivo: 'Motivo',
  total: 'Total',
  estadoAnterior: 'Estado anterior',
  efectivoEsperado: 'Efectivo esperado',
  montoContado: 'Contado',
  diferencia: 'Diferencia',
  cantidad: 'Cantidad',
  rol: 'Rol',
});

/**
 * Datos del registro listos para mostrar (los objetos anidados se omiten).
 * @param {Record<string, unknown> | null} detalle
 */
function lineasDeDetalle(detalle) {
  return Object.entries(detalle ?? {})
    .filter(([, valor]) => valor !== null && typeof valor !== 'object')
    .map(([clave, valor]) => ({
      nombre: NOMBRES_DETALLE[/** @type {keyof typeof NOMBRES_DETALLE} */ (clave)] ?? clave,
      valor: String(valor),
    }));
}
</script>

<template>
  <div class="space-y-5">
    <div class="grid gap-3 sm:grid-cols-3">
      <USelect
        v-model="accion"
        :items="OPCIONES_ACCION"
        size="lg"
        class="w-full"
        aria-label="Acción"
      />
      <UInput v-model="desde" type="date" size="lg" aria-label="Desde" />
      <UInput v-model="hasta" type="date" size="lg" aria-label="Hasta" />
    </div>

    <div v-if="cargando" class="space-y-2">
      <USkeleton v-for="n in 5" :key="n" class="h-20 rounded-xl" />
    </div>
    <UEmpty
      v-else-if="error"
      icon="i-lucide-circle-alert"
      title="No pudimos cargar la auditoría"
      :description="error"
      :actions="[{ label: 'Reintentar', icon: 'i-lucide-rotate-cw', onClick: cargar }]"
    />
    <UEmpty
      v-else-if="!registros.length"
      icon="i-lucide-shield-check"
      title="No hay registros con estos filtros"
      description="Aquí quedan las acciones sensibles: anulaciones, cambios de precio, cierres de caja."
    />

    <ol v-else class="relative space-y-3 border-s-2 border-default ps-6">
      <li v-for="registro in registros" :key="registro.id" class="relative">
        <span
          class="absolute -start-[2.15rem] top-3 grid size-7 place-items-center rounded-full bg-default ring-2 ring-default"
        >
          <UIcon
            :name="ACCIONES_AUDITORIA[registro.accion]?.icono ?? 'i-lucide-shield-check'"
            class="size-4 text-toned"
          />
        </span>
        <div class="space-y-2 rounded-xl bg-default p-4 ring-1 ring-default">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <ChipEstado
              :apariencia="
                ACCIONES_AUDITORIA[registro.accion] ?? {
                  etiqueta: registro.accion,
                  color: 'neutral',
                  icono: 'i-lucide-shield-check',
                }
              "
            />
            <span class="text-sm text-muted">{{ fechaRelativa(registro.fecha) }}</span>
          </div>
          <p class="text-sm text-toned">
            {{ registro.usuario?.nombre ?? 'Alguien' }}
            <span v-if="registro.usuario?.rol" class="text-muted"
              >({{ ROLES[registro.usuario.rol]?.etiqueta }})</span
            >
          </p>
          <dl
            v-if="lineasDeDetalle(registro.detalle).length"
            class="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2"
          >
            <div
              v-for="linea in lineasDeDetalle(registro.detalle)"
              :key="linea.nombre"
              class="flex gap-2"
            >
              <dt class="text-muted">{{ linea.nombre }}:</dt>
              <dd class="font-medium text-highlighted">{{ linea.valor }}</dd>
            </div>
          </dl>
        </div>
      </li>
    </ol>
  </div>
</template>
