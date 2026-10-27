// @ts-check
// Revisa que todos los íconos que usa la app existan en Lucide.
// Un ícono con un nombre equivocado no da error: simplemente no se ve. Esta prueba lo
// detecta antes de que llegue a la pantalla.
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const lucide = require('@iconify-json/lucide/icons.json');
const ICONOS_DE_LUCIDE = new Set([
  ...Object.keys(lucide.icons),
  ...Object.keys(lucide.aliases ?? {}),
]);

const CARPETA_APP = join(import.meta.dirname, '../../app');

/**
 * Todos los archivos .vue y .js de una carpeta, incluidas sus subcarpetas.
 * @param {string} carpeta
 * @returns {string[]}
 */
function archivosDe(carpeta) {
  return readdirSync(carpeta, { recursive: true, encoding: 'utf8' })
    .filter((archivo) => /\.(vue|js)$/.test(archivo))
    .map((archivo) => join(carpeta, archivo));
}

describe('íconos de la app', () => {
  it('todos los i-lucide-* usados en app/ existen', () => {
    const usados = new Set(
      archivosDe(CARPETA_APP).flatMap((archivo) =>
        [...readFileSync(archivo, 'utf8').matchAll(/i-lucide-([a-z0-9-]+)/g)].map((m) => m[1]),
      ),
    );

    const inexistentes = [...usados].filter((nombre) => !ICONOS_DE_LUCIDE.has(nombre));

    expect(usados.size).toBeGreaterThan(0);
    expect(inexistentes).toEqual([]);
  });
});
