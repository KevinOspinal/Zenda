// @ts-check
// Rutas de la caja.
// - Saber si la caja está abierta (sin montos): todos los roles.
// - Abrir, ver y cerrar el turno: cajero, administrador, dueño y administrador de Zenda.
// - Historial de turnos y arqueos: administrador, dueño y administrador de Zenda.
import { Router } from 'express';
import { esquemaParamsId } from '../../lib/esquemas.js';
import { autenticar, permitirRoles } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './caja.controller.js';
import { esquemaAbrirCaja, esquemaCerrarCaja } from './caja.schemas.js';

const manejanCaja = permitirRoles('administrador_zenda', 'dueno', 'administrador', 'cajero');
const venHistorial = permitirRoles('administrador_zenda', 'dueno', 'administrador');

export const rutasCaja = Router();
rutasCaja.use(autenticar);

rutasCaja.get('/estado', controlador.estado);
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
