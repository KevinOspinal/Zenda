// @ts-check
// Configuración de la CLI de Prisma (migraciones, generación del cliente y seed).
import { existsSync } from 'node:fs';
import { defineConfig, env } from 'prisma/config';

// Prisma no carga el .env por sí solo: lo cargamos si existe.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Las migraciones usan el usuario dueño de las tablas, no el de la app.
    url: env('DATABASE_URL_MIGRACIONES'),
  },
});
