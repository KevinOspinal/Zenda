// @ts-check
// Esquemas Zod de la caja (turnos y arqueo).
import { z } from 'zod';
import { esquemaMonto } from '../../lib/esquemas.js';

/** POST /caja/abrir: efectivo con el que se abre la caja (la base para dar cambio). */
export const esquemaAbrirCaja = z.object({
  montoInicial: esquemaMonto,
});

/** POST /caja/cerrar: efectivo que el cajero cuenta físicamente al cerrar (arqueo). */
export const esquemaCerrarCaja = z.object({
  montoContado: esquemaMonto,
});
