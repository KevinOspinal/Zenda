// @ts-check
// Sonidos de la app, generados con el navegador (Web Audio): no necesitan archivos de audio y
// funcionan sin conexión. Son de dos clases, cada una con su interruptor en el perfil:
// - Avisos: llegan solos (una comanda nueva, un plato listo, un pedido anulado en la cocina).
// - Toques: responden a lo que hace la persona en este dispositivo (agregar un producto,
//   enviar a la cocina, cobrar, algo que falló). Son más cortos y más suaves.
// Un mismo sonido no se repite antes de su intervalo: si fallan varias cosas a la vez o llegan
// dos comandas juntas, suena una vez en lugar de amontonarse.
//
// Los navegadores solo dejan sonar después de que el usuario toca la pantalla; por eso el
// audio se prepara en el primer toque (prepararAudioAlPrimerToque).

/**
 * Una nota de un sonido. Los tiempos van en segundos.
 * @typedef {object} Nota
 * @property {number} frecuencia En hercios (Hz).
 * @property {number} inicio
 * @property {number} duracion
 * @property {number} [hasta] Frecuencia a la que se desliza mientras suena (un "zas").
 * @property {OscillatorType} [forma] Por defecto 'sine' (suave). 'triangle' se oye mejor en
 *   los parlantes de los celulares cuando el tono es grave.
 */

/**
 * @typedef {object} Sonido
 * @property {'aviso' | 'toque'} clase
 * @property {Nota[]} notas
 * @property {number} [volumen] De 0 a 1. Si no se indica, el de su clase.
 * @property {number} [intervaloMs] Tiempo mínimo para que vuelva a sonar.
 */

/** Volumen de cada clase (de 0 a 1): los toques suenan más suave que los avisos. */
export const VOLUMEN_DE_SONIDOS = Object.freeze({ aviso: 0.25, toque: 0.12 });

/** Tiempo mínimo para que un sonido vuelva a sonar, si no tiene uno propio. */
const INTERVALO_MS = 250;

/**
 * Los sonidos de la app. Cada uno tiene notas distintas, para reconocerlo sin mirar.
 * @type {Readonly<Record<string, Sonido>>}
 */
export const SONIDOS = Object.freeze({
  // ───────────── Avisos: llegan solos ─────────────

  /** Un plato está listo para llevar: dos notas que suben. */
  platoListo: {
    clase: 'aviso',
    notas: [
      { frecuencia: 880, inicio: 0, duracion: 0.18 },
      { frecuencia: 1318.5, inicio: 0.16, duracion: 0.32 },
    ],
  },
  /** Llegó una comanda nueva a la cocina: tres notas, más llamativas. */
  comandaNueva: {
    clase: 'aviso',
    intervaloMs: 1000,
    notas: [
      { frecuencia: 659.3, inicio: 0, duracion: 0.15 },
      { frecuencia: 659.3, inicio: 0.2, duracion: 0.15 },
      { frecuencia: 987.8, inicio: 0.4, duracion: 0.35 },
    ],
  },
  /** Agregaron productos a una comanda que ya estaba en la cocina: un "din-don" doble. */
  comandaActualizada: {
    clase: 'aviso',
    intervaloMs: 1000,
    notas: [
      { frecuencia: 987.8, inicio: 0, duracion: 0.1 },
      { frecuencia: 1318.5, inicio: 0.13, duracion: 0.1 },
      { frecuencia: 987.8, inicio: 0.26, duracion: 0.1 },
      { frecuencia: 1318.5, inicio: 0.39, duracion: 0.25 },
    ],
  },
  /** Anularon un pedido que la cocina tenía en el tablero: tres notas que bajan. */
  pedidoAnulado: {
    clase: 'aviso',
    intervaloMs: 1000,
    notas: [
      { frecuencia: 880, inicio: 0, duracion: 0.16, forma: 'triangle' },
      { frecuencia: 698.5, inicio: 0.17, duracion: 0.16, forma: 'triangle' },
      { frecuencia: 523.3, inicio: 0.34, duracion: 0.4, forma: 'triangle' },
    ],
  },
  /** Al domiciliario le asignaron un domicilio: tres notas que suben, alegres. */
  domicilioAsignado: {
    clase: 'aviso',
    notas: [
      { frecuencia: 523.3, inicio: 0, duracion: 0.14 },
      { frecuencia: 659.3, inicio: 0.12, duracion: 0.14 },
      { frecuencia: 784, inicio: 0.24, duracion: 0.4 },
    ],
  },

  // ───────────── Toques: responden a lo que se hace en este dispositivo ─────────────

  /** Se agregó un producto al pedido: un "tic" agudo. */
  productoAgregado: {
    clase: 'toque',
    intervaloMs: 40,
    notas: [{ frecuencia: 1174.7, inicio: 0, duracion: 0.06 }],
  },
  /** Se quitó un producto del pedido: un "tic" más grave. */
  productoQuitado: {
    clase: 'toque',
    intervaloMs: 40,
    notas: [{ frecuencia: 587.3, inicio: 0, duracion: 0.08 }],
  },
  /** El pedido salió para la cocina: dos notas que suben. */
  enviadoACocina: {
    clase: 'toque',
    notas: [
      { frecuencia: 784, inicio: 0, duracion: 0.1 },
      { frecuencia: 1174.7, inicio: 0.09, duracion: 0.2 },
    ],
  },
  /** Cobro registrado (o dinero recibido de un domiciliario): una campanita alegre. */
  cobroRegistrado: {
    clase: 'toque',
    volumen: 0.16,
    notas: [
      { frecuencia: 1046.5, inicio: 0, duracion: 0.1 },
      { frecuencia: 1318.5, inicio: 0.07, duracion: 0.1 },
      { frecuencia: 1568, inicio: 0.14, duracion: 0.1 },
      { frecuencia: 2093, inicio: 0.21, duracion: 0.45 },
    ],
  },
  /** Se entregaron platos o un domicilio: un toque corto y suave. */
  entregaHecha: {
    clase: 'toque',
    notas: [
      { frecuencia: 1046.5, inicio: 0, duracion: 0.12 },
      { frecuencia: 1568, inicio: 0.1, duracion: 0.28 },
    ],
  },
  /** El domicilio salió con su domiciliario: un "zas" que sube. */
  domicilioDespachado: {
    clase: 'toque',
    notas: [
      { frecuencia: 523.3, hasta: 1046.5, inicio: 0, duracion: 0.18 },
      { frecuencia: 1568, inicio: 0.16, duracion: 0.22 },
    ],
  },
  /** Se abrió la caja: tres notas que suben. */
  cajaAbierta: {
    clase: 'toque',
    notas: [
      { frecuencia: 523.3, inicio: 0, duracion: 0.12 },
      { frecuencia: 784, inicio: 0.1, duracion: 0.12 },
      { frecuencia: 1046.5, inicio: 0.2, duracion: 0.4 },
    ],
  },
  /** Se cerró la caja: las mismas notas, bajando, tranquilas. */
  cajaCerrada: {
    clase: 'toque',
    notas: [
      { frecuencia: 1046.5, inicio: 0, duracion: 0.14 },
      { frecuencia: 784, inicio: 0.12, duracion: 0.14 },
      { frecuencia: 523.3, inicio: 0.24, duracion: 0.45 },
    ],
  },
  /** Algo que hizo la persona no se pudo hacer: dos notas graves que bajan. */
  error: {
    clase: 'toque',
    volumen: 0.2,
    intervaloMs: 1500,
    notas: [
      { frecuencia: 311.1, inicio: 0, duracion: 0.14, forma: 'triangle' },
      { frecuencia: 233.1, inicio: 0.15, duracion: 0.26, forma: 'triangle' },
    ],
  },
});

/** @type {AudioContext | null} */
let contexto = null;
/** Cuándo sonó por última vez cada sonido, en el reloj del audio (segundos). */
const ultimaVez = new Map();

/** Contexto de audio del navegador, creado una sola vez. Null si el navegador no lo tiene. */
function contextoDeAudio() {
  if (typeof window === 'undefined' || !window.AudioContext) return null;
  contexto ??= new AudioContext();
  if (contexto.state === 'suspended') contexto.resume().catch(() => {});
  return contexto;
}

/** Prepara el audio con el primer toque en la pantalla, para que los avisos puedan sonar. */
export function prepararAudioAlPrimerToque() {
  window.addEventListener('pointerdown', () => contextoDeAudio(), { once: true });
}

/**
 * Toca un sonido, salvo que haya sonado hace muy poco.
 * @param {string} nombre
 * @param {Sonido} sonido
 */
function tocar(nombre, sonido) {
  const audio = contextoDeAudio();
  if (!audio || audio.state !== 'running') return;

  // 1. No amontonar: si este sonido acaba de sonar, no se repite.
  const ahora = audio.currentTime;
  const intervalo = (sonido.intervaloMs ?? INTERVALO_MS) / 1000;
  if (ahora - (ultimaVez.get(nombre) ?? -Infinity) < intervalo) return;
  ultimaVez.set(nombre, ahora);

  // 2. Cada nota es un oscilador con su volumen, con entrada y salida suaves para que no
  //    "golpee".
  const pico = sonido.volumen ?? VOLUMEN_DE_SONIDOS[sonido.clase];
  for (const { frecuencia, hasta, inicio, duracion, forma = 'sine' } of sonido.notas) {
    const desde = ahora + inicio;
    const oscilador = audio.createOscillator();
    const volumen = audio.createGain();
    oscilador.type = forma;
    oscilador.frequency.setValueAtTime(frecuencia, desde);
    if (hasta) oscilador.frequency.exponentialRampToValueAtTime(hasta, desde + duracion);
    volumen.gain.setValueAtTime(0.0001, desde);
    volumen.gain.exponentialRampToValueAtTime(pico, desde + Math.min(0.02, duracion / 3));
    volumen.gain.exponentialRampToValueAtTime(0.0001, desde + duracion);
    oscilador.connect(volumen).connect(audio.destination);
    oscilador.start(desde);
    oscilador.stop(desde + duracion + 0.05);
  }
}

/**
 * Sonidos de la app. Cada uno respeta el interruptor de su clase en el perfil: "Sonidos de
 * avisos" o "Sonidos al tocar".
 */
export function useSonidos() {
  const preferencias = usePreferenciasStore();

  /** @param {string} nombre Uno de SONIDOS. */
  function sonar(nombre) {
    const sonido = SONIDOS[nombre];
    const encendido = sonido.clase === 'aviso' ? preferencias.sonidos : preferencias.sonidosAlTocar;
    if (encendido) tocar(nombre, sonido);
  }

  return {
    // Avisos.
    platoListo: () => sonar('platoListo'),
    comandaNueva: () => sonar('comandaNueva'),
    comandaActualizada: () => sonar('comandaActualizada'),
    pedidoAnulado: () => sonar('pedidoAnulado'),
    domicilioAsignado: () => sonar('domicilioAsignado'),
    // Toques.
    productoAgregado: () => sonar('productoAgregado'),
    productoQuitado: () => sonar('productoQuitado'),
    enviadoACocina: () => sonar('enviadoACocina'),
    cobroRegistrado: () => sonar('cobroRegistrado'),
    entregaHecha: () => sonar('entregaHecha'),
    domicilioDespachado: () => sonar('domicilioDespachado'),
    cajaAbierta: () => sonar('cajaAbierta'),
    cajaCerrada: () => sonar('cajaCerrada'),
    error: () => sonar('error'),
  };
}
