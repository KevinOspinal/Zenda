// @ts-check
// Prepara la base de pruebas (zenda_test) una sola vez antes de correr las pruebas:
// aplica las migraciones, las políticas RLS y deja las tablas vacías.
import { execFileSync } from 'node:child_process';
import { variablesDePrueba } from './variables.js';

/**
 * Ejecuta un comando de la CLI de Prisma contra la base de pruebas.
 * @param {string[]} argumentos
 * @param {string} [entrada] Texto que se envía por la entrada estándar.
 */
function ejecutarPrisma(argumentos, entrada) {
  execFileSync('npx', ['prisma', ...argumentos], {
    // Las variables de prueba van explícitas para no depender del .env de desarrollo.
    env: { ...process.env, ...variablesDePrueba },
    input: entrada,
    stdio: [entrada ? 'pipe' : 'ignore', 'ignore', 'inherit'],
  });
}

export default function prepararBaseDePruebas() {
  // 0. Protección: nunca limpiar una base que no sea la de pruebas.
  if (!variablesDePrueba.DATABASE_URL_MIGRACIONES.endsWith('/zenda_test')) {
    throw new Error('Las pruebas solo pueden usar la base zenda_test');
  }

  // 1. Crear o actualizar las tablas y regenerar el cliente de Prisma
  //    (Prisma 7 no lo regenera solo al migrar).
  ejecutarPrisma(['migrate', 'deploy']);
  ejecutarPrisma(['generate']);

  // 2. Aplicar Row-Level Security.
  ejecutarPrisma(['db', 'execute', '--file', 'prisma/rls.sql']);

  // 3. Empezar siempre con la base vacía. CASCADE borra también las tablas que dependen de tenants.
  ejecutarPrisma(['db', 'execute', '--stdin'], 'TRUNCATE tenants CASCADE;');
}
