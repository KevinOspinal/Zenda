// @ts-check
// Pruebas de los clientes: registro, documento único, búsqueda, permisos y aislamiento.
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
  negocio = await crearNegocioDePrueba('720000001');
  otroNegocio = await crearNegocioDePrueba('720000002');
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * @param {Record<string, unknown>} datos
 * @param {string} [encabezado]
 */
function crearCliente(datos, encabezado = negocio.encabezados.cajero) {
  return request(app).post('/clientes').set('Authorization', encabezado).send(datos);
}

describe('clientes', () => {
  it('el cajero registra un cliente; el correo se normaliza a minúsculas', async () => {
    const res = await crearCliente({
      tipoDocumento: 'cc',
      numeroDocumento: '1000000001',
      nombre: 'Ana María Ruiz',
      email: 'Ana.Ruiz@Ejemplo.TEST',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nombre: 'Ana María Ruiz', email: 'ana.ruiz@ejemplo.test' });
  });

  it('no permite repetir el mismo tipo y número de documento', async () => {
    const res = await crearCliente({
      tipoDocumento: 'cc',
      numeroDocumento: '1000000001',
      nombre: 'Otra persona',
    });

    expect(res.status).toBe(409);
  });

  it('valida el documento según su tipo y el formato del correo', async () => {
    const cedulaConLetras = await crearCliente({
      tipoDocumento: 'cc',
      numeroDocumento: 'AB12345',
      nombre: 'X',
    });
    const pasaporte = await crearCliente({
      tipoDocumento: 'pasaporte',
      numeroDocumento: 'AB12345',
      nombre: 'Turista',
    });
    const correoMalo = await crearCliente({
      tipoDocumento: 'cc',
      numeroDocumento: '1000000002',
      nombre: 'X',
      email: 'no-es-correo',
    });

    expect(cedulaConLetras.status).toBe(400);
    expect(pasaporte.status).toBe(201);
    expect(correoMalo.status).toBe(400);
  });

  it('busca por nombre (sin importar mayúsculas) o por inicio del documento', async () => {
    await crearCliente({ tipoDocumento: 'nit', numeroDocumento: '900555666', nombre: 'Empresa X' });

    const porNombre = await request(app)
      .get('/clientes?buscar=maría')
      .set('Authorization', negocio.encabezados.cajero);
    const porDocumento = await request(app)
      .get('/clientes?buscar=900555')
      .set('Authorization', negocio.encabezados.cajero);

    expect(porNombre.body.map((/** @type {{ nombre: string }} */ c) => c.nombre)).toEqual([
      'Ana María Ruiz',
    ]);
    expect(porDocumento.body.map((/** @type {{ nombre: string }} */ c) => c.nombre)).toEqual([
      'Empresa X',
    ]);
  });

  it('el mesero no accede a los datos personales de los clientes', async () => {
    const res = await request(app)
      .get('/clientes')
      .set('Authorization', negocio.encabezados.mesero);

    expect(res.status).toBe(403);
  });

  it('otro negocio no ve los clientes de este', async () => {
    const res = await request(app)
      .get('/clientes?buscar=maría')
      .set('Authorization', otroNegocio.encabezados.cajero);

    expect(res.body).toEqual([]);
  });
});
