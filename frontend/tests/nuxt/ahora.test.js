// @ts-check
// Prueba de useAhora: la hora se pone al día cada cierto tiempo y no en cada cuadro de la
// pantalla (como pasaría con useNow de VueUse 15 sin scheduler), y deja de cambiar al cerrar
// la pantalla que la usa.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { useAhora } from '~/composables/useAhora.js';

afterEach(() => vi.useRealTimers());

describe('useAhora', () => {
  it('cambia cada 30 segundos y no en cada cuadro; al cerrar la pantalla, se detiene', () => {
    // Se simulan los cuadros de la pantalla (requestAnimationFrame) además del reloj: si la
    // hora se pusiera al día en cada cuadro, cambiaría antes de los 30 segundos.
    vi.useFakeTimers({
      toFake: ['Date', 'setInterval', 'clearInterval', 'requestAnimationFrame'],
    });
    const pantalla = effectScope();
    const ahora = /** @type {import('vue').ShallowRef<Date>} */ (
      pantalla.run(() => useAhora(30_000))
    );
    const inicio = ahora.value.getTime();

    vi.advanceTimersByTime(29_000);
    expect(ahora.value.getTime()).toBe(inicio);

    vi.advanceTimersByTime(1_000);
    expect(ahora.value.getTime()).toBe(inicio + 30_000);

    pantalla.stop();
    vi.advanceTimersByTime(60_000);
    expect(ahora.value.getTime()).toBe(inicio + 30_000);
  });
});
