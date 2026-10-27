// @ts-check
// Pruebas de cuentas divididas: pasar ítems completos o parte de sus unidades a una cuenta
// nueva en la misma mesa, totales de ambas cuentas, cobro por separado y validaciones.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { conNegocio } from '../src/lib/negocio.js';
import { crearNegocioDePrueba } from './ayudantes.js';

const app = createApp();

/** @type {import('./ayudantes.js').NegocioDePrueba} */
let negocio;
const ids = { hamburguesa: '', gaseosa: '', mesa: '' };

beforeAll(async () => {
  negocio = await crearNegocioDePrueba('795000001');

  await conNegocio(negocio.tenantId, async (tx) => {
    const { id: categoriaId } = await tx.categoria.create({
      data: { tenantId: negocio.tenantId, nombre: 'Menú' },
    });
    const base = {
      tenantId: negocio.tenantId,
      categoriaId,
      tipoImpuesto: /** @type {const} */ ('impoconsumo'),
    };
    ids.hamburguesa = (
      await tx.producto.create({ data: { ...base, nombre: 'Hamburguesa', precio: '12000' } })
    ).id;
    ids.gaseosa = (
      await tx.producto.create({ data: { ...base, nombre: 'Gaseosa', precio: '4000' } })
    ).id;
    ids.mesa = (
      await tx.mesa.create({ data: { tenantId: negocio.tenantId, nombre: 'Mesa 1', capacidad: 4 } })
    ).id;
  });

  await llamar('post', '/caja/abrir', 'cajero', { montoInicial: 0 });
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * @param {'get' | 'post' | 'patch'} metodo
 * @param {string} ruta
 * @param {import('./ayudantes.js').Rol} rol
 * @param {Record<string, unknown>} [cuerpo]
 */
function llamar(metodo, ruta, rol, cuerpo) {
  const peticion = request(app)[metodo](ruta).set('Authorization', negocio.encabezados[rol]);
  return cuerpo ? peticion.send(cuerpo) : peticion;
}

/**
 * Busca un ítem de un pedido por el nombre de su producto.
 * @param {{ items: { id: string, producto: { nombre: string } }[] }} pedido
 * @param {string} nombre
 */
const itemDe = (pedido, nombre) => pedido.items.find((i) => i.producto.nombre === nombre);

describe('dividir la cuenta de una mesa', () => {
  /** @type {any} */
  let original;
  /** @type {any} */
  let nueva;

  it('pasa una hamburguesa y las dos gaseosas a una cuenta nueva en la misma mesa', async () => {
    // Pedido: 2 hamburguesas ($24.000) + 2 gaseosas ($8.000) = $32.000
    const { body: pedido } = await llamar('post', '/pedidos', 'mesero', {
      mesaId: ids.mesa,
      items: [
        { productoId: ids.hamburguesa, cantidad: 2, notas: 'Sin cebolla' },
        { productoId: ids.gaseosa, cantidad: 2 },
      ],
    });
    // La cocina ya empezó las hamburguesas: el estado debe conservarse al dividir.
    await llamar('post', `/pedidos/${pedido.id}/enviar-cocina`, 'mesero');
    await llamar(
      'patch',
      `/pedidos/${pedido.id}/items/${itemDe(pedido, 'Hamburguesa')?.id}/cocina`,
      'cocina',
      {
        estadoCocina: 'preparando',
      },
    );

    const res = await llamar('post', `/pedidos/${pedido.id}/dividir`, 'mesero', {
      items: [
        { itemId: itemDe(pedido, 'Hamburguesa')?.id, cantidad: 1 },
        { itemId: itemDe(pedido, 'Gaseosa')?.id, cantidad: 2 },
      ],
    });
    ({ original, nuevo: nueva } = res.body);

    expect(res.status).toBe(201);

    // Original: 1 hamburguesa = $12.000 (base 11.111,11 + INC 888,89)
    expect(original).toMatchObject({ total: '12000', subtotal: '11111.11', impuestos: '888.89' });
    expect(original.items).toHaveLength(1);
    expect(original.items[0]).toMatchObject({ cantidad: '1', producto: { nombre: 'Hamburguesa' } });

    // Nueva: 1 hamburguesa + 2 gaseosas = $20.000 (base 11.111,11 + 7.407,41; INC 888,89 + 592,59)
    expect(nueva).toMatchObject({
      total: '20000',
      subtotal: '18518.52',
      impuestos: '1481.48',
      mesaId: ids.mesa,
      estado: 'enviado_a_cocina',
    });
    expect(itemDe(nueva, 'Hamburguesa')).toMatchObject({
      cantidad: '1',
      precioUnitario: '12000',
      notas: 'Sin cebolla',
      estadoCocina: 'preparando',
    });
    expect(itemDe(nueva, 'Gaseosa')).toMatchObject({ cantidad: '2' });
  });

  it('la mesa queda con dos cuentas abiertas y sigue ocupada hasta cobrar ambas', async () => {
    await llamar('post', `/pedidos/${original.id}/cobrar`, 'cajero', {
      pagos: [{ metodo: 'efectivo', monto: 12000 }],
    });
    const despuesDeUna = await llamar('get', `/mesas/${ids.mesa}`, 'mesero');

    await llamar('post', `/pedidos/${nueva.id}/cobrar`, 'cajero', {
      pagos: [{ metodo: 'tarjeta', monto: 20000 }],
    });
    const despuesDeAmbas = await llamar('get', `/mesas/${ids.mesa}`, 'mesero');

    expect(despuesDeUna.body.estado).toBe('ocupada');
    expect(despuesDeAmbas.body.estado).toBe('libre');
  });

  it('entre ambas cuentas se cobró lo mismo que el pedido completo', async () => {
    const caja = await llamar('get', '/caja/actual', 'cajero');

    expect(caja.body.resumen.totalVendido).toBe('32000.00');
  });
});

describe('validaciones al dividir', () => {
  /** @type {any} */
  let pedido;

  beforeAll(async () => {
    ({ body: pedido } = await llamar('post', '/pedidos', 'mesero', {
      mesaId: ids.mesa,
      items: [
        { productoId: ids.hamburguesa, cantidad: 1 },
        { productoId: ids.gaseosa, cantidad: 1 },
      ],
    }));
  });

  /** @param {Record<string, unknown>[]} items */
  const dividir = (items) => llamar('post', `/pedidos/${pedido.id}/dividir`, 'mesero', { items });

  it('no deja pasar más unidades de las que tiene el ítem', async () => {
    const res = await dividir([{ itemId: itemDe(pedido, 'Gaseosa')?.id, cantidad: 2 }]);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('DIVISION_INVALIDA');
  });

  it('no deja pasar toda la cuenta: la original debe conservar algo', async () => {
    const res = await dividir([
      { itemId: itemDe(pedido, 'Hamburguesa')?.id, cantidad: 1 },
      { itemId: itemDe(pedido, 'Gaseosa')?.id, cantidad: 1 },
    ]);

    expect(res.status).toBe(422);
  });

  it('rechaza ítems repetidos o que no son del pedido', async () => {
    const itemId = itemDe(pedido, 'Gaseosa')?.id;
    const repetido = await dividir([
      { itemId, cantidad: 0.5 },
      { itemId, cantidad: 0.5 },
    ]);
    const ajeno = await dividir([{ itemId: '00000000-0000-4000-8000-000000000000', cantidad: 1 }]);

    expect(repetido.status).toBe(400);
    expect(ajeno.status).toBe(404);
  });

  it('no se puede dividir un pedido ya cobrado', async () => {
    await llamar('post', `/pedidos/${pedido.id}/cobrar`, 'cajero', {
      pagos: [{ metodo: 'efectivo', monto: 16000 }],
    });
    const res = await dividir([{ itemId: itemDe(pedido, 'Gaseosa')?.id, cantidad: 1 }]);

    expect(res.status).toBe(409);
  });
});
