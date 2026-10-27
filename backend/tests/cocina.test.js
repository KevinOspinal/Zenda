// @ts-check
// Pruebas del rol cocina y de quién marca cada paso de los platos:
// - La cocina ve las comandas y marca "preparando" y "listo"; no toma pedidos ni cobra.
// - El mesero no marca "listo"; sí "entregado". La cocina solo entrega en mostrador.
// - GET /pedidos?cocina=true: la cocina sigue viendo un pedido cobrado con platos por entregar.
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
const ids = { hamburguesa: '', gaseosa: '' };
let mesasCreadas = 0;

/**
 * @param {'get' | 'post' | 'patch' | 'delete'} metodo
 * @param {string} ruta
 * @param {string} encabezado
 * @param {Record<string, unknown>} [cuerpo]
 */
function llamar(metodo, ruta, encabezado, cuerpo) {
  const peticion = request(app)[metodo](ruta).set('Authorization', encabezado);
  return cuerpo ? peticion.send(cuerpo) : peticion;
}

/** Crea una mesa libre: una mesa ocupada no admite otro pedido. */
async function nuevaMesa() {
  mesasCreadas += 1;
  const mesa = await conNegocio(negocio.tenantId, (tx) =>
    tx.mesa.create({
      data: { tenantId: negocio.tenantId, nombre: `Mesa ${mesasCreadas}`, capacidad: 4 },
    }),
  );
  return mesa.id;
}

/**
 * Crea un pedido con una hamburguesa y lo envía a cocina.
 * @param {string} encabezado Quién lo toma.
 * @param {{ enMesa?: boolean }} [opciones] Sin mesa, es de mostrador.
 * @returns {Promise<any>} El pedido enviado a cocina.
 */
async function pedidoEnCocina(encabezado, { enMesa = false } = {}) {
  const creado = await llamar('post', '/pedidos', encabezado, {
    ...(enMesa ? { mesaId: await nuevaMesa() } : {}),
    items: [{ productoId: ids.hamburguesa, cantidad: 1 }],
  });
  expect(creado.status).toBe(201);
  const enviado = await llamar('post', `/pedidos/${creado.body.id}/enviar-cocina`, encabezado);
  return enviado.body;
}

/**
 * Cambia el estado de cocina del primer plato del pedido.
 * @param {any} pedido
 * @param {'preparando' | 'listo' | 'entregado'} estadoCocina
 * @param {string} encabezado
 */
function marcarPlato(pedido, estadoCocina, encabezado) {
  return llamar('patch', `/pedidos/${pedido.id}/items/${pedido.items[0].id}/cocina`, encabezado, {
    estadoCocina,
  });
}

/**
 * Ids de las comandas que ve la cocina.
 * @param {string} encabezado
 */
async function comandasDeCocina(encabezado) {
  const res = await llamar('get', '/pedidos?cocina=true&incluirItems=true', encabezado);
  expect(res.status).toBe(200);
  return res.body.map((/** @type {any} */ pedido) => pedido.id);
}

beforeAll(async () => {
  negocio = await crearNegocioDePrueba('808000001');
  otroNegocio = await crearNegocioDePrueba('808000002');

  await conNegocio(negocio.tenantId, async (tx) => {
    const categoria = await tx.categoria.create({
      data: { tenantId: negocio.tenantId, nombre: 'Comidas' },
    });
    const crearProducto = (/** @type {string} */ nombre, /** @type {string} */ precio) =>
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
  });

  await llamar('post', '/caja/abrir', negocio.encabezados.cajero, { montoInicial: 100000 });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('rol cocina', () => {
  it('ve las comandas y marca los platos como preparando y listos', async () => {
    const pedido = await pedidoEnCocina(negocio.encabezados.mesero, { enMesa: true });

    expect(await comandasDeCocina(negocio.encabezados.cocina)).toContain(pedido.id);

    const preparando = await marcarPlato(pedido, 'preparando', negocio.encabezados.cocina);
    expect(preparando.status).toBe(200);
    const listo = await marcarPlato(pedido, 'listo', negocio.encabezados.cocina);
    expect(listo.status).toBe(200);
    expect(listo.body.items[0].estadoCocina).toBe('listo');
  });

  it('no toma pedidos, no los modifica, no cobra ni abre la caja', async () => {
    const pedido = await pedidoEnCocina(negocio.encabezados.mesero, { enMesa: true });
    const item = pedido.items[0];
    const cocina = negocio.encabezados.cocina;

    const respuestas = await Promise.all([
      llamar('post', '/pedidos', cocina, { items: [{ productoId: ids.gaseosa, cantidad: 1 }] }),
      llamar('post', `/pedidos/${pedido.id}/items`, cocina, {
        productoId: ids.gaseosa,
        cantidad: 1,
      }),
      llamar('delete', `/pedidos/${pedido.id}/items/${item.id}`, cocina),
      llamar('post', `/pedidos/${pedido.id}/enviar-cocina`, cocina),
      llamar('post', `/pedidos/${pedido.id}/dividir`, cocina, {
        items: [{ itemId: item.id, cantidad: '1' }],
      }),
      llamar('post', `/pedidos/${pedido.id}/cobrar`, cocina, {
        pagos: [{ metodo: 'efectivo', monto: '12000' }],
      }),
      llamar('post', '/caja/abrir', cocina, { montoInicial: 50000 }),
      llamar('get', '/reportes/resumen', cocina),
    ]);

    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.code).toBe('SIN_PERMISO');
    }
  });

  it('el dueño puede crear la cuenta de la cocina', async () => {
    const res = await llamar('post', '/usuarios', negocio.encabezados.dueno, {
      nombre: 'Cocina principal',
      email: 'tableta-cocina@808000001.test',
      rol: 'cocina',
      contrasena: 'TabletaCocina2026',
    });

    expect(res.status).toBe(201);
    expect(res.body.rol).toBe('cocina');
  });
});

describe('quién marca cada paso', () => {
  it('el mesero no marca un plato como preparando o listo', async () => {
    const pedido = await pedidoEnCocina(negocio.encabezados.mesero, { enMesa: true });

    for (const estado of /** @type {const} */ (['preparando', 'listo'])) {
      const res = await marcarPlato(pedido, estado, negocio.encabezados.mesero);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SIN_PERMISO');
    }
  });

  it('el cajero sí puede marcarlo listo (en cafeterías también prepara)', async () => {
    const pedido = await pedidoEnCocina(negocio.encabezados.cajero);

    const res = await marcarPlato(pedido, 'listo', negocio.encabezados.cajero);

    expect(res.status).toBe(200);
  });

  it('en una mesa, el mesero marca el plato como entregado; la cocina no', async () => {
    const pedido = await pedidoEnCocina(negocio.encabezados.mesero, { enMesa: true });
    await marcarPlato(pedido, 'listo', negocio.encabezados.cocina);

    const deLaCocina = await marcarPlato(pedido, 'entregado', negocio.encabezados.cocina);
    expect(deLaCocina.status).toBe(403);
    expect(deLaCocina.body.error.code).toBe('SIN_PERMISO');

    const delMesero = await marcarPlato(pedido, 'entregado', negocio.encabezados.mesero);
    expect(delMesero.status).toBe(200);
    expect(delMesero.body.items[0].estadoCocina).toBe('entregado');
  });

  it('en mostrador, la cocina sí lo entrega ("Ya salió")', async () => {
    const pedido = await pedidoEnCocina(negocio.encabezados.cajero);
    await marcarPlato(pedido, 'listo', negocio.encabezados.cocina);

    const res = await marcarPlato(pedido, 'entregado', negocio.encabezados.cocina);

    expect(res.status).toBe(200);
  });
});

describe('GET /pedidos?cocina=true', () => {
  it('un pedido cobrado sigue en la cocina hasta que salen sus platos', async () => {
    const pedido = await pedidoEnCocina(negocio.encabezados.cajero);
    const cobro = await llamar('post', `/pedidos/${pedido.id}/cobrar`, negocio.encabezados.cajero, {
      pagos: [{ metodo: 'efectivo', monto: '12000' }],
    });
    expect(cobro.status).toBe(200);

    // Cobrado, pero la hamburguesa no ha salido: la cocina lo sigue viendo.
    expect(await comandasDeCocina(negocio.encabezados.cocina)).toContain(pedido.id);

    await marcarPlato(pedido, 'listo', negocio.encabezados.cocina);
    await marcarPlato(pedido, 'entregado', negocio.encabezados.cocina);
    expect(await comandasDeCocina(negocio.encabezados.cocina)).not.toContain(pedido.id);
  });

  it('una venta que se cobró sin pasar por la cocina no le aparece', async () => {
    const venta = await llamar('post', '/pedidos', negocio.encabezados.cajero, {
      items: [{ productoId: ids.gaseosa, cantidad: 1 }],
    });
    await llamar('post', `/pedidos/${venta.body.id}/cobrar`, negocio.encabezados.cajero, {
      pagos: [{ metodo: 'efectivo', monto: '4000' }],
    });

    expect(await comandasDeCocina(negocio.encabezados.cocina)).not.toContain(venta.body.id);
  });

  it('un pedido sin enviar a cocina no le aparece', async () => {
    const abierto = await llamar('post', '/pedidos', negocio.encabezados.mesero, {
      mesaId: await nuevaMesa(),
      items: [{ productoId: ids.hamburguesa, cantidad: 1 }],
    });

    expect(await comandasDeCocina(negocio.encabezados.cocina)).not.toContain(abierto.body.id);
  });

  it('un pedido cobrado hace más de 12 horas ya no le aparece', async () => {
    const pedido = await pedidoEnCocina(negocio.encabezados.cajero);
    await llamar('post', `/pedidos/${pedido.id}/cobrar`, negocio.encabezados.cajero, {
      pagos: [{ metodo: 'efectivo', monto: '12000' }],
    });
    const haceTreceHoras = new Date(Date.now() - 13 * 60 * 60 * 1000);
    await conNegocio(negocio.tenantId, (tx) =>
      tx.pedido.update({ where: { id: pedido.id }, data: { cerradoEn: haceTreceHoras } }),
    );

    expect(await comandasDeCocina(negocio.encabezados.cocina)).not.toContain(pedido.id);
  });

  it('reenviar a cocina no cambia la hora del primer envío', async () => {
    const pedido = await pedidoEnCocina(negocio.encabezados.mesero, { enMesa: true });
    expect(pedido.enviadoACocinaEn).toEqual(expect.any(String));

    await llamar('post', `/pedidos/${pedido.id}/items`, negocio.encabezados.mesero, {
      productoId: ids.gaseosa,
      cantidad: 1,
    });
    const reenviado = await llamar(
      'post',
      `/pedidos/${pedido.id}/enviar-cocina`,
      negocio.encabezados.mesero,
    );

    expect(reenviado.body.enviadoACocinaEn).toBe(pedido.enviadoACocinaEn);
  });

  it('no se puede combinar con activos ni con estado', async () => {
    for (const consulta of ['cocina=true&activos=true', 'cocina=true&estado=pagado']) {
      const res = await llamar('get', `/pedidos?${consulta}`, negocio.encabezados.cocina);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('el otro negocio no ve estas comandas', async () => {
    expect(await comandasDeCocina(otroNegocio.encabezados.cocina)).toEqual([]);
  });
});
