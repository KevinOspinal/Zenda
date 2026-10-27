// @ts-check
import express from 'express';
import { errorHandler, notFound } from './middlewares/errorHandler.js';

/**
 * Crea la app Express sin abrir el puerto, para poder probarla con Supertest.
 * @returns {import('express').Express}
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  // Indica si el proceso está vivo. Los chequeos de PostgreSQL y Redis llegan en la Fase 1.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
