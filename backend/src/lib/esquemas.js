// @ts-check
// Esquemas Zod que se repiten en varios módulos.
import { z } from 'zod';

/** Identificador de cualquier registro (UUID). */
export const esquemaId = z.uuid('id inválido');

/** Parámetros de las rutas con `/:id`. */
export const esquemaParamsId = z.object({ id: esquemaId });

/**
 * Valor en pesos. Acepta número (12000) o texto ("12000.50") y lo entrega como texto,
 * para convertirlo a Decimal sin pasar por punto flotante.
 * No acepta separadores de miles: "12.000" sería ambiguo (¿doce mil o doce?).
 */
export const esquemaMonto = z
  .union([z.string().trim(), z.number()])
  .transform(String)
  .pipe(
    z
      .string()
      .regex(
        /^\d{1,12}(\.\d{1,2})?$/,
        'debe ser un valor en pesos sin separadores de miles y con máximo 2 decimales',
      ),
  );

/** Texto obligatorio sin espacios sobrantes. */
export function textoObligatorio(maximo = 120) {
  return z.string().trim().min(1, 'es obligatorio').max(maximo, `máximo ${maximo} caracteres`);
}

/** Valor "true"/"false" que llega en la URL (`?activo=true`) convertido a booleano. */
export const esquemaBooleanoEnUrl = z
  .enum(['true', 'false'], 'debe ser true o false')
  .transform((valor) => valor === 'true');

/**
 * Exige que un objeto de actualización (PATCH) traiga al menos un campo.
 * @template {z.ZodObject} T
 * @param {T} esquema
 */
export function alMenosUnCampo(esquema) {
  return esquema.refine((datos) => Object.keys(datos).length > 0, {
    message: 'envíe al menos un campo para actualizar',
  });
}
