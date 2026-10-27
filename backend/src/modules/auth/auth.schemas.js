// @ts-check
// Esquemas Zod de las peticiones de autenticación.
import { z } from 'zod';

/** POST /auth/login */
export const esquemaLogin = z.object({
  // NIT del negocio, solo dígitos y sin dígito de verificación (por ejemplo 900123456).
  nit: z
    .string()
    .trim()
    .regex(/^\d{5,15}$/, 'debe tener solo dígitos, sin dígito de verificación'),
  // Se normaliza a minúsculas para que "Ana@Cafe.co" y "ana@cafe.co" sean el mismo usuario.
  email: z.string().trim().toLowerCase().pipe(z.email('correo inválido')),
  password: z.string().min(1, 'es obligatoria').max(200),
});

/** POST /auth/refresh y POST /auth/logout */
export const esquemaRefreshToken = z.object({
  refreshToken: z.string().min(1, 'es obligatorio').max(200),
});
