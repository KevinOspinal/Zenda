// @ts-check
// Sonidos de los avisos, generados con el navegador (Web Audio): no necesitan archivos de
// audio y funcionan sin conexión. Respetan la preferencia de sonidos del perfil.
//
// Los navegadores solo dejan sonar después de que el usuario toca la pantalla; por eso el
// audio se prepara en el primer toque (prepararAudioAlPrimerToque).

/** @type {AudioContext | null} */
let contexto = null;

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
 * Toca una secuencia corta de notas suaves.
 * @param {{ frecuencia: number, inicio: number, duracion: number }[]} notas Tiempos en segundos.
 */
function tocar(notas) {
  const audio = contextoDeAudio();
  if (!audio || audio.state !== 'running') return;

  const ahora = audio.currentTime;
  for (const { frecuencia, inicio, duracion } of notas) {
    const oscilador = audio.createOscillator();
    const volumen = audio.createGain();
    oscilador.type = 'sine';
    oscilador.frequency.value = frecuencia;
    // Entrada y salida suaves para que no "golpee".
    volumen.gain.setValueAtTime(0.0001, ahora + inicio);
    volumen.gain.exponentialRampToValueAtTime(0.25, ahora + inicio + 0.02);
    volumen.gain.exponentialRampToValueAtTime(0.0001, ahora + inicio + duracion);
    oscilador.connect(volumen).connect(audio.destination);
    oscilador.start(ahora + inicio);
    oscilador.stop(ahora + inicio + duracion + 0.05);
  }
}

/** Sonidos de la app. No suenan si el usuario los apagó en su perfil. */
export function useSonidos() {
  const preferencias = usePreferenciasStore();

  return {
    /** Un plato está listo para llevar: dos notas ascendentes. */
    platoListo() {
      if (!preferencias.sonidos) return;
      tocar([
        { frecuencia: 880, inicio: 0, duracion: 0.18 },
        { frecuencia: 1318.5, inicio: 0.16, duracion: 0.32 },
      ]);
    },
    /** Llegó una comanda nueva a la cocina: tres notas, más llamativas. */
    comandaNueva() {
      if (!preferencias.sonidos) return;
      tocar([
        { frecuencia: 659.3, inicio: 0, duracion: 0.15 },
        { frecuencia: 659.3, inicio: 0.2, duracion: 0.15 },
        { frecuencia: 987.8, inicio: 0.4, duracion: 0.35 },
      ]);
    },
  };
}
