// @ts-check
// Configuración de las pruebas con Vitest.
//
// Las pruebas usan la base zenda_test (nunca la de desarrollo) y necesitan
// los contenedores de Docker encendidos: `docker compose up -d`.
import { defineConfig } from 'vitest/config';
import { variablesDePrueba } from './tests/setup/variables.js';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Migra y limpia la base de pruebas una vez antes de todas las pruebas.
    globalSetup: ['tests/setup/baseDePruebas.js'],
    // Los archivos que usan la base comparten datos: se ejecutan uno tras otro.
    fileParallelism: false,
    env: variablesDePrueba,
  },
});
