<!--
  Mini gráfica de cómo ha cambiado el stock de un producto, con sus últimos movimientos (ver
  puntosDeStock). Es una línea en escalones: el stock no cambia poco a poco, salta con cada
  venta, compra o ajuste. La línea del cero sirve de referencia: lo que queda debajo es stock
  negativo.

  - Una sola serie: sin leyenda (el título de la sección la nombra) y en el color de la marca.
  - Al pasar el mouse o el dedo, una guía vertical muestra cuánto había en ese momento.
  - Para lectores de pantalla, un resumen (de cuánto a cuánto, el mínimo y el máximo); el
    historial de abajo tiene cada movimiento con su cifra, como una tabla.
  - Se dibuja de izquierda a derecha al aparecer (sin movimiento con "reducir movimiento").

  El SVG se estira a lo ancho (preserveAspectRatio="none") y sus trazos no se deforman
  (vector-effect); los textos y los puntos van en HTML encima, para que no se estiren.
-->
<script setup>
const props = defineProps({
  /** Puntos del más antiguo al más reciente: { tiempo (ms), stock }. */
  puntos: {
    type: /** @type {import('vue').PropType<{ tiempo: number, stock: number }[]>} */ (Array),
    required: true,
  },
});

/** Tamaño del lienzo en unidades del viewBox (el alto es el real, en píxeles). */
const ANCHO = 300;
const ALTO = 96;
/** Margen arriba y abajo para que la línea no toque el borde. */
const MARGEN = 8;

const inicio = computed(() => props.puntos[0]?.tiempo ?? 0);
const fin = computed(() => props.puntos.at(-1)?.tiempo ?? 0);

/** Rango del eje vertical: siempre incluye el cero, para que su línea se vea. */
const rango = computed(() => {
  const valores = props.puntos.map((punto) => punto.stock);
  const minimo = Math.min(0, ...valores);
  let maximo = Math.max(0, ...valores);
  if (minimo === maximo) maximo = minimo + 1;
  return { minimo, maximo };
});

/** @param {number} tiempo */
const x = (tiempo) =>
  fin.value === inicio.value
    ? ANCHO
    : ((tiempo - inicio.value) / (fin.value - inicio.value)) * ANCHO;
/** @param {number} stock */
const y = (stock) => {
  const { minimo, maximo } = rango.value;
  return MARGEN + (1 - (stock - minimo) / (maximo - minimo)) * (ALTO - 2 * MARGEN);
};

/** La línea en escalones: horizontal hasta el siguiente movimiento y ahí sube o baja. */
const linea = computed(() => {
  const [primero, ...resto] = props.puntos;
  if (!primero) return '';
  let trazo = `M ${x(primero.tiempo)} ${y(primero.stock)}`;
  for (const punto of resto) trazo += ` H ${x(punto.tiempo)} V ${y(punto.stock)}`;
  return trazo;
});
/** El área entre la línea y el cero. */
const area = computed(() => (linea.value ? `${linea.value} V ${y(0)} H ${x(inicio.value)} Z` : ''));
const alturaDelCero = computed(() => y(0));

/** Escala a la izquierda: el cero siempre; el máximo y el mínimo, si no son el cero. */
const escala = computed(() => {
  const valores = props.puntos.map((punto) => punto.stock);
  const marcas = new Set([0]);
  if (valores.length) {
    if (Math.max(...valores) > 0) marcas.add(Math.max(...valores));
    if (Math.min(...valores) < 0) marcas.add(Math.min(...valores));
  }
  return [...marcas].map((valor) => ({ valor, top: `${y(valor)}px` }));
});

/** Posición en porcentaje, para lo que va en HTML encima del SVG. */
const enPorcentaje = (/** @type {number} */ tiempo, /** @type {number} */ stock) => ({
  left: `${(x(tiempo) / ANCHO) * 100}%`,
  top: `${y(stock)}px`,
});

const ultimo = computed(() => props.puntos.at(-1));

// ── Guía al pasar el mouse o el dedo ──
const lienzo = ref(/** @type {HTMLElement | null} */ (null));
const guia = ref(/** @type {{ tiempo: number, stock: number, desde: number } | null} */ (null));

/** @param {PointerEvent} evento */
function moverGuia(evento) {
  const caja = lienzo.value?.getBoundingClientRect();
  if (!caja || !props.puntos.length) return;
  const fraccion = Math.min(1, Math.max(0, (evento.clientX - caja.left) / caja.width));
  const tiempo = inicio.value + fraccion * (fin.value - inicio.value);
  // En una línea en escalones, el valor en un momento es el del último movimiento anterior.
  let punto = props.puntos[0];
  for (const candidato of props.puntos) {
    if (candidato.tiempo > tiempo) break;
    punto = candidato;
  }
  guia.value = { tiempo, stock: punto.stock, desde: punto.tiempo };
}

/** Lo que dice la guía: "hoy 7:45 p. m. · 12 unidades" o "Ahora · 12 unidades". */
const textoGuia = computed(() => {
  if (!guia.value) return '';
  const cuando = guia.value.desde === fin.value ? 'Ahora' : fechaRelativa(guia.value.desde);
  const unidades = guia.value.stock === 1 ? 'unidad' : 'unidades';
  return `${cuando} · ${formatearCantidad(guia.value.stock)} ${unidades}`;
});
/**
 * Dónde va el texto de la guía: centrado sobre ella o, cerca de los bordes, pegado al borde
 * para no salirse.
 */
const lugarDelTexto = computed(() => {
  if (!guia.value) return { clase: '', estilo: {} };
  const fraccion = x(guia.value.tiempo) / ANCHO;
  if (fraccion < 0.25) return { clase: 'left-0', estilo: {} };
  if (fraccion > 0.75) return { clase: 'right-0', estilo: {} };
  return { clase: '-translate-x-1/2', estilo: { left: `${fraccion * 100}%` } };
});

const resumenAccesible = computed(() => {
  const primero = props.puntos[0];
  const final = ultimo.value;
  if (!primero || !final) return '';
  const valores = props.puntos.map((punto) => punto.stock);
  return (
    `Stock desde ${fechaRelativa(primero.tiempo)}: empezó en ${formatearCantidad(primero.stock)} ` +
    `y ahora va en ${formatearCantidad(final.stock)}. Mínimo ${formatearCantidad(Math.min(...valores))}, ` +
    `máximo ${formatearCantidad(Math.max(...valores))}.`
  );
});
</script>

<template>
  <figure class="space-y-1.5">
    <div
      ref="lienzo"
      class="grafica relative h-24 touch-pan-y"
      role="img"
      :aria-label="resumenAccesible"
      @pointermove="moverGuia"
      @pointerdown="moverGuia"
      @pointerleave="guia = null"
    >
      <svg
        :viewBox="`0 0 ${ANCHO} ${ALTO}`"
        preserveAspectRatio="none"
        class="absolute inset-0 size-full overflow-visible"
        aria-hidden="true"
      >
        <!-- La línea del cero: la referencia (debajo, stock negativo). -->
        <line
          :x1="0"
          :x2="ANCHO"
          :y1="alturaDelCero"
          :y2="alturaDelCero"
          class="stroke-(--ui-border-accented)"
          stroke-width="1"
          stroke-dasharray="3 3"
          vector-effect="non-scaling-stroke"
        />
        <path :d="area" class="fill-primary/10" />
        <path
          :d="linea"
          class="fill-none stroke-(--ui-primary)"
          stroke-width="2"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
      </svg>

      <!-- Escala a la izquierda: el cero, el máximo y el mínimo, cada uno a su altura. -->
      <span
        v-for="marca in escala"
        :key="marca.valor"
        class="cifra pointer-events-none absolute left-0 -translate-y-1/2 rounded-sm bg-default/85 px-0.5 text-[0.6875rem] leading-none text-muted"
        :style="{ top: marca.top }"
        aria-hidden="true"
        >{{ formatearCantidad(marca.valor) }}</span
      >

      <!-- El stock de ahora: un punto al final de la línea. -->
      <span
        v-if="ultimo && !guia"
        class="pointer-events-none absolute size-2.5 -translate-1/2 rounded-full bg-primary ring-2 ring-(--ui-bg)"
        :style="enPorcentaje(ultimo.tiempo, ultimo.stock)"
        aria-hidden="true"
      />

      <!-- Guía al pasar el mouse o el dedo. -->
      <template v-if="guia">
        <span
          class="pointer-events-none absolute inset-y-0 w-px bg-(--ui-border-accented)"
          :style="{ left: enPorcentaje(guia.tiempo, guia.stock).left }"
          aria-hidden="true"
        />
        <span
          class="pointer-events-none absolute size-2.5 -translate-1/2 rounded-full bg-primary ring-2 ring-(--ui-bg)"
          :style="enPorcentaje(guia.tiempo, guia.stock)"
          aria-hidden="true"
        />
        <span
          class="cifra pointer-events-none absolute -top-8 rounded-md bg-inverted px-2 py-1 text-xs font-medium whitespace-nowrap text-inverted shadow-md"
          :class="lugarDelTexto.clase"
          :style="lugarDelTexto.estilo"
          aria-hidden="true"
          >{{ textoGuia }}</span
        >
      </template>
    </div>
    <figcaption class="flex justify-between text-[0.6875rem] text-muted" aria-hidden="true">
      <span>{{ puntos[0] ? fechaRelativa(puntos[0].tiempo) : '' }}</span>
      <span>Ahora</span>
    </figcaption>
  </figure>
</template>

<style scoped>
/* Se dibuja de izquierda a derecha al aparecer. */
@media (prefers-reduced-motion: no-preference) {
  .grafica svg {
    animation: revelar 400ms ease-out both;
  }
}
@keyframes revelar {
  from {
    clip-path: inset(0 100% 0 0);
  }
  to {
    clip-path: inset(0 0 0 0);
  }
}
</style>
