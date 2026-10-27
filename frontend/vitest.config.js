// @ts-check
// Configuración de las pruebas con Vitest. Hay dos grupos:
// - unit: lógica pura (dinero, fechas, errores, roles). Corre en Node, sin Nuxt: es muy rápida.
// - nuxt: componentes y código que usa funciones de Nuxt. Corre dentro de una app Nuxt de
//   prueba con un navegador simulado (happy-dom).
import { defineVitestProject } from '@nuxt/test-utils/config';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.js'],
          environment: 'node',
        },
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['tests/nuxt/**/*.test.js'],
          environment: 'nuxt',
          environmentOptions: { nuxt: { domEnvironment: 'happy-dom' } },
        },
      }),
    ],
  },
});
