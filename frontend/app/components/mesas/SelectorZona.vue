<!--
  Zonas del mapa como un control segmentado: un fondo de color marca la zona elegida y se
  desliza de una a otra al cambiar. Si no caben, se desplazan de lado y la elegida se trae a
  la vista.
-->
<script setup>
const props = defineProps({
  /** Nombres de las zonas, empezando por "Todas". */
  zonas: { type: /** @type {import('vue').PropType<string[]>} */ (Array), required: true },
});

const zona = defineModel({ type: String, required: true });

const contenedor = useTemplateRef('contenedor');
const botones = useTemplateRef('botones');

/** Posición y ancho del fondo que marca la zona elegida. */
const marca = ref({ x: 0, ancho: 0 });

/** Botón de la zona elegida. */
function botonElegido() {
  const lista = /** @type {HTMLElement[] | null} */ (botones.value);
  return lista?.[props.zonas.indexOf(zona.value)] ?? null;
}

/** Mide el botón de la zona elegida para mover el fondo hasta él. */
function medir() {
  const boton = botonElegido();
  if (boton) marca.value = { x: boton.offsetLeft, ancho: boton.offsetWidth };
}

/** Si la zona elegida quedó fuera de la vista (muchas zonas), la trae; solo de lado. */
function traerALaVista() {
  const boton = botonElegido();
  const caja = contenedor.value;
  if (!boton || !caja) return;
  const margen = 8;
  const izquierda = boton.offsetLeft - margen;
  const derecha = boton.offsetLeft + boton.offsetWidth + margen;
  if (izquierda < caja.scrollLeft) caja.scrollTo({ left: izquierda, behavior: 'smooth' });
  else if (derecha > caja.scrollLeft + caja.clientWidth) {
    caja.scrollTo({ left: derecha - caja.clientWidth, behavior: 'smooth' });
  }
}

watch([zona, () => props.zonas], async () => {
  await nextTick();
  medir();
  traerALaVista();
});
onMounted(medir);
// Si cambia el ancho (otra fuente, otra pantalla), se vuelve a medir.
useResizeObserver(contenedor, medir);
</script>

<template>
  <div
    ref="contenedor"
    class="relative flex max-w-full gap-1 overflow-x-auto rounded-xl bg-elevated p-1"
    role="group"
    aria-label="Filtrar por zona"
  >
    <span
      aria-hidden="true"
      class="absolute top-1 bottom-1 left-0 rounded-lg bg-primary shadow-sm transition-[translate,width] duration-250 ease-out motion-reduce:transition-none"
      :class="marca.ancho === 0 && 'opacity-0'"
      :style="{ width: `${marca.ancho}px`, translate: `${marca.x}px 0` }"
    />
    <button
      v-for="nombre in zonas"
      ref="botones"
      :key="nombre"
      type="button"
      class="relative h-12 shrink-0 rounded-lg px-4 text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:h-11"
      :class="nombre === zona ? 'text-inverted' : 'text-toned hover:text-highlighted'"
      :aria-pressed="nombre === zona"
      @click="zona = nombre"
    >
      {{ nombre }}
    </button>
  </div>
</template>
