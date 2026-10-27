// @ts-check
// Pruebas de autenticación y roles: login, bloqueo por intentos fallidos,
// rotación de refresh tokens, cierre de sesión y permisos por rol.
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { hashearContrasena } from '../src/lib/contrasenas.js';
import { prisma } from '../src/lib/db.js';
import { conNegocio } from '../src/lib/negocio.js';
import { autenticar, permitirRoles } from '../src/middlewares/auth.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';
import { MAXIMO_INTENTOS_FALLIDOS } from '../src/modules/auth/auth.service.js';

const app = createApp();
const NIT = '800000001';
const CONTRASENA = 'Cafe-de-prueba-2026';

/** @type {string} */
let tenantId;

/**
 * Crea un usuario de prueba en el negocio.
 * @param {string} email
 * @param {'dueno' | 'administrador' | 'cajero' | 'mesero'} rol
 * @param {{ activo?: boolean }} [opciones]
 */
async function crearUsuario(email, rol, { activo = true } = {}) {
  const passwordHash = await hashearContrasena(CONTRASENA);
  return conNegocio(tenantId, (tx) =>
    tx.usuario.create({ data: { tenantId, nombre: email, email, passwordHash, rol, activo } }),
  );
}

/**
 * Inicia sesión por la API.
 * @param {string} email
 * @param {string} [password]
 */
function login(email, password = CONTRASENA) {
  return request(app).post('/auth/login').send({ nit: NIT, email, password });
}

beforeAll(async () => {
  const negocio = await prisma.tenant.create({ data: { nombre: 'Café Auth', nit: NIT } });
  tenantId = negocio.id;
  await crearUsuario('dueno@cafe.co', 'dueno');
  await crearUsuario('mesero@cafe.co', 'mesero');
  await crearUsuario('bloqueo@cafe.co', 'cajero');
  await crearUsuario('inactivo@cafe.co', 'cajero', { activo: false });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /auth/login', () => {
  it('con credenciales correctas entrega tokens y los datos del usuario', async () => {
    const res = await login('dueno@cafe.co');

    expect(res.status).toBe(200);
    expect(res.body.tokenAcceso).toEqual(expect.any(String));
    expect(res.body.refreshToken).toMatch(new RegExp(`^${tenantId}\\.`));
    expect(res.body.expiraEnSegundos).toBe(15 * 60);
    expect(res.body.usuario).toMatchObject({ email: 'dueno@cafe.co', rol: 'dueno' });
    // Nunca se devuelve el hash de la contraseña.
    expect(JSON.stringify(res.body)).not.toContain('argon2');
  });

  it('acepta el correo con mayúsculas y espacios', async () => {
    const res = await login('  Dueno@Cafe.CO ');

    expect(res.status).toBe(200);
  });

  it('responde lo mismo si falla el NIT, el correo o la contraseña', async () => {
    const nitMalo = await request(app)
      .post('/auth/login')
      .send({ nit: '999999999', email: 'dueno@cafe.co', password: CONTRASENA });
    const correoMalo = await login('nadie@cafe.co');
    const claveMala = await login('mesero@cafe.co', 'incorrecta');

    for (const res of [nitMalo, correoMalo, claveMala]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: { code: 'CREDENCIALES_INVALIDAS', message: 'NIT, correo o contraseña incorrectos' },
      });
    }
  });

  it('un usuario desactivado no puede entrar', async () => {
    const res = await login('inactivo@cafe.co');

    expect(res.status).toBe(401);
  });

  it('valida la entrada antes de llegar al controlador', async () => {
    const sinCorreo = await request(app).post('/auth/login').send({ nit: NIT, password: 'x' });
    const nitInvalido = await request(app)
      .post('/auth/login')
      .send({ nit: '900.123-4', email: 'a@b.co', password: 'x' });

    expect(sinCorreo.status).toBe(400);
    expect(sinCorreo.body.error.code).toBe('VALIDATION_ERROR');
    expect(nitInvalido.status).toBe(400);
  });

  it(`bloquea la cuenta tras ${MAXIMO_INTENTOS_FALLIDOS} intentos fallidos`, async () => {
    for (let intento = 1; intento <= MAXIMO_INTENTOS_FALLIDOS; intento++) {
      const res = await login('bloqueo@cafe.co', 'incorrecta');
      expect(res.status).toBe(401);
    }

    // Bloqueada: ni con la contraseña correcta puede entrar.
    const bloqueada = await login('bloqueo@cafe.co');
    expect(bloqueada.status).toBe(423);
    expect(bloqueada.body.error.code).toBe('CUENTA_BLOQUEADA');

    // Cuando pasa el tiempo de bloqueo, vuelve a poder entrar.
    await conNegocio(tenantId, (tx) =>
      tx.usuario.updateMany({
        where: { email: 'bloqueo@cafe.co' },
        data: { bloqueadoHasta: new Date(Date.now() - 1000) },
      }),
    );
    const desbloqueada = await login('bloqueo@cafe.co');
    expect(desbloqueada.status).toBe(200);
  });

  it('guarda la contraseña como hash argon2id, nunca en claro', async () => {
    const usuario = await conNegocio(tenantId, (tx) =>
      tx.usuario.findFirst({ where: { email: 'dueno@cafe.co' } }),
    );

    expect(usuario?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(usuario?.passwordHash).not.toContain(CONTRASENA);
  });
});

describe('GET /auth/yo (ruta protegida)', () => {
  it('con un token válido devuelve el usuario y su negocio', async () => {
    const { body } = await login('mesero@cafe.co');
    const res = await request(app)
      .get('/auth/yo')
      .set('Authorization', `Bearer ${body.tokenAcceso}`);

    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ email: 'mesero@cafe.co', rol: 'mesero' });
    expect(res.body.negocio).toMatchObject({ nit: NIT, regimenImpuesto: 'responsable_inc' });
  });

  it('sin token responde 401', async () => {
    const res = await request(app).get('/auth/yo');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NO_AUTENTICADO');
  });

  it('rechaza un token alterado', async () => {
    const { body } = await login('mesero@cafe.co');
    const alterado = body.tokenAcceso.slice(0, -2) + (body.tokenAcceso.endsWith('A') ? 'BB' : 'AA');
    const res = await request(app).get('/auth/yo').set('Authorization', `Bearer ${alterado}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALIDO');
  });

  it('rechaza un token sin firma ("alg: none")', async () => {
    const parte = (/** @type {object} */ datos) =>
      Buffer.from(JSON.stringify(datos)).toString('base64url');
    const sinFirma = `${parte({ alg: 'none', typ: 'JWT' })}.${parte({ sub: 'x', tenantId, rol: 'dueno' })}.`;
    const res = await request(app).get('/auth/yo').set('Authorization', `Bearer ${sinFirma}`);

    expect(res.status).toBe(401);
  });

  it('distingue un token vencido para que la app use el refresh token', async () => {
    const vencido = jwt.sign(
      { tenantId, rol: 'dueno', exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET ?? '',
      { subject: '00000000-0000-4000-8000-000000000000' },
    );
    const res = await request(app).get('/auth/yo').set('Authorization', `Bearer ${vencido}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRADO');
  });
});

describe('POST /auth/refresh y /auth/logout', () => {
  it('entrega tokens nuevos y el refresh token usado deja de servir (rotación)', async () => {
    const { body: inicial } = await login('dueno@cafe.co');

    const renovada = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: inicial.refreshToken });
    expect(renovada.status).toBe(200);
    expect(renovada.body.refreshToken).not.toBe(inicial.refreshToken);

    const reutilizada = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: inicial.refreshToken });
    expect(reutilizada.status).toBe(401);
  });

  it('si un refresh token se reutiliza, se cierran todas las sesiones del usuario', async () => {
    const { body: inicial } = await login('mesero@cafe.co');
    const { body: renovada } = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: inicial.refreshToken });

    // Alguien usa el token viejo (posible robo)...
    await request(app).post('/auth/refresh').send({ refreshToken: inicial.refreshToken });

    // ...y la sesión legítima también queda cerrada por seguridad.
    const legitima = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: renovada.refreshToken });
    expect(legitima.status).toBe(401);
  });

  it('rechaza refresh tokens inventados o con formato inválido', async () => {
    const inventado = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: `${tenantId}.inventado` });
    const sinFormato = await request(app).post('/auth/refresh').send({ refreshToken: 'abc' });

    expect(inventado.status).toBe(401);
    expect(sinFormato.status).toBe(401);
    expect(sinFormato.body.error.code).toBe('REFRESH_INVALIDO');
  });

  it('cerrar sesión revoca el refresh token y repetirlo no es un error', async () => {
    const { body } = await login('dueno@cafe.co');

    const cierre = await request(app)
      .post('/auth/logout')
      .send({ refreshToken: body.refreshToken });
    const repetido = await request(app)
      .post('/auth/logout')
      .send({ refreshToken: body.refreshToken });
    const renovar = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: body.refreshToken });

    expect(cierre.status).toBe(204);
    expect(repetido.status).toBe(204);
    expect(renovar.status).toBe(401);
  });
});

describe('permitirRoles', () => {
  // App mínima con una ruta solo para el dueño.
  const appRoles = express();
  appRoles.get('/solo-dueno', autenticar, permitirRoles('dueno'), (_req, res) => {
    res.json({ ok: true });
  });
  appRoles.use(errorHandler);

  it('deja pasar al rol permitido', async () => {
    const { body } = await login('dueno@cafe.co');
    const res = await request(appRoles)
      .get('/solo-dueno')
      .set('Authorization', `Bearer ${body.tokenAcceso}`);

    expect(res.status).toBe(200);
  });

  it('responde 403 a un rol sin permiso', async () => {
    const { body } = await login('mesero@cafe.co');
    const res = await request(appRoles)
      .get('/solo-dueno')
      .set('Authorization', `Bearer ${body.tokenAcceso}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SIN_PERMISO');
  });
});
