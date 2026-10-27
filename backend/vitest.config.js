// @ts-check
// Configuración de las pruebas con Vitest.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Variables mínimas para que `config/env.js` valide sin un `.env` real.
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgresql://zenda:zenda@localhost:5432/zenda_test',
      REDIS_URL: 'redis://localhost:6379',
    },
  },
});
