// @ts-check
// Arma la aplicación Express: middlewares, rutas y manejo de errores.
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { documentoOpenApi } from './docs/openapi.js';
import { revisarSalud } from './lib/salud.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { MODULOS } from './rutas.js';

/**
 * Crea la app Express sin abrir el puerto, para poder probarla con Supertest.
 * @returns {import('express').Express}
 */
export function createApp() {
  const app = express();

  // No revelar que el servidor usa Express.
  app.disable('x-powered-by');
  // Detrás de un proxy, tomar la IP real del cliente (la usan los límites de peticiones).
  app.set('trust proxy', env.CONFIAR_EN_PROXY ? 1 : false);
  // Cabeceras de seguridad estándar (evitan que el navegador adivine tipos de archivo,
  // que el sitio se incruste en otros, etc.). Sin HTTPS (desarrollo) no se fuerza a
  // pasar a HTTPS, porque Swagger no cargaría sus estilos en localhost.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null },
      },
    }),
  );
  // Solo los orígenes configurados pueden llamar al API desde un navegador.
  // La autenticación va en el encabezado Authorization, no en cookies.
  app.use(cors({ origin: env.CORS_ORIGENES }));
  // Lee cuerpos JSON con un límite de tamaño para evitar abusos.
  app.use(express.json({ limit: '1mb' }));

  // Estado del servicio: 200 si PostgreSQL y Redis responden; 503 si alguno está caído.
  app.get('/health', async (_req, res) => {
    const salud = await revisarSalud();
    res.status(salud.status === 'ok' ? 200 : 503).json(salud);
  });

  // Documentación Swagger en /docs (activa por defecto, salvo en producción).
  if (env.DOCS_HABILITADA ?? env.NODE_ENV !== 'production') {
    app.get('/docs/openapi.json', (_req, res) => {
      res.json(documentoOpenApi);
    });
    app.use(
      '/docs',
      swaggerUi.serve,
      swaggerUi.setup(documentoOpenApi, {
        customSiteTitle: 'Zenda · Documentación del API',
        swaggerOptions: {
          // Recuerda el token al recargar la página.
          persistAuthorization: true,
          // Los grupos empiezan cerrados para ver todo el índice de un vistazo.
          docExpansion: 'none',
          // Muestra un buscador para filtrar endpoints por grupo.
          filter: true,
          // Muestra cuánto tardó cada petición hecha con "Try it out".
          displayRequestDuration: true,
        },
      }),
    );
  }

  // Rutas de cada módulo (la lista está en rutas.js).
  for (const [prefijo, rutas] of MODULOS) {
    app.use(prefijo, rutas);
  }

  // Estos dos van al final: atrapan rutas inexistentes y cualquier error de las rutas anteriores.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
