// @ts-check
// Rutas de autenticación. Se montan en /auth (ver src/app.js).
import { Router } from 'express';
import { autenticar } from '../../middlewares/auth.js';
import { limiteLogin, limiteRefresh } from '../../middlewares/limitePeticiones.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './auth.controller.js';
import { esquemaCambiarContrasena, esquemaLogin, esquemaRefreshToken } from './auth.schemas.js';

export const rutasAuth = Router();

rutasAuth.post('/login', limiteLogin, validar({ body: esquemaLogin }), controlador.login);
rutasAuth.post(
  '/refresh',
  limiteRefresh,
  validar({ body: esquemaRefreshToken }),
  controlador.refresh,
);
rutasAuth.post('/logout', validar({ body: esquemaRefreshToken }), controlador.logout);
rutasAuth.get('/yo', autenticar, controlador.perfil);
rutasAuth.post(
  '/cambiar-contrasena',
  autenticar,
  validar({ body: esquemaCambiarContrasena }),
  controlador.cambiarContrasena,
);
