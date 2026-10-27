// @ts-check
// Rutas de la caja.
// - Abrir, ver y cerrar el turno: cajero, administrador y dueño.
// - Historial de turnos y arqueos: administrador y dueño.
import { Router } from 'express';
import { esquemaParamsId } from '../../lib/esquemas.js';
import { autenticar, permitirRoles } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './caja.controller.js';
import { esquemaAbrirCaja, esquemaCerrarCaja } from './caja.schemas.js';

const manejanCaja = permitirRoles('dueno', 'administrador', 'cajero');
const venHistorial = permitirRoles('dueno', 'administrador');

export const rutasCaja = Router();
rutasCaja.use(autenticar);

rutasCaja.post('/abrir', manejanCaja, validar({ body: esquemaAbrirCaja }), controlador.abrir);
rutasCaja.get('/actual', manejanCaja, controlador.actual);
rutasCaja.post('/cerrar', manejanCaja, validar({ body: esquemaCerrarCaja }), controlador.cerrar);
rutasCaja.get('/turnos', venHistorial, controlador.listarTurnos);
rutasCaja.get(
  '/turnos/:id',
  venHistorial,
  validar({ params: esquemaParamsId }),
  controlador.obtenerTurno,
);
