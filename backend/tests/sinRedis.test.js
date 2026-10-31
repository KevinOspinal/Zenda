// @ts-check
// El API sin Redis (REDIS_URL vacía), como en el piloto: /health responde bien y los límites
// de peticiones siguen funcionando, con los contadores en memoria.
import express from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';

// Se quita REDIS_URL antes de importar la app, que lee la configuración al cargarse.
const { redisOriginal } = vi.hoisted(() => {
  const redisOriginal = process.env.REDIS_URL;
  delete process.env.REDIS_URL;
  return { redisOriginal };
});

const { createApp } = await import('../src/app.js');
const { prisma } = await import('../src/lib/db.js');
const { redis } = await import('../src/lib/redis.js');
const { errorHandler } = await import('../src/middlewares/errorHandler.js');
const { crearLimitador } = await import('../src/middlewares/limitePeticiones.js');

afterAll(async () => {
  await prisma.$disconnect();
  process.env.REDIS_URL = redisOriginal;
});

describe('API sin Redis', () => {
  it('no crea el cliente de Redis', () => {
    expect(redis).toBeNull();
  });

  it('/health responde 200 e indica que Redis no está configurado', async () => {
    const res = await request(createApp()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      servicios: { baseDeDatos: 'ok', redis: 'sin_configurar' },
    });
  });

  it('el límite de peticiones funciona con los contadores en memoria', async () => {
    const mini = express();
    mini.get(
      '/',
      crearLimitador({ nombre: 'prueba', maximo: 2, ventanaMs: 60_000 }),
      (_req, res) => {
        res.json({ ok: true });
      },
    );
    mini.use(errorHandler);

    const respuestas = [];
    for (let i = 0; i < 3; i += 1) respuestas.push(await request(mini).get('/'));

    expect(respuestas.map((res) => res.status)).toEqual([200, 200, 429]);
    expect(respuestas[2].body.error.code).toBe('DEMASIADAS_SOLICITUDES');
  });
});
