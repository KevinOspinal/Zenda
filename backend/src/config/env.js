// @ts-check
// Lee y valida las variables de entorno. Todo el código usa `env` en lugar de `process.env`.
import { z } from 'zod';

/** Esquema de las variables de entorno. Si algo falta o es inválido, la app no arranca. */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // Opcional. Sin Redis, los límites de peticiones se guardan en la memoria del proceso: sirve
  // mientras corra un solo proceso del API (el piloto). La cola de facturación sí lo exigirá.
  REDIS_URL: z.url({ protocol: /^rediss?$/ }).optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Clave para firmar los tokens de acceso (JWT). Debe ser larga y aleatoria; nunca va en el repositorio.
  JWT_SECRET: z.string().min(32, 'debe tener al menos 32 caracteres'),
  // Vida del token de acceso. Corta a propósito: si alguien lo roba, sirve por poco tiempo.
  JWT_MINUTOS: z.coerce.number().int().min(1).max(60).default(15),
  // Vida del refresh token, con el que la app pide un token de acceso nuevo sin volver a iniciar sesión.
  REFRESH_TOKEN_DIAS: z.coerce.number().int().min(1).max(90).default(30),

  // Orígenes (dominios) desde los que un navegador puede llamar al API y conectarse por Socket.IO,
  // separados por coma. Por ejemplo: "http://localhost:3001,https://app.zenda.co".
  // Postman y curl no los necesitan: CORS solo aplica en navegadores.
  CORS_ORIGENES: z
    .string()
    .default('http://localhost:3001')
    .transform((valor) =>
      valor
        .split(',')
        .map((origen) => origen.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url('cada origen debe ser una URL, por ejemplo http://localhost:3001'))),

  // Documentación Swagger en /docs. Si no se indica, está activa en desarrollo y apagada
  // en producción: mostrar toda la estructura del API facilita el trabajo a un atacante.
  DOCS_HABILITADA: z.stringbool().optional(),

  // Registro público de negocios nuevos (POST /negocios/registro). Si no se indica, está
  // abierto en desarrollo y cerrado en producción hasta tener un proceso de alta formal.
  REGISTRO_HABILITADO: z.stringbool().optional(),

  // Límite de peticiones por IP en los endpoints públicos sensibles. Frenan a quien prueba
  // muchas contraseñas o crea negocios en masa. Al pasarse, el API responde 429.
  LIMITE_LOGIN_POR_MINUTO: z.coerce.number().int().min(1).default(10),
  LIMITE_REFRESH_POR_MINUTO: z.coerce.number().int().min(1).default(30),
  LIMITE_REGISTRO_POR_HORA: z.coerce.number().int().min(1).default(5),

  // true si el API está detrás de un proxy (Nginx, Caddy, balanceador). Así toma la IP real
  // del cliente del encabezado X-Forwarded-For. Sin proxy debe ser false: si no, cualquiera
  // podría falsificar su IP para saltarse los límites.
  CONFIAR_EN_PROXY: z.stringbool().default(false),
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
