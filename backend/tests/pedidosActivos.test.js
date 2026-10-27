// @ts-check
// Pruebas de lo que necesitan el mapa de mesas y la cocina:
// - GET /pedidos?activos=true&incluirItems=true: pedidos sin cobrar con sus ítems.
// - GET /caja/estado: si la caja está abierta, para todos los roles y sin montos.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { conNegocio } from '../src/lib/negocio.js';
import { crearNegocioDePrueba } from './ayudantes.js';

const app = createApp();

/** @type {import('./ayudantes.js').NegocioDePrueba} */
let negocio;
/** @type {import('./ayudantes.js').NegocioDePrueba} */
let otroNegocio;
const ids = { hamburguesa: '', gaseosa: '', mesa1: '', mesa2: '' };

/**
 * @param {'get' | 'post' | 'patch'} metodo
 * @param {string} ruta
 * @param {string} encabezado
 * @param {Record<string, unknown>} [cuerpo]
 */
function llamar(metodo, ruta, encabezado, cuerpo) {
  const peticion = request(app)[metodo](ruta).set('Authorization', encabezado);
  return cuerpo ? peticion.send(cuerpo) : peticion;
}

beforeAll(async () => {
  negocio = await crearNegocioDePrueba('806000001');
  otroNegocio = await crearNegocioDePrueba('806000002');

  await conNegocio(negocio.tenantId, async (tx) => {
    const categoria = await tx.categoria.create({
      data: { tenantId: negocio.tenantId, nombre: 'Comidas' },
    });
    const crearProducto = (nombre, precio) =>
      tx.producto.create({
        data: {
          tenantId: negocio.tenantId,
          categoriaId: categoria.id,
          nombre,
          precio,
          tipoImpuesto: 'impoconsumo',
        },
      });
    ids.hamburguesa = (await crearProducto('IND Classic Artesanal', '12000')).id;
    ids.gaseosa = (await crearProducto('Gaseosa personal', '4000')).id;
    const crearMesa = (nombre) =>
      tx.mesa.create({ data: { tenantId: negocio.tenantId, nombre, capacidad: 4 } });
    ids.mesa1 = (await crearMesa('Mesa 1')).id;
    ids.mesa2 = (await crearMesa('Mesa 2')).id;
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /caja/estado', () => {
  it('el mesero sabe que la caja está cerrada', async () => {
    const res = await llamar('get', '/caja/estado', negocio.encabezados.mesero);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ abierta: false, turnoId: null, abiertoEn: null });
  });

  it('cuando el cajero abre la caja, el mesero lo ve, sin montos', async () => {
    const apertura = await llamar('post', '/caja/abrir', negocio.encabezados.cajero, {
      montoInicial: 100000,
    });

    const res = await llamar('get', '/caja/estado', negocio.encabezados.mesero);

    expect(res.body).toEqual({
      abierta: true,
      turnoId: apertura.body.id,
      abiertoEn: apertura.body.abiertoEn,
    });
    expect(JSON.stringify(res.body)).not.toContain('100000');
  });

  it('la caja de un negocio no afecta al otro', async () => {
    const res = await llamar('get', '/caja/estado', otroNegocio.encabezados.mesero);

    expect(res.body.abierta).toBe(false);
  });

  it('sin sesión no se puede consultar', async () => {
    const res = await request(app).get('/caja/estado');

    expect(res.status).toBe(401);
  });
});

describe('GET /pedidos?activos=true&incluirItems=true', () => {
  /** @type {string} */
  let enCocinaId;
  /** @type {string} */
  let pagadoId;

  beforeAll(async () => {
    // Mesa 1: pedido enviado a cocina con dos productos.
    const enCocina = await llamar('post', '/pedidos', negocio.encabezados.mesero, {
      mesaId: ids.mesa1,
      items: [
        { productoId: ids.hamburguesa, cantidad: 2, notas: 'Sin cebolla' },
        { productoId: ids.gaseosa, cantidad: 1 },
      ],
    });
    enCocinaId = enCocina.body.id;
    await llamar('post', `/pedidos/${enCocinaId}/enviar-cocina`, negocio.encabezados.mesero);

    // Mostrador: pedido ya cobrado (no debe salir entre los activos).
    const pagado = await llamar('post', '/pedidos', negocio.encabezados.cajero, {
      items: [{ productoId: ids.gaseosa, cantidad: 1 }],
    });
    pagadoId = pagado.body.id;
    await llamar('post', `/pedidos/${pagadoId}/cobrar`, negocio.encabezados.cajero, {
      pagos: [{ metodo: 'efectivo', monto: '4000' }],
    });

    // Mesa 2: pedido abierto, aún sin enviar a cocina.
    await llamar('post', '/pedidos', negocio.encabezados.mesero, {
      mesaId: ids.mesa2,
      items: [{ productoId: ids.hamburguesa, cantidad: 1 }],
    });
  });

  it('trae solo los pedidos sin cobrar ni anular', async () => {
    const res = await llamar('get', '/pedidos?activos=true', negocio.encabezados.mesero);

    expect(res.status).toBe(200);
    expect(res.body.map((/** @type {any} */ p) => p.estado).sort()).toEqual([
      'abierto',
      'enviado_a_cocina',
    ]);
    expect(res.body.some((/** @type {any} */ p) => p.id === pagadoId)).toBe(false);
    // Sin incluirItems, no trae ítems.
    expect(res.body[0]).not.toHaveProperty('items');
  });

  it('con incluirItems trae los ítems con su producto y estado de cocina, en orden', async () => {
    const res = await llamar(
      'get',
      '/pedidos?activos=true&incluirItems=true',
      negocio.encabezados.mesero,
    );

    const enCocina = res.body.find((/** @type {any} */ p) => p.id === enCocinaId);
    expect(enCocina.mesa).toEqual({ id: ids.mesa1, nombre: 'Mesa 1' });
    expect(
      enCocina.items.map((/** @type {any} */ i) => ({
        producto: i.producto.nombre,
        cantidad: i.cantidad,
        notas: i.notas,
        estadoCocina: i.estadoCocina,
      })),
    ).toEqual([
      {
        producto: 'IND Classic Artesanal',
        cantidad: '2',
        notas: 'Sin cebolla',
        estadoCocina: 'pendiente',
      },
      { producto: 'Gaseosa personal', cantidad: '1', notas: null, estadoCocina: 'pendiente' },
    ]);
  });

  it('no se puede combinar activos con estado', async () => {
    const res = await llamar(
      'get',
      '/pedidos?activos=true&estado=pagado',
      negocio.encabezados.mesero,
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('el otro negocio no ve estos pedidos', async () => {
    const res = await llamar(
      'get',
      '/pedidos?activos=true&incluirItems=true',
      otroNegocio.encabezados.mesero,
    );

    expect(res.body).toEqual([]);
  });
});
