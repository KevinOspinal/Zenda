// @ts-check
// Pruebas de los negocios que no facturan electrónicamente (no responsables de IVA ni del
// impuesto al consumo): no cobran impuestos y emiten un recibo de venta al cobrar, con
// numeración propia y continua. También el cambio de régimen desde la configuración.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { conNegocio } from '../src/lib/negocio.js';
import { crearNegocioDePrueba } from './ayudantes.js';

const app = createApp();

/** @type {import('./ayudantes.js').NegocioDePrueba} */
let noFactura;
/** @type {import('./ayudantes.js').NegocioDePrueba} */
let conFactura;
/** @type {import('./ayudantes.js').NegocioDePrueba} */
let cambiaDeRegimen;
/** Producto de $12.000 de cada negocio, por tenantId. */
const productoDe = /** @type {Record<string, string>} */ ({});

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

/**
 * Crea el producto de $12.000 del negocio y abre su caja.
 * @param {import('./ayudantes.js').NegocioDePrueba} negocio
 * @param {'impoconsumo' | 'exento'} tipoImpuesto
 */
async function prepararNegocio(negocio, tipoImpuesto) {
  productoDe[negocio.tenantId] = await conNegocio(negocio.tenantId, async (tx) => {
    const categoria = await tx.categoria.create({
      data: { tenantId: negocio.tenantId, nombre: 'Comidas' },
    });
    const producto = await tx.producto.create({
      data: {
        tenantId: negocio.tenantId,
        categoriaId: categoria.id,
        nombre: 'IND Classic Artesanal',
        precio: '12000',
        tipoImpuesto,
      },
    });
    return producto.id;
  });
  await llamar('post', '/caja/abrir', negocio.encabezados.cajero, { montoInicial: 100000 });
}

/**
 * Vende una hamburguesa de mostrador y la cobra en efectivo con un billete de $20.000.
 * @param {import('./ayudantes.js').NegocioDePrueba} negocio
 * @returns {Promise<any>} La respuesta del cobro: { pedido, cambio, advertencias }.
 */
async function ventaCobrada(negocio) {
  const pedido = await llamar('post', '/pedidos', negocio.encabezados.cajero, {
    items: [{ productoId: productoDe[negocio.tenantId], cantidad: 1 }],
  });
  const cobro = await llamar(
    'post',
    `/pedidos/${pedido.body.id}/cobrar`,
    negocio.encabezados.cajero,
    {
      pagos: [{ metodo: 'efectivo', monto: '12000', recibido: '20000' }],
    },
  );
  expect(cobro.status).toBe(200);
  return cobro.body;
}

/**
 * Impuesto actual del producto del negocio.
 * @param {import('./ayudantes.js').NegocioDePrueba} negocio
 */
async function impuestoDelProducto(negocio) {
  const producto = await conNegocio(negocio.tenantId, (tx) =>
    tx.producto.findUniqueOrThrow({ where: { id: productoDe[negocio.tenantId] } }),
  );
  return producto.tipoImpuesto;
}

beforeAll(async () => {
  noFactura = await crearNegocioDePrueba('810000001', { regimenImpuesto: 'no_responsable' });
  conFactura = await crearNegocioDePrueba('810000002');
  cambiaDeRegimen = await crearNegocioDePrueba('810000003');
  await prepararNegocio(noFactura, 'exento');
  await prepararNegocio(conFactura, 'impoconsumo');
  await prepararNegocio(cambiaDeRegimen, 'impoconsumo');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('negocio que no factura electrónicamente', () => {
  it('lo dice su configuración', async () => {
    const sin = await llamar('get', '/negocios/actual', noFactura.encabezados.dueno);
    const con = await llamar('get', '/negocios/actual', conFactura.encabezados.dueno);

    expect(sin.body.facturaElectronica).toBe(false);
    expect(con.body.facturaElectronica).toBe(true);
  });

  it('al cobrar no cobra impuestos y emite un recibo con los datos del negocio', async () => {
    await llamar('patch', '/negocios/actual', noFactura.encabezados.dueno, {
      direccion: 'Carrera 2 # 98-22',
      telefono: '312 333 4444',
      pieRecibo: '¡Gracias por tu compra!',
    });

    const { pedido, cambio } = await ventaCobrada(noFactura);

    expect(pedido.impuestos).toBe('0');
    expect(pedido.total).toBe('12000');
    expect(pedido.recibo).toMatchObject({
      numero: 1,
      emitidoEn: expect.any(String),
      encabezado: {
        nombre: 'Negocio 810000001',
        nit: '810000001',
        direccion: 'Carrera 2 # 98-22',
        telefono: '312 333 4444',
        pieRecibo: '¡Gracias por tu compra!',
      },
    });
    // Lo que entregó el cliente queda guardado, para mostrar el cambio en el recibo.
    expect(pedido.pagos[0].recibido).toBe('20000');
    expect(cambio).toBe('8000.00');
  });

  it('cada cobro recibe el siguiente número, sin saltos', async () => {
    const segundo = await ventaCobrada(noFactura);
    const tercero = await ventaCobrada(noFactura);

    expect([segundo.pedido.recibo.numero, tercero.pedido.recibo.numero]).toEqual([2, 3]);
  });

  it('el recibo se puede consultar después, para reimprimirlo', async () => {
    const { pedido } = await ventaCobrada(noFactura);

    const res = await llamar('get', `/pedidos/${pedido.id}`, noFactura.encabezados.cajero);

    expect(res.body.recibo.numero).toBe(pedido.recibo.numero);
  });
});

describe('negocio que factura electrónicamente', () => {
  it('no emite recibo: su documento es la factura electrónica', async () => {
    const { pedido } = await ventaCobrada(conFactura);

    expect(pedido.recibo).toBeNull();
    expect(pedido.impuestos).not.toBe('0');
  });
});

describe('cambio de régimen', () => {
  it('a no responsable: los productos quedan sin impuesto y emite recibos', async () => {
    const res = await llamar('patch', '/negocios/actual', cambiaDeRegimen.encabezados.dueno, {
      regimenImpuesto: 'no_responsable',
    });

    expect(res.status).toBe(200);
    expect(res.body.facturaElectronica).toBe(false);
    expect(await impuestoDelProducto(cambiaDeRegimen)).toBe('exento');

    const { pedido } = await ventaCobrada(cambiaDeRegimen);
    expect(pedido.impuestos).toBe('0');
    expect(pedido.recibo.numero).toBe(1);
  });

  it('el cambio queda en la auditoría con cuántos productos cambiaron', async () => {
    const res = await llamar(
      'get',
      '/auditoria?accion=cambiar_regimen_impuesto',
      cambiaDeRegimen.encabezados.dueno,
    );

    expect(res.body[0]).toMatchObject({
      detalle: { anterior: 'responsable_inc', nuevo: 'no_responsable', productosActualizados: 1 },
    });
  });

  it('de vuelta a impuesto al consumo: los productos vuelven a llevarlo', async () => {
    await llamar('patch', '/negocios/actual', cambiaDeRegimen.encabezados.dueno, {
      regimenImpuesto: 'responsable_inc',
    });

    expect(await impuestoDelProducto(cambiaDeRegimen)).toBe('impoconsumo');
    const { pedido } = await ventaCobrada(cambiaDeRegimen);
    expect(pedido.recibo).toBeNull();
  });

  it('solo el dueño lo cambia', async () => {
    const res = await llamar(
      'patch',
      '/negocios/actual',
      cambiaDeRegimen.encabezados.administrador,
      {
        regimenImpuesto: 'no_responsable',
      },
    );

    expect(res.status).toBe(403);
  });

  it('valida los datos del recibo', async () => {
    const res = await llamar('patch', '/negocios/actual', noFactura.encabezados.dueno, {
      telefono: 'no es un teléfono',
    });

    expect(res.status).toBe(400);
  });
});
