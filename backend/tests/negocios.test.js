// @ts-check
// Pruebas del registro de negocios: crea el negocio y su dueño con la sesión iniciada,
// NIT único, validaciones, aislamiento del negocio nuevo y cierre del registro en producción.
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { registroHabilitado } from '../src/modules/negocios/negocios.service.js';

const app = createApp();

/**
 * Datos de registro válidos, con los cambios indicados.
 * @param {{ negocio?: Record<string, unknown>, dueno?: Record<string, unknown> }} [cambios]
 */
function datosRegistro(cambios = {}) {
  return {
    negocio: {
      nombre: 'Café La Esquina',
      nit: '790000001',
      ciudad: 'Medellín',
      ...cambios.negocio,
    },
    dueno: {
      nombre: 'María López',
      email: 'maria@laesquina.test',
      contrasena: 'Esquina2026',
      ...cambios.dueno,
    },
  };
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /negocios/registro', () => {
  it('crea el negocio y su dueño, con la sesión ya iniciada', async () => {
    const res = await request(app).post('/negocios/registro').send(datosRegistro());

    expect(res.status).toBe(201);
    expect(res.body.negocio).toMatchObject({
      nombre: 'Café La Esquina',
      nit: '790000001',
      ciudad: 'Medellín',
      // Si no se indica, el régimen es el de un restaurante independiente (INC 8 %).
      regimenImpuesto: 'responsable_inc',
    });
    expect(res.body.usuario).toMatchObject({ email: 'maria@laesquina.test', rol: 'dueno' });

    // El token de la respuesta ya sirve.
    const perfil = await request(app)
      .get('/auth/yo')
      .set('Authorization', `Bearer ${res.body.tokenAcceso}`);
    expect(perfil.body.negocio.nit).toBe('790000001');
  });

  it('el dueño puede iniciar sesión después con el NIT, su correo y su contraseña', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ nit: '790000001', email: 'maria@laesquina.test', password: 'Esquina2026' });

    expect(res.status).toBe(200);
  });

  it('el negocio nuevo empieza vacío: no ve datos de otros negocios', async () => {
    const { body } = await request(app)
      .post('/negocios/registro')
      .send(datosRegistro({ negocio: { nit: '790000002' }, dueno: { email: 'b@b.test' } }));
    const autorizacion = `Bearer ${body.tokenAcceso}`;

    const mesas = await request(app).get('/mesas').set('Authorization', autorizacion);
    const usuarios = await request(app).get('/usuarios').set('Authorization', autorizacion);

    expect(mesas.body).toEqual([]);
    expect(usuarios.body.map((/** @type {{ email: string }} */ u) => u.email)).toEqual([
      'b@b.test',
    ]);
  });

  it('permite elegir el régimen de impuesto (franquicia con IVA)', async () => {
    const res = await request(app)
      .post('/negocios/registro')
      .send(
        datosRegistro({
          negocio: { nit: '790000003', regimenImpuesto: 'franquicia_iva' },
          dueno: { email: 'c@c.test' },
        }),
      );

    expect(res.body.negocio.regimenImpuesto).toBe('franquicia_iva');
  });

  it('no permite registrar dos veces el mismo NIT', async () => {
    const res = await request(app)
      .post('/negocios/registro')
      .send(datosRegistro({ dueno: { email: 'otro@correo.test' } }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NIT_YA_REGISTRADO');
  });

  it('valida el NIT, el correo y la contraseña del dueño', async () => {
    const nitConPuntos = await request(app)
      .post('/negocios/registro')
      .send(datosRegistro({ negocio: { nit: '900.123.456' } }));
    const correoMalo = await request(app)
      .post('/negocios/registro')
      .send(datosRegistro({ negocio: { nit: '790000009' }, dueno: { email: 'no-es-correo' } }));
    const claveDebil = await request(app)
      .post('/negocios/registro')
      .send(datosRegistro({ negocio: { nit: '790000009' }, dueno: { contrasena: '123' } }));

    expect(nitConPuntos.status).toBe(400);
    expect(correoMalo.status).toBe(400);
    expect(claveDebil.status).toBe(400);
  });
});

describe('registroHabilitado', () => {
  it('está abierto en desarrollo y cerrado en producción si no se configura', () => {
    expect(registroHabilitado({ NODE_ENV: 'development' })).toBe(true);
    expect(registroHabilitado({ NODE_ENV: 'production' })).toBe(false);
  });

  it('la variable REGISTRO_HABILITADO manda sobre el entorno', () => {
    expect(registroHabilitado({ NODE_ENV: 'production', REGISTRO_HABILITADO: true })).toBe(true);
    expect(registroHabilitado({ NODE_ENV: 'development', REGISTRO_HABILITADO: false })).toBe(false);
  });
});
