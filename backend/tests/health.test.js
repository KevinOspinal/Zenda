// @ts-check
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';

describe('GET /health', () => {
  it('responde 200 con status ok', async () => {
    const res = await request(createApp()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('manejo de errores', () => {
  it('responde 404 con el formato uniforme', async () => {
    const res = await request(createApp()).get('/no-existe');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Ruta no encontrada: GET /no-existe' },
    });
  });

  it('responde 400 si el JSON está mal formado', async () => {
    const res = await request(createApp())
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{malo');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('parseEnv', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
  };

  it('aplica valores por defecto', () => {
    const env = parseEnv(base);

    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('falla si falta DATABASE_URL, sin mostrar valores', () => {
    expect(() => parseEnv({ REDIS_URL: base.REDIS_URL })).toThrow(/DATABASE_URL/);
  });

  it('rechaza una URL de base de datos que no sea PostgreSQL', () => {
    expect(() => parseEnv({ ...base, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });
});
