// @ts-check
// Rutas de autenticación. Se montan en /auth (ver src/app.js).
import { Router } from 'express';
import { autenticar } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './auth.controller.js';
import { esquemaLogin, esquemaRefreshToken } from './auth.schemas.js';

export const rutasAuth = Router();

rutasAuth.post('/login', validar({ body: esquemaLogin }), controlador.login);
rutasAuth.post('/refresh', validar({ body: esquemaRefreshToken }), controlador.refresh);
rutasAuth.post('/logout', validar({ body: esquemaRefreshToken }), controlador.logout);
rutasAuth.get('/yo', autenticar, controlador.perfil);
