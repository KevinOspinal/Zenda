// @ts-check
// Pruebas de seguridad y estabilidad: cabeceras de seguridad, límite de peticiones por IP
// y /health cuando un servicio está caído.
import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { redis } from '../src/lib/redis.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';
import { crearLimitador } from '../src/middlewares/limitePeticiones.js';

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
});

describe('cabeceras de seguridad (helmet)', () => {
  it('todas las respuestas traen las cabeceras de seguridad', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers).not.toHaveProperty('x-powered-by');
  });

  it('sin HTTPS (desarrollo) no obliga a pasar a HTTPS, así Swagger carga en localhost', async () => {
    const res = await request(app).get('/docs/');

    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
  });
});

describe('límite de peticiones por IP', () => {
  /**
   * App mínima con un limitador de 2 peticiones por minuto. El nombre es único en cada
   * corrida para que los contadores de Redis de corridas anteriores no interfieran.
   */
  function appConLimite() {
    const mini = express();
    mini.get(
      '/',
      crearLimitador({ nombre: `prueba-${randomUUID()}`, maximo: 2, ventanaMs: 60_000 }),
      (_req, res) => {
        res.json({ ok: true });
      },
    );
    mini.use(errorHandler);
    return mini;
  }

  it('deja pasar hasta el máximo y después responde 429 con el formato de error uniforme', async () => {
    const mini = appConLimite();

    const primera = await request(mini).get('/');
    const segunda = await request(mini).get('/');
    const tercera = await request(mini).get('/');

    expect(primera.status).toBe(200);
    expect(segunda.status).toBe(200);
    expect(tercera.status).toBe(429);
    expect(tercera.body.error.code).toBe('DEMASIADAS_SOLICITUDES');
    // La app sabe cuánto esperar antes de volver a intentar.
    expect(Number(tercera.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('cada limitador cuenta por separado', async () => {
    const login = appConLimite();
    const registro = appConLimite();

    await request(login).get('/');
    await request(login).get('/');
    const otroLimitador = await request(registro).get('/');

    expect(otroLimitador.status).toBe(200);
  });
});

describe('GET /health con un servicio caído', () => {
  it('responde 503 e indica cuál servicio no responde', async () => {
    vi.spyOn(redis, 'ping').mockRejectedValue(new Error('Redis caído'));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'error', servicios: { baseDeDatos: 'ok', redis: 'caido' } });
  });
});
