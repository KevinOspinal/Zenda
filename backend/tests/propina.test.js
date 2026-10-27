// @ts-check
// Pruebas de la propina voluntaria (Ley 1935 de 2018): propina sugerida, cobro con y sin
// propina, que no cambie los impuestos, caja, reportes y la configuración del dueño.
//
// Se usa un producto de $10.800 con INC 8 %: su base es exactamente $10.000 y su
// impuesto $800, así la propina sugerida del 10 % es un valor redondo ($1.000).
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { conNegocio } from '../src/lib/negocio.js';
import { calcularPropinaSugerida } from '../src/modules/pedidos/propina.js';
import { crearNegocioDePrueba } from './ayudantes.js';

const app = createApp();

/** @type {import('./ayudantes.js').NegocioDePrueba} */
let negocio;
/** @type {string} */
let productoId;

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

/** Crea un pedido de mostrador con un producto de $10.800 y devuelve su id. */
async function crearPedido() {
  const res = await llamar('post', '/pedidos', negocio.encabezados.mesero, {
    items: [{ productoId, cantidad: 1 }],
  });
  return /** @type {string} */ (res.body.id);
}

beforeAll(async () => {
  negocio = await crearNegocioDePrueba('805000001');

  productoId = await conNegocio(negocio.tenantId, async (tx) => {
    const categoria = await tx.categoria.create({
      data: { tenantId: negocio.tenantId, nombre: 'Comidas' },
    });
    const producto = await tx.producto.create({
      data: {
        tenantId: negocio.tenantId,
        categoriaId: categoria.id,
        nombre: 'Plato del día',
        precio: '10800',
        tipoImpuesto: 'impoconsumo',
      },
    });
    return producto.id;
  });

  await llamar('post', '/caja/abrir', negocio.encabezados.cajero, { montoInicial: 100000 });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('cálculo de la propina sugerida', () => {
  it('es el porcentaje sobre el subtotal (antes de impuestos), en pesos enteros hacia abajo', () => {
    expect(calcularPropinaSugerida('10000', '10').toFixed(2)).toBe('1000.00');
    // 5925.926 → 5925: redondear hacia arriba pasaría del 10 %.
    expect(calcularPropinaSugerida('59259.26', '10').toFixed(2)).toBe('5925.00');
    expect(calcularPropinaSugerida('10000', '7.5').toFixed(2)).toBe('750.00');
  });

  it('en 0 % no se sugiere propina', () => {
    expect(calcularPropinaSugerida('10000', '0').toFixed(2)).toBe('0.00');
  });
});

describe('propina en el pedido y en el cobro', () => {
  it('un negocio nuevo sugiere el 10 % por defecto', async () => {
    const res = await llamar('get', '/negocios/actual', negocio.encabezados.mesero);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: negocio.tenantId, propinaSugerida: '10' });
  });

  it('el pedido trae la propina sugerida para mostrársela al cliente', async () => {
    const pedidoId = await crearPedido();

    const res = await llamar('get', `/pedidos/${pedidoId}`, negocio.encabezados.mesero);

    expect(res.body).toMatchObject({
      total: '10800',
      subtotal: '10000',
      propinaSugerida: '1000.00',
    });
    // No se filtran datos internos del negocio.
    expect(res.body).not.toHaveProperty('tenant');
  });

  it('sin propina, el cobro funciona igual que antes: los pagos suman el total', async () => {
    const pedidoId = await crearPedido();

    const res = await llamar('post', `/pedidos/${pedidoId}/cobrar`, negocio.encabezados.cajero, {
      pagos: [{ metodo: 'tarjeta', monto: '10800' }],
    });

    expect(res.status).toBe(200);
    expect(res.body.pedido).toMatchObject({ estado: 'pagado', total: '10800', propina: '0' });
  });

  it('con propina, los pagos suman total + propina y el cambio se calcula sobre ambos', async () => {
    const pedidoId = await crearPedido();

    const res = await llamar('post', `/pedidos/${pedidoId}/cobrar`, negocio.encabezados.cajero, {
      propina: '1000',
      pagos: [{ metodo: 'efectivo', monto: '11800', recibido: '20000' }],
    });

    expect(res.status).toBe(200);
    expect(res.body.cambio).toBe('8200.00');
    // La propina no cambia el total ni los impuestos: no es venta del negocio.
    expect(res.body.pedido).toMatchObject({
      total: '10800',
      subtotal: '10000',
      impuestos: '800',
      propina: '1000',
    });
  });

  it('si se declara propina, pagar solo el total no cuadra', async () => {
    const pedidoId = await crearPedido();

    const res = await llamar('post', `/pedidos/${pedidoId}/cobrar`, negocio.encabezados.cajero, {
      propina: '1000',
      pagos: [{ metodo: 'efectivo', monto: '10800' }],
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PAGO_NO_CUADRA');
    expect(res.body.error.message).toContain('11800.00');
  });

  it('la propina no puede ser mayor que el total (evita un cero de más)', async () => {
    const pedidoId = await crearPedido();

    const res = await llamar('post', `/pedidos/${pedidoId}/cobrar`, negocio.encabezados.cajero, {
      propina: '100000',
      pagos: [{ metodo: 'efectivo', monto: '110800' }],
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PROPINA_EXCEDE_TOTAL');
  });

  it('la propina no puede ser negativa', async () => {
    const pedidoId = await crearPedido();

    const res = await llamar('post', `/pedidos/${pedidoId}/cobrar`, negocio.encabezados.cajero, {
      propina: '-1000',
      pagos: [{ metodo: 'efectivo', monto: '9800' }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('propinas en la caja y en los reportes', () => {
  it('la caja separa ventas y propinas, y espera la propina en efectivo en el cajón', async () => {
    // Quedan pedidos de las pruebas anteriores sin cobrar: se anulan para el resumen.
    await conNegocio(negocio.tenantId, (tx) =>
      tx.pedido.updateMany({
        where: { estado: { in: ['abierto', 'enviado_a_cocina'] } },
        data: { estado: 'anulado' },
      }),
    );

    const res = await llamar('get', '/caja/actual', negocio.encabezados.cajero);

    // Dos ventas de $10.800: una con tarjeta sin propina y otra en efectivo con $1.000 de propina.
    expect(res.body.resumen).toMatchObject({
      ventasPorMetodo: { efectivo: '11800.00', tarjeta: '10800.00' },
      totalCobrado: '22600.00',
      totalVendido: '21600.00',
      propinas: '1000.00',
      // Base de $100.000 + $11.800 en efectivo (venta + propina).
      efectivoEsperado: '111800.00',
    });
  });

  it('el resumen de ventas muestra las propinas aparte y no las suma al total', async () => {
    const res = await llamar('get', '/reportes/resumen', negocio.encabezados.dueno);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ventas: 2, total: '21600.00', propinas: '1000.00' });
  });
});

describe('configuración de la propina sugerida', () => {
  it('el dueño la cambia y el pedido la refleja', async () => {
    const res = await llamar('patch', '/negocios/actual', negocio.encabezados.dueno, {
      propinaSugerida: 5,
    });
    expect(res.status).toBe(200);
    expect(res.body.propinaSugerida).toBe('5');

    const pedidoId = await crearPedido();
    const pedido = await llamar('get', `/pedidos/${pedidoId}`, negocio.encabezados.mesero);
    expect(pedido.body.propinaSugerida).toBe('500.00');
  });

  it('el cambio queda en la auditoría con el valor anterior', async () => {
    const res = await llamar(
      'get',
      '/auditoria?accion=cambiar_propina_sugerida',
      negocio.encabezados.dueno,
    );

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      accion: 'cambiar_propina_sugerida',
      detalle: { anterior: '10', nuevo: '5' },
    });
  });

  it('en 0 % el negocio no sugiere propina', async () => {
    await llamar('patch', '/negocios/actual', negocio.encabezados.dueno, { propinaSugerida: 0 });

    const pedidoId = await crearPedido();
    const pedido = await llamar('get', `/pedidos/${pedidoId}`, negocio.encabezados.mesero);

    expect(pedido.body.propinaSugerida).toBe('0.00');
  });

  it('no permite sugerir más del 10 %', async () => {
    const res = await llamar('patch', '/negocios/actual', negocio.encabezados.dueno, {
      propinaSugerida: '10.5',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('solo el dueño puede cambiarla', async () => {
    const res = await llamar('patch', '/negocios/actual', negocio.encabezados.administrador, {
      propinaSugerida: 8,
    });

    expect(res.status).toBe(403);
  });

  it('sin sesión no se puede consultar el negocio', async () => {
    const res = await request(app).get('/negocios/actual');

    expect(res.status).toBe(401);
  });
});
