// @ts-check
// Arma la aplicación Express: middlewares, rutas y manejo de errores.
import express from 'express';
import { errorHandler, notFound } from './middlewares/errorHandler.js';

/**
 * Crea la app Express sin abrir el puerto, para poder probarla con Supertest.
 * @returns {import('express').Express}
 */
export function createApp() {
  const app = express();

  // No revelar que el servidor usa Express.
  app.disable('x-powered-by');
  // Lee cuerpos JSON con un límite de tamaño para evitar abusos.
  app.use(express.json({ limit: '1mb' }));

  // Indica si el proceso está vivo. Los chequeos de PostgreSQL y Redis llegan en la Fase 1.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Estos dos van al final: atrapan rutas inexistentes y cualquier error de las rutas anteriores.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
