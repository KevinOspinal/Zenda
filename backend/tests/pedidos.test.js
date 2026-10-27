// @ts-check
// Pruebas de pedidos y pagos: el ciclo completo de una venta, desde la mesa hasta el cobro,
// con totales e impuestos, idempotencia offline, cocina, anulación, permisos y aislamiento.
import { randomUUID } from 'node:crypto';
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

/** Ids de los datos de prueba. */
const ids = {
  hamburguesa: '',
  gaseosa: '',
  agua: '',
  agotado: '',
  productoAjeno: '',
  mesa1: '',
  mesa2: '',
  mesaAjena: '',
};

/**
 * Crea una categoría con productos y dos mesas directamente en la base.
 * @param {import('./ayudantes.js').NegocioDePrueba} n
 * @param {{ nombre: string, precio: string, activo?: boolean }[]} productos
 * @param {string[]} mesas
 */
async function prepararNegocio(n, productos, mesas) {
  return conNegocio(n.tenantId, async (tx) => {
    const categoria = await tx.categoria.create({
      data: { tenantId: n.tenantId, nombre: 'Comidas' },
    });
    const creados = [];
    for (const producto of productos) {
      creados.push(
        await tx.producto.create({
          data: {
            tenantId: n.tenantId,
            categoriaId: categoria.id,
            tipoImpuesto: 'impoconsumo',
            ...producto,
          },
        }),
      );
    }
    const mesasCreadas = [];
    for (const nombre of mesas) {
      mesasCreadas.push(
        await tx.mesa.create({ data: { tenantId: n.tenantId, nombre, capacidad: 4 } }),
      );
    }
    return { productos: creados, mesas: mesasCreadas };
  });
}

beforeAll(async () => {
  negocio = await crearNegocioDePrueba('740000001');
  otroNegocio = await crearNegocioDePrueba('740000002');

  const datos = await prepararNegocio(
    negocio,
    [
      { nombre: 'IND Classic Artesanal', precio: '12000' },
      { nombre: 'Gaseosa personal', precio: '4000' },
      { nombre: 'Agua', precio: '2000' },
      { nombre: 'Agotado', precio: '9000', activo: false },
    ],
    ['Mesa 1', 'Mesa 2'],
  );
  [ids.hamburguesa, ids.gaseosa, ids.agua, ids.agotado] = datos.productos.map((p) => p.id);
  [ids.mesa1, ids.mesa2] = datos.mesas.map((m) => m.id);

  const ajenos = await prepararNegocio(
    otroNegocio,
    [{ nombre: 'Ajeno', precio: '1000' }],
    ['Mesa ajena'],
  );
  ids.productoAjeno = ajenos.productos[0].id;
  ids.mesaAjena = ajenos.mesas[0].id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * Petición autenticada.
 * @param {'get' | 'post' | 'patch' | 'delete'} metodo
 * @param {string} ruta
 * @param {import('./ayudantes.js').Rol} rol
 * @param {Record<string, unknown>} [cuerpo]
 */
function llamar(metodo, ruta, rol, cuerpo) {
  const peticion = request(app)[metodo](ruta).set('Authorization', negocio.encabezados[rol]);
  return cuerpo ? peticion.send(cuerpo) : peticion;
}

/** @param {string} mesaId */
async function estadoMesa(mesaId) {
  const mesa = await conNegocio(negocio.tenantId, (tx) =>
    tx.mesa.findUniqueOrThrow({ where: { id: mesaId } }),
  );
  return mesa.estado;
}

describe('sin caja abierta', () => {
  it('no se pueden tomar pedidos', async () => {
    const res = await llamar('post', '/pedidos', 'mesero', { mesaId: ids.mesa1 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CAJA_CERRADA');
  });
});

describe('ciclo de una venta en mesa', () => {
  /** @type {string} */
  let pedidoId;

  beforeAll(async () => {
    await llamar('post', '/caja/abrir', 'cajero', { montoInicial: 100000 });
  });

  it('el mesero crea el pedido con ítems y los totales se calculan como exige la DIAN', async () => {
    const res = await llamar('post', '/pedidos', 'mesero', {
      mesaId: ids.mesa1,
      items: [
        { productoId: ids.hamburguesa, cantidad: 2, notas: 'Sin cebolla' },
        { productoId: ids.gaseosa, cantidad: 1 },
      ],
    });
    pedidoId = res.body.id;

    // 2 × 12000: base 22222.22 + INC 1777.78 | 1 × 4000: base 3703.70 + INC 296.30
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      estado: 'abierto',
      meseroId: negocio.usuarios.mesero,
      subtotal: '25925.92',
      impuestos: '2074.08',
      ajusteRedondeo: '0',
      total: '28000',
    });
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({
      cantidad: '2',
      precioUnitario: '12000',
      tasaImpuesto: '8',
      notas: 'Sin cebolla',
      estadoCocina: 'pendiente',
      producto: { nombre: 'IND Classic Artesanal' },
    });
    expect(await estadoMesa(ids.mesa1)).toBe('ocupada');
  });

  it('una mesa ocupada no admite un segundo pedido', async () => {
    const res = await llamar('post', '/pedidos', 'mesero', { mesaId: ids.mesa1 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MESA_OCUPADA');
  });

  it('al agregar un ítem se recalculan los totales', async () => {
    const res = await llamar('post', `/pedidos/${pedidoId}/items`, 'mesero', {
      productoId: ids.agua,
      cantidad: 1,
    });

    // + 2000: base 1851.85 + INC 148.15
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ subtotal: '27777.77', impuestos: '2222.23', total: '30000' });
  });

  it('el ítem conserva el precio con el que se vendió aunque el menú cambie', async () => {
    await llamar('patch', `/productos/${ids.agua}`, 'dueno', { precio: 2500 });
    const res = await llamar('get', `/pedidos/${pedidoId}`, 'mesero');

    const agua = res.body.items.find(
      (/** @type {{ producto: { nombre: string } }} */ i) => i.producto.nombre === 'Agua',
    );
    expect(agua.precioUnitario).toBe('2000');
    expect(res.body.total).toBe('30000');
  });

  it('rechaza productos inactivos o de otro negocio', async () => {
    const inactivo = await llamar('post', `/pedidos/${pedidoId}/items`, 'mesero', {
      productoId: ids.agotado,
      cantidad: 1,
    });
    const ajeno = await llamar('post', `/pedidos/${pedidoId}/items`, 'mesero', {
      productoId: ids.productoAjeno,
      cantidad: 1,
    });

    expect(inactivo.status).toBe(422);
    expect(inactivo.body.error.code).toBe('PRODUCTO_INACTIVO');
    expect(ajeno.status).toBe(404);
  });

  it('se envía a cocina y la cocina avanza los ítems sin retroceder', async () => {
    const enviado = await llamar('post', `/pedidos/${pedidoId}/enviar-cocina`, 'mesero');
    const itemId = enviado.body.items[0].id;

    const preparando = await llamar(
      'patch',
      `/pedidos/${pedidoId}/items/${itemId}/cocina`,
      'cocina',
      {
        estadoCocina: 'preparando',
      },
    );
    const retroceso = await llamar(
      'patch',
      `/pedidos/${pedidoId}/items/${itemId}/cocina`,
      'cocina',
      {
        estadoCocina: 'preparando',
      },
    );

    expect(enviado.body.estado).toBe('enviado_a_cocina');
    expect(preparando.status).toBe(200);
    expect(retroceso.status).toBe(409);
    expect(retroceso.body.error.code).toBe('CAMBIO_COCINA_INVALIDO');
  });

  it('no se puede quitar un ítem que la cocina ya está preparando; uno pendiente sí', async () => {
    const { body: pedido } = await llamar('get', `/pedidos/${pedidoId}`, 'mesero');
    const enPreparacion = pedido.items.find(
      (/** @type {{ estadoCocina: string }} */ i) => i.estadoCocina === 'preparando',
    );
    const agua = pedido.items.find(
      (/** @type {{ producto: { nombre: string } }} */ i) => i.producto.nombre === 'Agua',
    );

    const bloqueado = await llamar(
      'delete',
      `/pedidos/${pedidoId}/items/${enPreparacion.id}`,
      'mesero',
    );
    const quitado = await llamar('delete', `/pedidos/${pedidoId}/items/${agua.id}`, 'mesero');

    expect(bloqueado.status).toBe(409);
    expect(bloqueado.body.error.code).toBe('ITEM_EN_PREPARACION');
    expect(quitado.status).toBe(200);
    expect(quitado.body.total).toBe('28000');
  });

  it('el mesero no puede cobrar', async () => {
    const res = await llamar('post', `/pedidos/${pedidoId}/cobrar`, 'mesero', {
      pagos: [{ metodo: 'efectivo', monto: 28000 }],
    });

    expect(res.status).toBe(403);
  });

  it('rechaza pagos que no suman exactamente el total', async () => {
    const res = await llamar('post', `/pedidos/${pedidoId}/cobrar`, 'cajero', {
      pagos: [{ metodo: 'efectivo', monto: 27000 }],
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PAGO_NO_CUADRA');
  });

  it('cobra con efectivo y tarjeta, calcula el cambio y libera la mesa', async () => {
    const res = await llamar('post', `/pedidos/${pedidoId}/cobrar`, 'cajero', {
      pagos: [
        { metodo: 'efectivo', monto: 20000, recibido: 50000 },
        { metodo: 'tarjeta', monto: 8000, referencia: 'APROB-123' },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.cambio).toBe('30000.00');
    expect(res.body.pedido.estado).toBe('pagado');
    expect(res.body.pedido.cerradoEn).not.toBeNull();
    expect(res.body.pedido.pagos).toHaveLength(2);
    expect(await estadoMesa(ids.mesa1)).toBe('libre');
  });

  it('un pedido cobrado no se cobra de nuevo ni admite más ítems', async () => {
    const cobrarOtraVez = await llamar('post', `/pedidos/${pedidoId}/cobrar`, 'cajero', {
      pagos: [{ metodo: 'efectivo', monto: 28000 }],
    });
    const agregar = await llamar('post', `/pedidos/${pedidoId}/items`, 'mesero', {
      productoId: ids.agua,
      cantidad: 1,
    });

    expect(cobrarOtraVez.status).toBe(409);
    expect(agregar.status).toBe(409);
    expect(agregar.body.error.code).toBe('PEDIDO_CERRADO');
  });

  it('el resumen de caja refleja el cobro', async () => {
    const res = await llamar('get', '/caja/actual', 'cajero');

    expect(res.body.resumen.ventasPorMetodo).toMatchObject({
      efectivo: '20000.00',
      tarjeta: '8000.00',
    });
    expect(res.body.resumen.efectivoEsperado).toBe('120000.00');
  });

  it('el mesero puede marcar un plato entregado aunque el pedido ya esté pagado', async () => {
    const { body: pedido } = await llamar('get', `/pedidos/${pedidoId}`, 'mesero');
    const res = await llamar(
      'patch',
      `/pedidos/${pedidoId}/items/${pedido.items[0].id}/cocina`,
      'mesero',
      { estadoCocina: 'entregado' },
    );

    expect(res.status).toBe(200);
  });
});

describe('venta de mostrador, pedido offline y anulación', () => {
  it('se puede vender sin mesa (mostrador) y cobrar desde "abierto"', async () => {
    const { body: pedido } = await llamar('post', '/pedidos', 'cajero', {
      items: [{ productoId: ids.gaseosa, cantidad: 2 }],
    });
    const cobro = await llamar('post', `/pedidos/${pedido.id}/cobrar`, 'cajero', {
      pagos: [{ metodo: 'transferencia', monto: '8000' }],
    });

    expect(pedido.mesaId).toBeNull();
    expect(cobro.status).toBe(200);
    expect(cobro.body.cambio).toBe('0.00');
  });

  it('un pedido offline reenviado con el mismo uuidOffline no se duplica', async () => {
    const uuidOffline = randomUUID();
    const datos = { uuidOffline, items: [{ productoId: ids.agua, cantidad: 1 }] };

    const primero = await llamar('post', '/pedidos', 'mesero', datos);
    const reenvio = await llamar('post', '/pedidos', 'mesero', datos);
    const cuantos = await conNegocio(negocio.tenantId, (tx) =>
      tx.pedido.count({ where: { uuidOffline } }),
    );

    expect(primero.status).toBe(201);
    expect(reenvio.status).toBe(200);
    expect(reenvio.body.id).toBe(primero.body.id);
    expect(reenvio.body.items).toHaveLength(1);
    expect(cuantos).toBe(1);
  });

  it('enviar a cocina un pedido vacío no tiene sentido', async () => {
    const { body: pedido } = await llamar('post', '/pedidos', 'mesero', { mesaId: ids.mesa2 });
    const res = await llamar('post', `/pedidos/${pedido.id}/enviar-cocina`, 'mesero');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PEDIDO_VACIO');
  });

  it('solo el administrador y el dueño anulan; la anulación libera la mesa y queda auditada', async () => {
    const { body: pedidos } = await llamar(
      'get',
      `/pedidos?mesaId=${ids.mesa2}&estado=abierto`,
      'mesero',
    );
    const pedidoId = pedidos[0].id;

    const comoCajero = await llamar('post', `/pedidos/${pedidoId}/anular`, 'cajero', {
      motivo: 'Prueba',
    });
    const sinMotivo = await llamar('post', `/pedidos/${pedidoId}/anular`, 'administrador', {});
    const anulado = await llamar('post', `/pedidos/${pedidoId}/anular`, 'administrador', {
      motivo: 'El cliente se fue sin pedir',
    });
    const auditoria = await conNegocio(negocio.tenantId, (tx) =>
      tx.auditoria.findFirst({ where: { accion: 'anular_venta', entidadId: pedidoId } }),
    );

    expect(comoCajero.status).toBe(403);
    expect(sinMotivo.status).toBe(400);
    expect(anulado.status).toBe(200);
    expect(anulado.body.estado).toBe('anulado');
    expect(await estadoMesa(ids.mesa2)).toBe('libre');
    expect(auditoria).toMatchObject({
      usuarioId: negocio.usuarios.administrador,
      detalle: { motivo: 'El cliente se fue sin pedir', estadoAnterior: 'abierto' },
    });
  });

  it('anular un pedido cobrado lo saca del resumen de caja', async () => {
    const { body: pedido } = await llamar('post', '/pedidos', 'cajero', {
      items: [{ productoId: ids.hamburguesa, cantidad: 1 }],
    });
    await llamar('post', `/pedidos/${pedido.id}/cobrar`, 'cajero', {
      pagos: [{ metodo: 'otro', monto: 12000 }],
    });
    const antes = await llamar('get', '/caja/actual', 'cajero');

    await llamar('post', `/pedidos/${pedido.id}/anular`, 'dueno', { motivo: 'Cobro por error' });
    const despues = await llamar('get', '/caja/actual', 'cajero');

    expect(antes.body.resumen.ventasPorMetodo.otro).toBe('12000.00');
    expect(despues.body.resumen.ventasPorMetodo.otro).toBe('0.00');
  });
});

describe('aislamiento entre negocios', () => {
  it('no se puede usar la mesa de otro negocio ni ver sus pedidos', async () => {
    const mesaAjena = await llamar('post', '/pedidos', 'mesero', { mesaId: ids.mesaAjena });
    const { body: pedidos } = await llamar('get', '/pedidos', 'mesero');
    const verAjeno = await request(app)
      .get(`/pedidos/${pedidos[0].id}`)
      .set('Authorization', otroNegocio.encabezados.dueno);

    expect(mesaAjena.status).toBe(404);
    expect(mesaAjena.body.error.code).toBe('MESA_NO_ENCONTRADA');
    expect(verAjeno.status).toBe(404);
  });
});
