// @ts-check
// Esquemas Zod de los domiciliarios.
import { z } from 'zod';
import {
  alMenosUnCampo,
  esquemaBooleanoEnUrl,
  esquemaContrasenaNueva,
  esquemaTelefono,
  textoObligatorio,
} from '../../lib/esquemas.js';

/** GET /domiciliarios?activos=true */
export const esquemaFiltrosDomiciliarios = z.object({
  // true: solo los que pueden llevar pedidos (para elegir al despachar).
  activos: esquemaBooleanoEnUrl.optional(),
});

/** POST /domiciliarios */
export const esquemaCrearDomiciliario = z.object({
  nombre: textoObligatorio(80),
  // A este número la caja le manda los datos de cada domicilio por WhatsApp.
  telefono: esquemaTelefono,
});

/** PATCH /domiciliarios/:id */
export const esquemaActualizarDomiciliario = alMenosUnCampo(
  z
    .object({
      nombre: textoObligatorio(80),
      telefono: esquemaTelefono,
      // false: ya no se le asignan pedidos, pero se conserva su historial.
      activo: z.boolean(),
    })
    .partial(),
);

/** POST /domiciliarios/:id/acceso: el usuario con que entra a Zenda desde su celular. */
export const esquemaDarAcceso = z.object({
  // Se normaliza a minúsculas: el login no distingue mayúsculas.
  email: z.string().trim().toLowerCase().pipe(z.email('correo inválido')),
  contrasena: esquemaContrasenaNueva,
});
