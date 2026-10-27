// @ts-check
// Arma la aplicación Express: middlewares, rutas y manejo de errores.
import express from 'express';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { rutasAuth } from './modules/auth/auth.routes.js';
import { rutasCaja } from './modules/caja/caja.routes.js';
import { rutasClientes } from './modules/clientes/clientes.routes.js';
import { rutasCategorias, rutasMenu, rutasProductos } from './modules/menu/menu.routes.js';
import { rutasMesas } from './modules/mesas/mesas.routes.js';
import { rutasPedidos } from './modules/pedidos/pedidos.routes.js';

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

  // Rutas de cada módulo.
  app.use('/auth', rutasAuth);
  app.use('/menu', rutasMenu);
  app.use('/categorias', rutasCategorias);
  app.use('/productos', rutasProductos);
  app.use('/mesas', rutasMesas);
  app.use('/clientes', rutasClientes);
  app.use('/caja', rutasCaja);
  app.use('/pedidos', rutasPedidos);

  // Estos dos van al final: atrapan rutas inexistentes y cualquier error de las rutas anteriores.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
