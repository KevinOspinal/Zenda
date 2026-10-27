// @ts-check
// Rutas de negocios. El registro es público: quien se registra todavía no tiene cuenta.
import { Router } from 'express';
import { limiteRegistro } from '../../middlewares/limitePeticiones.js';
import { validar } from '../../middlewares/validar.js';
import { esquemaRegistroNegocio } from './negocios.schemas.js';
import { registrarNegocio } from './negocios.service.js';

export const rutasNegocios = Router();

// POST /negocios/registro → 201 con el negocio y la sesión del dueño.
rutasNegocios.post(
  '/registro',
  limiteRegistro,
  validar({ body: esquemaRegistroNegocio }),
  async (_req, res) => {
    res.status(201).json(await registrarNegocio(res.locals.entrada.body));
  },
);
