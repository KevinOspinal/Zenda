// @ts-check
// Pruebas de inventario y auditoría: compras, ajustes, descuento al cobrar, devolución al
// anular, venta sin stock con advertencia, permisos, aislamiento y consulta de auditoría.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { sumar } from '../src/lib/dinero.js';
import { prisma } from '../src/lib/db.js';
import { conNegocio } from '../src/lib/negocio.js';
import { crearNegocioDePrueba } from './ayudantes.js';

const app = createApp();

/** @type {import('./ayudantes.js').NegocioDePrueba} */
let negocio;
/** @type {import('./ayudantes.js').NegocioDePrueba} */
let otroNegocio;

const ids = { gaseosa: '', hamburguesa: '', productoAjeno: '' };

beforeAll(async () => {
  negocio = await crearNegocioDePrueba('750000001');
  otroNegocio = await crearNegocioDePrueba('750000002');

  await conNegocio(negocio.tenantId, async (tx) => {
    const { id: categoriaId } = await tx.categoria.create({
      data: { tenantId: negocio.tenantId, nombre: 'Menú' },
    });
    const base = {
      tenantId: negocio.tenantId,
      categoriaId,
      tipoImpuesto: /** @type {const} */ ('impoconsumo'),
    };
    // La gaseosa controla inventario; la hamburguesa no (se prepara al momento).
    ids.gaseosa = (
      await tx.producto.create({
        data: { ...base, nombre: 'Gaseosa', precio: '4000', controlaStock: true },
      })
    ).id;
    ids.hamburguesa = (
      await tx.producto.create({ data: { ...base, nombre: 'Hamburguesa', precio: '12000' } })
    ).id;
  });

  ids.productoAjeno = await conNegocio(otroNegocio.tenantId, async (tx) => {
    const { id: categoriaId } = await tx.categoria.create({
      data: { tenantId: otroNegocio.tenantId, nombre: 'Menú' },
    });
    const producto = await tx.producto.create({
      data: {
        tenantId: otroNegocio.tenantId,
        categoriaId,
        nombre: 'Ajeno',
        precio: '1000',
        tipoImpuesto: 'impoconsumo',
        controlaStock: true,
      },
    });
    return producto.id;
  });

  await request(app)
    .post('/caja/abrir')
    .set('Authorization', negocio.encabezados.cajero)
    .send({ montoInicial: 0 });
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * @param {'get' | 'post' | 'patch'} metodo
 * @param {string} ruta
 * @param {'dueno' | 'administrador' | 'cajero' | 'mesero'} rol
 * @param {Record<string, unknown>} [cuerpo]
 */
function llamar(metodo, ruta, rol, cuerpo) {
  const peticion = request(app)[metodo](ruta).set('Authorization', negocio.encabezados[rol]);
  return cuerpo ? peticion.send(cuerpo) : peticion;
}

/** Stock actual de la gaseosa, como texto. */
async function stockGaseosa() {
  const producto = await conNegocio(negocio.tenantId, (tx) =>
    tx.producto.findUniqueOrThrow({ where: { id: ids.gaseosa } }),
  );
  return producto.stock.toString();
}

/**
 * Crea un pedido de mostrador y lo cobra.
 * @param {{ productoId: string, cantidad: number }[]} items
 */
async function venderYCobrar(items) {
  const { body: pedido } = await llamar('post', '/pedidos', 'cajero', { items });
  const cobro = await llamar('post', `/pedidos/${pedido.id}/cobrar`, 'cajero', {
    pagos: [{ metodo: 'efectivo', monto: pedido.total }],
  });
  return { pedido, cobro };
}

describe('compras y ajustes', () => {
  it('una compra suma al stock', async () => {
    const res = await llamar('post', '/inventario/movimientos', 'administrador', {
      tipo: 'compra',
      productoId: ids.gaseosa,
      cantidad: 10,
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nombre: 'Gaseosa', stock: '10' });
  });

  it('valida compras, ajustes y productos sin inventario', async () => {
    const compraNegativa = await llamar('post', '/inventario/movimientos', 'dueno', {
      tipo: 'compra',
      productoId: ids.gaseosa,
      cantidad: -5,
    });
    const ajusteSinMotivo = await llamar('post', '/inventario/movimientos', 'dueno', {
      tipo: 'ajuste',
      productoId: ids.gaseosa,
      cantidad: -1,
    });
    const cantidadCero = await llamar('post', '/inventario/movimientos', 'dueno', {
      tipo: 'compra',
      productoId: ids.gaseosa,
      cantidad: 0,
    });
    const sinInventario = await llamar('post', '/inventario/movimientos', 'dueno', {
      tipo: 'compra',
      productoId: ids.hamburguesa,
      cantidad: 5,
    });
    const tipoVenta = await llamar('post', '/inventario/movimientos', 'dueno', {
      tipo: 'venta',
      productoId: ids.gaseosa,
      cantidad: -1,
    });

    expect(compraNegativa.status).toBe(400);
    expect(ajusteSinMotivo.status).toBe(400);
    expect(cantidadCero.status).toBe(400);
    expect(sinInventario.status).toBe(422);
    expect(sinInventario.body.error.code).toBe('PRODUCTO_SIN_INVENTARIO');
    // Las ventas solo las genera el cobro de un pedido.
    expect(tipoVenta.status).toBe(400);
  });

  it('un ajuste negativo resta y queda en la auditoría con su motivo', async () => {
    const res = await llamar('post', '/inventario/movimientos', 'dueno', {
      tipo: 'ajuste',
      productoId: ids.gaseosa,
      cantidad: -2,
      motivo: 'Dos botellas rotas',
    });
    const registro = await conNegocio(negocio.tenantId, (tx) =>
      tx.auditoria.findFirst({ where: { accion: 'ajustar_inventario' } }),
    );

    expect(res.body.stock).toBe('8');
    expect(registro).toMatchObject({
      usuarioId: negocio.usuarios.dueno,
      detalle: { motivo: 'Dos botellas rotas', stockAnterior: '10', stockNuevo: '8' },
    });
  });

  it('no se puede mover el inventario de un producto de otro negocio', async () => {
    const res = await llamar('post', '/inventario/movimientos', 'dueno', {
      tipo: 'compra',
      productoId: ids.productoAjeno,
      cantidad: 100,
    });

    expect(res.status).toBe(404);
  });
});

describe('inventario y ventas', () => {
  /** @type {string} */
  let pedidoCobradoId;

  it('el stock no cambia mientras el pedido no se cobre', async () => {
    await llamar('post', '/pedidos', 'mesero', {
      items: [{ productoId: ids.gaseosa, cantidad: 1 }],
    });

    expect(await stockGaseosa()).toBe('8');
  });

  it('al cobrar se descuentan solo los productos que controlan inventario', async () => {
    const { pedido, cobro } = await venderYCobrar([
      { productoId: ids.gaseosa, cantidad: 2 },
      { productoId: ids.hamburguesa, cantidad: 1 },
      { productoId: ids.gaseosa, cantidad: 1 },
    ]);
    pedidoCobradoId = pedido.id;

    const movimientos = await conNegocio(negocio.tenantId, (tx) =>
      tx.movimientoInventario.findMany({ where: { pedidoId: pedido.id } }),
    );

    expect(cobro.status).toBe(200);
    expect(cobro.body.advertencias).toEqual([]);
    expect(await stockGaseosa()).toBe('5');
    // Un solo movimiento por producto aunque aparezca en dos ítems.
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0]).toMatchObject({ tipo: 'venta', productoId: ids.gaseosa });
    expect(movimientos[0].cantidad.toString()).toBe('-3');
  });

  it('al anular una venta cobrada el stock se devuelve', async () => {
    await llamar('post', `/pedidos/${pedidoCobradoId}/anular`, 'administrador', {
      motivo: 'Cobro duplicado',
    });

    expect(await stockGaseosa()).toBe('8');
  });

  it('se puede vender sin stock suficiente, con una advertencia', async () => {
    const { cobro } = await venderYCobrar([{ productoId: ids.gaseosa, cantidad: 10 }]);

    expect(cobro.status).toBe(200);
    expect(cobro.body.advertencias).toEqual([
      { productoId: ids.gaseosa, nombre: 'Gaseosa', stock: '-2' },
    ]);
  });

  it('el stock siempre es igual a la suma de sus movimientos', async () => {
    const producto = await conNegocio(negocio.tenantId, (tx) =>
      tx.producto.findUniqueOrThrow({ where: { id: ids.gaseosa }, include: { movimientos: true } }),
    );

    expect(sumar(producto.movimientos.map((m) => m.cantidad)).equals(producto.stock)).toBe(true);
  });

  it('el inventario muestra primero los productos con stock negativo', async () => {
    const res = await llamar('get', '/inventario', 'cajero');
    const movimientos = await llamar('get', `/inventario/${ids.gaseosa}/movimientos`, 'cajero');

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ nombre: 'Gaseosa', stock: '-2' });
    // compra, ajuste, venta, devolución por anulación, venta
    expect(movimientos.body.map((/** @type {{ tipo: string }} */ m) => m.tipo).sort()).toEqual([
      'ajuste',
      'ajuste',
      'compra',
      'venta',
      'venta',
    ]);
  });
});

describe('permisos', () => {
  it('el mesero no ve el inventario y el cajero no registra movimientos', async () => {
    const mesero = await llamar('get', '/inventario', 'mesero');
    const cajero = await llamar('post', '/inventario/movimientos', 'cajero', {
      tipo: 'compra',
      productoId: ids.gaseosa,
      cantidad: 1,
    });

    expect(mesero.status).toBe(403);
    expect(cajero.status).toBe(403);
  });
});

describe('GET /auditoria', () => {
  it('el dueño ve las acciones sensibles con quién las hizo', async () => {
    await llamar('patch', `/productos/${ids.hamburguesa}`, 'administrador', { precio: 13000 });

    const res = await llamar('get', '/auditoria', 'dueno');
    const acciones = res.body.map((/** @type {{ accion: string }} */ r) => r.accion);

    expect(res.status).toBe(200);
    expect(acciones).toEqual(
      expect.arrayContaining(['cambiar_precio', 'anular_venta', 'ajustar_inventario']),
    );
    const cambioPrecio = res.body.find(
      (/** @type {{ accion: string }} */ r) => r.accion === 'cambiar_precio',
    );
    expect(cambioPrecio.usuario).toMatchObject({ rol: 'administrador' });
  });

  it('filtra por acción y por fechas', async () => {
    const porAccion = await llamar('get', '/auditoria?accion=anular_venta', 'dueno');
    const futuro = await llamar('get', '/auditoria?desde=2099-01-01', 'dueno');
    const accionInvalida = await llamar('get', '/auditoria?accion=borrar_todo', 'dueno');

    expect(porAccion.body).toHaveLength(1);
    expect(porAccion.body[0].detalle.motivo).toBe('Cobro duplicado');
    expect(futuro.body).toEqual([]);
    expect(accionInvalida.status).toBe(400);
  });

  it('solo el dueño ve la auditoría y no ve la de otro negocio', async () => {
    const admin = await llamar('get', '/auditoria', 'administrador');
    const otro = await request(app)
      .get('/auditoria')
      .set('Authorization', otroNegocio.encabezados.dueno);

    expect(admin.status).toBe(403);
    expect(otro.body).toEqual([]);
  });
});
