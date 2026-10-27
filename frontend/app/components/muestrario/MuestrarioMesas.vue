<!--
  Muestrario: mapa de mesas con filtros por zona y eventos en vivo simulados
  (temporal, Fase 0). Muestra cómo se verá cuando otro dispositivo cambie algo.
-->
<script setup>
const toast = useToast();
const ahora = useNow({ interval: 30_000 });
const { vibrate, isSupported } = useVibrate({ pattern: [40, 60, 40] });

const AL_CARGAR = Date.now();
/** @param {number} minutos */
const haceMinutos = (minutos) => new Date(AL_CARGAR - minutos * 60_000).toISOString();

/** Mesas de ejemplo, con lo que necesita el mapa además de los datos del API. */
function crearMesasDeEjemplo() {
  const libre = { estado: 'libre', abiertaDesde: null, total: null, platosListos: false };
  return [
    {
      id: 'm1',
      nombre: 'Mesa 1',
      zona: 'Salón',
      capacidad: 4,
      estado: 'ocupada',
      abiertaDesde: haceMinutos(32),
      total: '38000',
      platosListos: false,
    },
    { id: 'm2', nombre: 'Mesa 2', zona: 'Salón', capacidad: 2, ...libre },
    {
      id: 'm3',
      nombre: 'Mesa 3',
      zona: 'Salón',
      capacidad: 4,
      estado: 'ocupada',
      abiertaDesde: haceMinutos(8),
      total: '24000',
      platosListos: false,
    },
    {
      id: 'm4',
      nombre: 'Mesa 4',
      zona: 'Salón',
      capacidad: 6,
      estado: 'ocupada',
      abiertaDesde: haceMinutos(19),
      total: '71000',
      platosListos: false,
    },
    { id: 'm5', nombre: 'Mesa 5', zona: 'Salón', capacidad: 4, ...libre },
    { id: 'm6', nombre: 'Mesa 6', zona: 'Salón', capacidad: 2, ...libre },
    {
      id: 't1',
      nombre: 'Terraza 1',
      zona: 'Terraza',
      capacidad: 4,
      estado: 'ocupada',
      abiertaDesde: haceMinutos(47),
      total: '52000',
      platosListos: true,
    },
    { id: 't2', nombre: 'Terraza 2', zona: 'Terraza', capacidad: 4, ...libre },
  ];
}

const mesas = ref(crearMesasDeEjemplo());

// Filtro por zona.
const zonaActiva = ref('Todas');
const zonas = computed(() => ['Todas', ...new Set(mesas.value.map((mesa) => mesa.zona))]);
const mesasVisibles = computed(() =>
  zonaActiva.value === 'Todas'
    ? mesas.value
    : mesas.value.filter((mesa) => mesa.zona === zonaActiva.value),
);
const libres = computed(() => mesas.value.filter((mesa) => mesa.estado === 'libre').length);
const ocupadas = computed(() => mesas.value.length - libres.value);

// Resaltado breve de la mesa que cambió por un evento en vivo.
const idResaltada = ref(/** @type {string | null} */ (null));
let temporizador;
/** @param {string} id */
function resaltar(id) {
  idResaltada.value = id;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => (idResaltada.value = null), 1500);
}
onBeforeUnmount(() => clearTimeout(temporizador));

/** Eventos de ejemplo: qué mesa cambia, cómo y qué aviso llega. */
const EVENTOS = [
  {
    mesaId: 'm2',
    cambios: { estado: 'ocupada', abiertaDesde: new Date().toISOString(), total: '16000' },
    aviso: { title: 'Mesa 2 · nuevo pedido', icon: 'i-lucide-notebook-pen', color: 'info' },
  },
  {
    mesaId: 'm4',
    cambios: { platosListos: true },
    aviso: {
      title: '¡Listo para llevar!',
      description: 'Mesa 4 · 2 IND Classic Artesanal',
      icon: 'i-lucide-bell-ring',
      color: 'info',
    },
    vibrar: true,
  },
  {
    mesaId: 'm1',
    cambios: { estado: 'libre', abiertaDesde: null, total: null, platosListos: false },
    aviso: {
      title: 'Mesa 1 · pagada',
      description: formatearPesos('38000'),
      icon: 'i-lucide-circle-check',
      color: 'success',
    },
  },
];
const siguienteEvento = ref(0);

/** Aplica el siguiente evento de ejemplo; después del último, reinicia el mapa. */
function simularEvento() {
  if (siguienteEvento.value >= EVENTOS.length) {
    mesas.value = crearMesasDeEjemplo();
    siguienteEvento.value = 0;
    return;
  }
  const evento = EVENTOS[siguienteEvento.value];
  const mesa = mesas.value.find((m) => m.id === evento.mesaId);
  if (!mesa) return;

  Object.assign(mesa, evento.cambios);
  resaltar(mesa.id);
  toast.add(/** @type {any} */ (evento.aviso));
  if (evento.vibrar && isSupported.value) vibrate();
  siguienteEvento.value += 1;
}

/** @param {{ nombre: string }} mesa */
function seleccionar(mesa) {
  toast.add({
    title: `Aquí se abriría ${mesa.nombre}`,
    description: 'En la Fase 2 este toque lleva al pedido de la mesa.',
    icon: 'i-lucide-mouse-pointer-click',
    color: 'neutral',
  });
}
</script>

<template>
  <SeccionMuestrario
    id="mesas"
    titulo="Mapa de mesas"
    descripcion="De un vistazo: libres en verde, ocupadas en ámbar con su tiempo y total, y en azul las que tienen platos listos para llevar."
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex gap-2 overflow-x-auto" role="group" aria-label="Filtrar por zona">
        <UButton
          v-for="zona in zonas"
          :key="zona"
          :label="zona"
          size="lg"
          :color="zonaActiva === zona ? 'primary' : 'neutral'"
          :variant="zonaActiva === zona ? 'solid' : 'soft'"
          :aria-pressed="zonaActiva === zona"
          @click="zonaActiva = zona"
        />
      </div>
      <p class="text-sm text-muted">
        <span class="font-semibold text-success">{{ libres }} libres</span>
        ·
        <span class="font-semibold text-warning">{{ ocupadas }} ocupadas</span>
      </p>
    </div>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <TarjetaMesa
        v-for="mesa in mesasVisibles"
        :key="mesa.id"
        :mesa="mesa"
        :tiene-platos-listos="mesa.platosListos"
        :minutos-abierta="mesa.abiertaDesde ? minutosTranscurridos(mesa.abiertaDesde, ahora) : null"
        :total="mesa.total"
        :resaltada="idResaltada === mesa.id"
        @seleccionar="seleccionar"
      />
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <UButton
        size="lg"
        color="info"
        variant="soft"
        icon="i-lucide-radio"
        :label="
          siguienteEvento < EVENTOS.length
            ? `Simular evento en vivo (${siguienteEvento + 1}/${EVENTOS.length})`
            : 'Reiniciar el mapa'
        "
        @click="simularEvento"
      />
      <p class="text-sm text-muted">
        Así se verá cuando otro dispositivo cambie algo: la mesa se resalta y llega un aviso.
      </p>
    </div>
  </SeccionMuestrario>
</template>
