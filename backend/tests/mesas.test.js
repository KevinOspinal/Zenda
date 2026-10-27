// @ts-check
// Pruebas de las mesas: CRUD, nombres únicos por negocio, permisos y aislamiento.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { crearNegocioDePrueba } from './ayudantes.js';

const app = createApp();

/** @type {import('./ayudantes.js').NegocioDePrueba} */
let negocio;
/** @type {import('./ayudantes.js').NegocioDePrueba} */
let otroNegocio;

beforeAll(async () => {
  negocio = await crearNegocioDePrueba('710000001');
  otroNegocio = await crearNegocioDePrueba('710000002');
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * @param {Record<string, unknown>} datos
 * @param {string} [encabezado]
 */
function crearMesa(datos, encabezado = negocio.encabezados.administrador) {
  return request(app).post('/mesas').set('Authorization', encabezado).send(datos);
}

describe('mesas', () => {
  it('el administrador crea una mesa libre y el mesero la ve', async () => {
    const creada = await crearMesa({ nombre: 'Mesa 1', zona: 'Salón', capacidad: 4 });
    const lista = await request(app).get('/mesas').set('Authorization', negocio.encabezados.mesero);

    expect(creada.status).toBe(201);
    expect(creada.body).toMatchObject({ nombre: 'Mesa 1', estado: 'libre', capacidad: 4 });
    expect(lista.body.map((/** @type {{ nombre: string }} */ m) => m.nombre)).toContain('Mesa 1');
  });

  it('no permite dos mesas con el mismo nombre en el negocio', async () => {
    await crearMesa({ nombre: 'Barra', capacidad: 2 });
    const repetida = await crearMesa({ nombre: 'Barra', capacidad: 2 });

    expect(repetida.status).toBe(409);
    expect(repetida.body.error.code).toBe('YA_EXISTE');
  });

  it('otro negocio sí puede tener una mesa con el mismo nombre', async () => {
    const res = await crearMesa({ nombre: 'Mesa 1', capacidad: 2 }, otroNegocio.encabezados.dueno);

    expect(res.status).toBe(201);
  });

  it('valida la capacidad', async () => {
    const res = await crearMesa({ nombre: 'Sin sillas', capacidad: 0 });

    expect(res.status).toBe(400);
  });

  it('el mesero no puede crear mesas', async () => {
    const res = await crearMesa({ nombre: 'Mesa X', capacidad: 2 }, negocio.encabezados.mesero);

    expect(res.status).toBe(403);
  });

  it('el estado no se cambia por esta ruta: lo manejan los pedidos', async () => {
    const { body: mesa } = await crearMesa({ nombre: 'Mesa 2', capacidad: 4 });
    const res = await request(app)
      .patch(`/mesas/${mesa.id}`)
      .set('Authorization', negocio.encabezados.dueno)
      .send({ estado: 'ocupada', capacidad: 6 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: 'libre', capacidad: 6 });
  });

  it('elimina una mesa del negocio pero no una de otro negocio', async () => {
    const { body: mesa } = await crearMesa({ nombre: 'Mesa temporal', capacidad: 2 });

    const ajena = await request(app)
      .delete(`/mesas/${mesa.id}`)
      .set('Authorization', otroNegocio.encabezados.dueno);
    const propia = await request(app)
      .delete(`/mesas/${mesa.id}`)
      .set('Authorization', negocio.encabezados.dueno);

    expect(ajena.status).toBe(404);
    expect(propia.status).toBe(204);
  });

  it('un id que no es UUID se rechaza antes de llegar a la base', async () => {
    const res = await request(app)
      .get('/mesas/no-es-un-id')
      .set('Authorization', negocio.encabezados.mesero);

    expect(res.status).toBe(400);
  });
});
