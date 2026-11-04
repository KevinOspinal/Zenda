// @ts-check
// Pruebas de las opciones de los productos (término, adiciones, quitar): los grupos y sus
// reglas, asignarlos a un producto, pedir con opciones (precio, impuesto propio de cada adición,
// copia de lo vendido), dividir la cuenta, el reporte de adiciones y el aislamiento entre
// negocios.
//
// Precios redondos: el plato vale $10.800 con INC 8 % (base $10.000), el queso $2.160 con INC
// (base $2.000) y la tocineta $3.000 sin impuesto.
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
/** @type {string} */
let categoriaId;
/** @type {{ id: string, opciones: { id: string, nombre: string }[] }} */
let termino;
/** @type {{ id: string, opciones: { id: string, nombre: string }[] }} */
let adiciones;
/** @type {string} */
let hamburguesaId;

/**
 * @param {'get' | 'post' | 'put' | 'patch' | 'delete'} metodo
 * @param {string} ruta
 * @param {string} encabezado
 * @param {Record<string, unknown>} [cuerpo]
 */
function llamar(metodo, ruta, encabezado, cuerpo) {
  const peticion = request(app)[metodo](ruta).set('Authorization', encabezado);
  return cuerpo ? peticion.send(cuerpo) : peticion;
}

/**
 * Id de una opción de un grupo por su nombre.
 * @param {{ opciones: { id: string, nombre: string }[] }} grupo
 * @param {string} nombre
 */
const opcion = (grupo, nombre) =>
  /** @type {string} */ (grupo.opciones.find((o) => o.nombre === nombre)?.id);

let mesasCreadas = 0;

/**
 * Crea un pedido de mesa con un ítem y devuelve la respuesta del API.
 * @param {Record<string, unknown>} item
 */
async function pedirEnMesa(item) {
  mesasCreadas += 1;
  const mesa = await conNegocio(negocio.tenantId, (tx) =>
    tx.mesa.create({
      data: { tenantId: negocio.tenantId, nombre: `Mesa ${mesasCreadas}`, capacidad: 4 },
    }),
  );
  return llamar('post', '/pedidos', negocio.encabezados.mesero, { mesaId: mesa.id, items: [item] });
}

/** El grupo de adiciones completo, con los cambios indicados (para PUT). */
function adicionesCon(/** @type {Record<string, unknown>} */ cambios = {}) {
  return {
    nombre: 'Adiciones',
    minimo: 0,
    maximo: null,
    opciones: [
      {
        id: opcion(adiciones, 'Queso'),
        nombre: 'Queso',
        precioExtra: '2160',
        tipoImpuesto: 'impoconsumo',
      },
      {
        id: opcion(adiciones, 'Tocineta'),
        nombre: 'Tocineta',
        precioExtra: '3000',
        tipoImpuesto: 'exento',
      },
    ],
    ...cambios,
  };
}

beforeAll(async () => {
  negocio = await crearNegocioDePrueba('813000001');
  otroNegocio = await crearNegocioDePrueba('813000002');
  categoriaId = await conNegocio(negocio.tenantId, async (tx) => {
    const categoria = await tx.categoria.create({
      data: { tenantId: negocio.tenantId, nombre: 'Hamburguesas' },
    });
    return categoria.id;
  });
  await llamar('post', '/caja/abrir', negocio.encabezados.cajero, { montoInicial: 100000 });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('grupos de opciones', () => {
  it('el dueño crea el término (elegir 1, obligatorio) y las adiciones con precio', async () => {
    const resTermino = await llamar('post', '/grupos-opciones', negocio.encabezados.dueno, {
      nombre: 'Término de la carne',
      minimo: 1,
      maximo: 1,
      opciones: ['Azul', '1/2', '3/4', 'Bien asado'].map((nombre) => ({
        nombre,
        tipoImpuesto: 'impoconsumo',
      })),
    });
    const resAdiciones = await llamar(
      'post',
      '/grupos-opciones',
      negocio.encabezados.administrador,
      {
        nombre: 'Adiciones',
        opciones: [
          { nombre: 'Queso', precioExtra: '2160', tipoImpuesto: 'impoconsumo' },
          { nombre: 'Tocineta', precioExtra: 3000, tipoImpuesto: 'exento' },
        ],
      },
    );

    expect(resTermino.status).toBe(201);
    expect(resTermino.body).toMatchObject({ minimo: 1, maximo: 1, productos: 0 });
    expect(resTermino.body.opciones.map((/** @type {any} */ o) => o.nombre)).toEqual([
      'Azul',
      '1/2',
      '3/4',
      'Bien asado',
    ]);
    expect(resAdiciones.status).toBe(201);
    expect(resAdiciones.body).toMatchObject({ minimo: 0, maximo: null });
    termino = resTermino.body;
    adiciones = resAdiciones.body;
  });

  it('el mesero no puede crear grupos', async () => {
    const res = await llamar('post', '/grupos-opciones', negocio.encabezados.mesero, {
      nombre: 'Salsas',
      opciones: [{ nombre: 'Rosada', tipoImpuesto: 'exento' }],
    });

    expect(res.status).toBe(403);
  });

  it.each([
    ['un máximo menor que el mínimo', { minimo: 2, maximo: 1 }],
    ['un mínimo mayor que las opciones activas', { minimo: 3 }],
    ['nombres repetidos', { opciones: [{ nombre: 'Rosada' }, { nombre: 'rosada' }] }],
    ['un grupo sin opciones', { opciones: [] }],
  ])('rechaza %s', async (_caso, cambios) => {
    const res = await llamar('post', '/grupos-opciones', negocio.encabezados.dueno, {
      nombre: 'Salsas',
      opciones: [
        { nombre: 'Rosada', tipoImpuesto: 'exento' },
        { nombre: 'Tártara', tipoImpuesto: 'exento' },
      ],
      ...cambios,
      ...(cambios.opciones
        ? {
            opciones: cambios.opciones.map((/** @type {object} */ o) => ({
              tipoImpuesto: 'exento',
              ...o,
            })),
          }
        : {}),
    });

    expect(res.status).toBe(400);
  });

  it('rechaza un impuesto que el negocio no cobra (IVA en un negocio con INC)', async () => {
    const res = await llamar('post', '/grupos-opciones', negocio.encabezados.dueno, {
      nombre: 'Salsas',
      opciones: [{ nombre: 'Rosada', precioExtra: '500', tipoImpuesto: 'iva' }],
    });

    expect(res.status).toBe(422);
  });
});

describe('productos con opciones', () => {
  it('el producto lleva sus grupos y el menú los muestra con las opciones activas', async () => {
    const creado = await llamar('post', '/productos', negocio.encabezados.dueno, {
      categoriaId,
      nombre: 'IND Classic',
      precio: '10800',
      tipoImpuesto: 'impoconsumo',
      gruposOpciones: [termino.id, adiciones.id],
    });
    hamburguesaId = creado.body.id;

    const menu = await llamar('get', '/menu', negocio.encabezados.mesero);
    const producto = menu.body
      .flatMap((/** @type {any} */ categoria) => categoria.productos)
      .find((/** @type {any} */ p) => p.id === hamburguesaId);

    expect(creado.status).toBe(201);
    expect(creado.body.gruposOpciones).toEqual([termino.id, adiciones.id]);
    expect(producto.grupos.map((/** @type {any} */ g) => g.nombre)).toEqual([
      'Término de la carne',
      'Adiciones',
    ]);
    expect(producto.grupos[1].opciones[0]).toEqual({
      id: opcion(adiciones, 'Queso'),
      nombre: 'Queso',
      precioExtra: '2160',
    });
  });

  it('no deja enlazar el grupo de otro negocio', async () => {
    const ajeno = await llamar('post', '/grupos-opciones', otroNegocio.encabezados.dueno, {
      nombre: 'Ajeno',
      opciones: [{ nombre: 'X', tipoImpuesto: 'exento' }],
    });

    const res = await llamar('patch', `/productos/${hamburguesaId}`, negocio.encabezados.dueno, {
      gruposOpciones: [ajeno.body.id],
    });

    expect(res.status).toBe(404);
  });
});

describe('pedir con opciones', () => {
  it('sin el término obligatorio no se puede pedir', async () => {
    const res = await pedirEnMesa({ productoId: hamburguesaId, cantidad: 1 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('FALTAN_OPCIONES');
    expect(res.body.error.message).toContain('Término de la carne');
  });

  it('no deja elegir dos términos ni opciones de otro producto', async () => {
    const dosTerminos = await pedirEnMesa({
      productoId: hamburguesaId,
      cantidad: 1,
      opciones: [opcion(termino, 'Azul'), opcion(termino, '3/4')],
    });
    const inventada = await pedirEnMesa({
      productoId: hamburguesaId,
      cantidad: 1,
      opciones: [opcion(termino, '3/4'), '00000000-0000-4000-8000-000000000000'],
    });

    expect(dosTerminos.body.error.code).toBe('DEMASIADAS_OPCIONES');
    expect(inventada.body.error.code).toBe('OPCION_NO_VALIDA');
  });

  it('las adiciones suman al precio y cada una paga su propio impuesto', async () => {
    const res = await pedirEnMesa({
      productoId: hamburguesaId,
      cantidad: 1,
      opciones: [opcion(termino, '3/4'), opcion(adiciones, 'Queso'), opcion(adiciones, 'Tocineta')],
    });

    expect(res.status).toBe(201);
    const [item] = res.body.items;
    // $10.800 + $2.160 + $3.000.
    expect(item.precioUnitario).toBe('15960');
    expect(item.opciones.map((/** @type {any} */ o) => [o.grupo, o.nombre, o.precioExtra])).toEqual(
      [
        ['Término de la carne', '3/4', '0'],
        ['Adiciones', 'Queso', '2160'],
        ['Adiciones', 'Tocineta', '3000'],
      ],
    );
    // Cada una dice de qué opción del menú viene (para volver a pedir el plato igual).
    expect(item.opciones[1].opcionId).toBe(opcion(adiciones, 'Queso'));
    // Base: plato $10.000 + queso $2.000 + tocineta $3.000. Impuesto: $800 + $160 (la tocineta
    // no lleva).
    expect(res.body).toMatchObject({ subtotal: '15000', impuestos: '960', total: '15960' });
  });

  it('la venta conserva el precio de la adición aunque después cambie o se borre', async () => {
    const pedido = await pedirEnMesa({
      productoId: hamburguesaId,
      cantidad: 1,
      opciones: [opcion(termino, '1/2'), opcion(adiciones, 'Queso')],
    });

    const cambio = await llamar(
      'put',
      `/grupos-opciones/${adiciones.id}`,
      negocio.encabezados.dueno,
      {
        ...adicionesCon(),
        opciones: [{ ...adicionesCon().opciones[0], precioExtra: '2700' }],
      },
    );
    const despues = await llamar('get', `/pedidos/${pedido.body.id}`, negocio.encabezados.mesero);

    expect(cambio.status).toBe(200);
    // La tocineta no llegó: se borró del grupo.
    expect(cambio.body.opciones.map((/** @type {any} */ o) => o.nombre)).toEqual(['Queso']);
    expect(despues.body.items[0].precioUnitario).toBe('12960');
    expect(despues.body.items[0].opciones[1]).toMatchObject({
      nombre: 'Queso',
      precioExtra: '2160',
    });

    // El cambio de precio queda en la auditoría.
    const auditoria = await llamar(
      'get',
      '/auditoria?accion=cambiar_precio',
      negocio.encabezados.dueno,
    );
    expect(auditoria.body[0].detalle).toMatchObject({
      producto: 'Adiciones · Queso',
      precioAnterior: '2160.00',
      precioNuevo: '2700.00',
    });

    // Se deja el grupo como estaba para las demás pruebas.
    const restaurado = await llamar(
      'put',
      `/grupos-opciones/${adiciones.id}`,
      negocio.encabezados.dueno,
      {
        ...adicionesCon(),
        opciones: [
          { ...adicionesCon().opciones[0], precioExtra: '2160' },
          { nombre: 'Tocineta', precioExtra: '3000', tipoImpuesto: 'exento' },
        ],
      },
    );
    adiciones = restaurado.body;
  });

  it('una opción desactivada ya no se puede pedir', async () => {
    await llamar('put', `/grupos-opciones/${adiciones.id}`, negocio.encabezados.dueno, {
      ...adicionesCon(),
      opciones: [adicionesCon().opciones[0], { ...adicionesCon().opciones[1], activo: false }],
    });

    const res = await pedirEnMesa({
      productoId: hamburguesaId,
      cantidad: 1,
      opciones: [opcion(termino, '3/4'), opcion(adiciones, 'Tocineta')],
    });

    expect(res.body.error.code).toBe('OPCION_NO_VALIDA');
    await llamar(
      'put',
      `/grupos-opciones/${adiciones.id}`,
      negocio.encabezados.dueno,
      adicionesCon(),
    );
  });

  it('al dividir la cuenta, el plato pasa con sus opciones y su precio', async () => {
    const pedido = await pedirEnMesa({
      productoId: hamburguesaId,
      cantidad: 2,
      opciones: [opcion(termino, '3/4'), opcion(adiciones, 'Queso')],
    });
    const [item] = pedido.body.items;

    const res = await llamar(
      'post',
      `/pedidos/${pedido.body.id}/dividir`,
      negocio.encabezados.mesero,
      {
        items: [{ itemId: item.id, cantidad: '1' }],
      },
    );

    expect(res.status).toBe(201);
    for (const cuenta of [res.body.original, res.body.nuevo]) {
      expect(cuenta.items[0].precioUnitario).toBe('12960');
      expect(cuenta.items[0].opciones.map((/** @type {any} */ o) => o.nombre)).toEqual([
        '3/4',
        'Queso',
      ]);
      expect(cuenta).toMatchObject({ subtotal: '12000', impuestos: '960', total: '12960' });
    }
  });
});

describe('reporte de adiciones', () => {
  it('cuenta cada opción vendida y el dinero extra que dejó', async () => {
    const pedido = await pedirEnMesa({
      productoId: hamburguesaId,
      cantidad: 2,
      opciones: [opcion(termino, 'Bien asado'), opcion(adiciones, 'Tocineta')],
    });
    await llamar('post', `/pedidos/${pedido.body.id}/cobrar`, negocio.encabezados.cajero, {
      pagos: [{ metodo: 'efectivo', monto: pedido.body.total }],
    });

    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
    const res = await llamar(
      'get',
      `/reportes/por-opcion?desde=${hoy}&hasta=${hoy}`,
      negocio.encabezados.dueno,
    );

    expect(res.status).toBe(200);
    expect(res.body.opciones).toEqual([
      { grupo: 'Adiciones', nombre: 'Tocineta', cantidad: '2', total: '6000.00' },
      { grupo: 'Término de la carne', nombre: 'Bien asado', cantidad: '2', total: '0.00' },
    ]);
    expect(res.body.total).toBe('6000.00');
  });
});

describe('aislamiento y régimen', () => {
  it('un negocio no ve ni edita los grupos de otro', async () => {
    const lista = await llamar('get', '/grupos-opciones', otroNegocio.encabezados.dueno);
    const editar = await llamar(
      'put',
      `/grupos-opciones/${adiciones.id}`,
      otroNegocio.encabezados.dueno,
      { nombre: 'Robado', opciones: [{ nombre: 'X', tipoImpuesto: 'exento' }] },
    );

    expect(lista.body.map((/** @type {any} */ g) => g.id)).not.toContain(adiciones.id);
    expect(editar.status).toBe(404);
  });

  it('al pasar a no responsable, las adiciones quedan sin impuesto como los productos', async () => {
    const res = await llamar('patch', '/negocios/actual', otroNegocio.encabezados.dueno, {
      regimenImpuesto: 'no_responsable',
    });
    const grupos = await llamar('get', '/grupos-opciones', otroNegocio.encabezados.dueno);

    expect(res.status).toBe(200);
    expect(grupos.body[0].opciones[0].tipoImpuesto).toBe('exento');
  });

  it('borrar un grupo lo quita de los productos y las ventas conservan su copia', async () => {
    const pedido = await pedirEnMesa({
      productoId: hamburguesaId,
      cantidad: 1,
      opciones: [opcion(termino, 'Azul')],
    });

    const borrado = await llamar(
      'delete',
      `/grupos-opciones/${termino.id}`,
      negocio.encabezados.dueno,
    );
    const producto = await llamar('get', `/productos/${hamburguesaId}`, negocio.encabezados.dueno);
    const venta = await llamar('get', `/pedidos/${pedido.body.id}`, negocio.encabezados.mesero);

    expect(borrado.status).toBe(204);
    expect(producto.body.gruposOpciones).toEqual([adiciones.id]);
    expect(venta.body.items[0].opciones[0]).toMatchObject({
      grupo: 'Término de la carne',
      nombre: 'Azul',
      opcionId: null,
    });
  });
});
