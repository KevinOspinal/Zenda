<!--
  Un cliente en la lista, como en la agenda del celular: sus iniciales en su color (siempre el
  mismo), el nombre y el documento con puntos, con lo buscado resaltado. Si no tiene correo,
  lo dice con ícono y texto (la factura electrónica no le llegaría).

  Toda la fila abre su ficha (el nombre es un botón que la cubre entera). La elegida se marca
  con una barra a la izquierda; la que se acaba de guardar, con una onda.
-->
<script setup>
/** @typedef {import('~/stores/clientes.js').Cliente} Cliente */

const props = defineProps({
  cliente: { type: /** @type {import('vue').PropType<Cliente>} */ (Object), required: true },
  busqueda: { type: String, default: '' },
  resaltado: { type: Boolean, default: false },
  seleccionado: { type: Boolean, default: false },
});

const emit = defineEmits({
  /** @param {Cliente} _cliente */
  seleccionar: (_cliente) => true,
});

const preferencias = usePreferenciasStore();
const { vibrate, isSupported: puedeVibrar } = useVibrate({ pattern: [12] });

const tipo = computed(() => TIPOS_DE_DOCUMENTO[props.cliente.tipoDocumento]);
const partesDocumento = computed(() =>
  partesDelDocumento(props.cliente.tipoDocumento, props.cliente.numeroDocumento, props.busqueda),
);

/** Para lectores de pantalla: "Pedro Gómez, CC 1.234.567.890, sin correo". */
const descripcionAccesible = computed(() =>
  [
    props.cliente.nombre,
    etiquetaDeDocumento(props.cliente),
    props.cliente.email ? null : 'sin correo',
  ]
    .filter(Boolean)
    .join(', '),
);

function tocar() {
  if (preferencias.vibracion && puedeVibrar.value) vibrate();
  emit('seleccionar', props.cliente);
}
</script>

<template>
  <li
    class="relative flex items-center gap-3 px-4 py-3 transition-colors duration-150 has-[.principal:active]:bg-elevated hover:bg-elevated/50"
    :class="seleccionado && 'bg-primary/5 hover:bg-primary/5'"
    :aria-current="seleccionado || undefined"
  >
    <!-- Barra de la elegida y onda de la recién guardada. -->
    <span
      v-if="seleccionado"
      aria-hidden="true"
      class="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary"
    />
    <span
      v-if="resaltado"
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 ring-2 ring-primary ring-inset motion-safe:animate-onda"
    />

    <AvatarIniciales :nombre="cliente.nombre" :tono="tonoDeTexto(cliente.id)" tamano="md" />

    <div class="min-w-0 flex-1">
      <p class="truncate font-semibold text-highlighted">
        <!-- Botón que cubre la fila entera (su ::after): tocar en cualquier lado la abre. -->
        <button
          type="button"
          class="principal text-left after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-primary"
          :aria-label="descripcionAccesible"
          @click="tocar"
        >
          <TextoResaltado :texto="cliente.nombre" :busqueda="busqueda" />
        </button>
      </p>
      <p class="cifra truncate text-sm text-muted">
        <!-- Espacio que no se parte: la sigla siempre queda junto al número. -->
        <span class="font-medium text-toned">{{ tipo.sigla }}&nbsp;</span>
        <TextoResaltado :partes="partesDocumento" />
      </p>
    </div>

    <span
      v-if="!cliente.email"
      class="inline-flex shrink-0 items-center gap-1 rounded-md bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-warning"
    >
      <UIcon name="i-lucide-mail-x" class="size-3.5" />
      <span class="hidden @md:inline">Sin correo</span>
      <span class="sr-only @md:hidden">Sin correo</span>
    </span>
    <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed lg:hidden" />
  </li>
</template>
