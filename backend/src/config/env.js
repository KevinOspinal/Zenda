// @ts-check
// Lee y valida las variables de entorno. Todo el código usa `env` en lugar de `process.env`.
import { z } from 'zod';

/** Esquema de las variables de entorno. Si algo falta o es inválido, la app no arranca. */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

/** @typedef {z.infer<typeof envSchema>} Env */

/**
 * Valida un conjunto de variables de entorno.
 * @param {Record<string, string | undefined>} source Variables a validar (normalmente `process.env`).
 * @returns {Env}
 * @throws {Error} Con la lista de variables inválidas, sin mostrar sus valores.
 */
export function parseEnv(source) {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const detalle = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuración inválida:\n${detalle}`);
  }
  return Object.freeze(result.data);
}

/** Configuración validada del proceso actual. */
export const env = parseEnv(process.env);
