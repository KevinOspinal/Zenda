// @ts-check
// Pruebas de los reportes de ventas con ventas de valores conocidos en distintos días,
// horas y métodos de pago. Comprueban totales, ranking, porcentajes, ticket promedio,
// el corte del día en hora de Colombia, anulaciones, validaciones, permisos y aislamiento.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { conNegocio } from '../src/lib/negocio.js';
import { calcularLinea, calcularTotalesPedido } from '../src/modules/pedidos/calculoImpuestos.js';
import { crearNegocioDePrueba } from './ayudantes.js';

const app = createApp();

/** @type {import('./ayudantes.js').NegocioDePrueba} */
let negocio;
/** @type {import('./ayudantes.js').NegocioDePrueba} */
let otroNegocio;

/** @type {Record<'hamburguesa' | 'gaseosa' | 'salchipapa', { id: string, precio: string }>} */
const productos = /** @type {any} */ ({});

/** Pedidos creados directo en la base: cada uno lleva su número del día. */
let pedidosCreados = 0;

/**
 * Registra una venta directamente en la base con totales calculados como en el sistema.
 * @param {object} venta
 * @param {string} venta.turnoId
 * @param {{ producto: 'hamburguesa' | 'gaseosa' | 'salchipapa', cantidad: string }[]} venta.items
 * @param {{ metodo: 'efectivo' | 'tarjeta' | 'transferencia' | 'otro', monto: string }[]} venta.pagos
 * @param {string | null} venta.cerradoEn Momento del cobro (ISO con zona horaria).
 * @param {'pagado' | 'anulado' | 'abierto'} venta.estado
 */
function registrarVenta({ turnoId, items, pagos, cerradoEn, estado }) {
  const lineas = items.map(({ producto, cantidad }) =>
    calcularLinea({ precioConImpuesto: productos[producto].precio, cantidad, tasaImpuesto: '8' }),
  );
  const totales = calcularTotalesPedido(lineas);

  pedidosCreados += 1;
  return conNegocio(negocio.tenantId, (tx) =>
    tx.pedido.create({
      data: {
        tenantId: negocio.tenantId,
        numero: pedidosCreados,
        turnoId,
        meseroId: negocio.usuarios.mesero,
        estado,
        cerradoEn: cerradoEn ? new Date(cerradoEn) : null,
        subtotal: totales.subtotal,
        impuestos: totales.impuestos,
        ajusteRedondeo: totales.ajusteRedondeo,
        total: totales.total,
        items: {
          create: items.map(({ producto, cantidad }) => ({
            tenantId: negocio.tenantId,
            productoId: productos[producto].id,
            cantidad,
            precioUnitario: productos[producto].precio,
            tasaImpuesto: '8',
          })),
        },
        pagos: { create: pagos.map((pago) => ({ ...pago, tenantId: negocio.tenantId })) },
      },
    }),
  );
}

beforeAll(async () => {
  negocio = await crearNegocioDePrueba('770000001');
  otroNegocio = await crearNegocioDePrueba('770000002');

  const turnoId = await conNegocio(negocio.tenantId, async (tx) => {
    const { id: categoriaId } = await tx.categoria.create({
      data: { tenantId: negocio.tenantId, nombre: 'Menú' },
    });
    for (const [clave, nombre, precio] of /** @type {const} */ ([
      ['hamburguesa', 'IND Classic Artesanal', '12000'],
      ['gaseosa', 'Gaseosa personal', '4000'],
      ['salchipapa', 'Salchi Classic 1P', '10000'],
    ])) {
      const producto = await tx.producto.create({
        data: {
          tenantId: negocio.tenantId,
          categoriaId,
          nombre,
          precio,
          tipoImpuesto: 'impoconsumo',
        },
      });
      productos[clave] = { id: producto.id, precio };
    }
    const turno = await tx.turnoCaja.create({
      data: {
        tenantId: negocio.tenantId,
        abiertoPorId: negocio.usuarios.cajero,
        montoInicial: '0',
        cerradoEn: new Date('2026-10-22T05:00:00Z'),
        montoContado: '0',
      },
    });
    return turno.id;
  });

  // ── 20 de octubre (hora de Colombia, UTC−5) ──
  // 12:30 → 2 hamburguesas + 1 gaseosa = $28.000 en efectivo
  await registrarVenta({
    turnoId,
    estado: 'pagado',
    cerradoEn: '2026-10-20T12:30:00-05:00',
    items: [
      { producto: 'hamburguesa', cantidad: '2' },
      { producto: 'gaseosa', cantidad: '1' },
    ],
    pagos: [{ metodo: 'efectivo', monto: '28000' }],
  });
  // 13:15 → 1 salchipapa + 2 gaseosas = $18.000 con tarjeta
  await registrarVenta({
    turnoId,
    estado: 'pagado',
    cerradoEn: '2026-10-20T13:15:00-05:00',
    items: [
      { producto: 'salchipapa', cantidad: '1' },
      { producto: 'gaseosa', cantidad: '2' },
    ],
    pagos: [{ metodo: 'tarjeta', monto: '18000' }],
  });
  // 23:30 → 1 hamburguesa = $12.000 por transferencia. En UTC ya es el 21, pero cuenta el 20.
  await registrarVenta({
    turnoId,
    estado: 'pagado',
    cerradoEn: '2026-10-20T23:30:00-05:00',
    items: [{ producto: 'hamburguesa', cantidad: '1' }],
    pagos: [{ metodo: 'transferencia', monto: '12000' }],
  });
  // 14:00 → 1 salchipapa cobrada y luego anulada: no suma a las ventas.
  await registrarVenta({
    turnoId,
    estado: 'anulado',
    cerradoEn: '2026-10-20T14:00:00-05:00',
    items: [{ producto: 'salchipapa', cantidad: '1' }],
    pagos: [{ metodo: 'efectivo', monto: '10000' }],
  });
  // Pedido todavía abierto: no es una venta.
  await registrarVenta({
    turnoId,
    estado: 'abierto',
    cerradoEn: null,
    items: [{ producto: 'hamburguesa', cantidad: '5' }],
    pagos: [],
  });

  // ── 21 de octubre ──
  // 09:00 → 1 gaseosa = $4.000 en efectivo
  await registrarVenta({
    turnoId,
    estado: 'pagado',
    cerradoEn: '2026-10-21T09:00:00-05:00',
    items: [{ producto: 'gaseosa', cantidad: '1' }],
    pagos: [{ metodo: 'efectivo', monto: '4000' }],
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * @param {string} ruta
 * @param {'dueno' | 'administrador' | 'cajero' | 'mesero'} [rol]
 */
function consultar(ruta, rol = 'dueno') {
  return request(app).get(ruta).set('Authorization', negocio.encabezados[rol]);
}

describe('GET /reportes/resumen', () => {
  it('resume el día: totales, impuestos, ticket promedio y anulaciones', async () => {
    const res = await consultar('/reportes/resumen?desde=2026-10-20&hasta=2026-10-20');

    // Ventas: 28.000 + 18.000 + 12.000 = 58.000
    // Bases:  25.925,92 + 16.666,67 + 11.111,11 = 53.703,70
    // INC:     2.074,08 +  1.333,33 +    888,89 =  4.296,30
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      rango: { desde: '2026-10-20', hasta: '2026-10-20' },
      ventas: 3,
      total: '58000.00',
      subtotal: '53703.70',
      impuestos: '4296.30',
      ajusteRedondeo: '0.00',
      // 58.000 / 3 = 19.333,33
      ticketPromedio: '19333.33',
      anulaciones: { cantidad: 1, total: '10000.00' },
    });
  });

  it('agrupa por hora de Colombia: la venta de las 11:30 p. m. cae en la hora 23 del mismo día', async () => {
    const res = await consultar('/reportes/resumen?desde=2026-10-20');

    expect(res.body.porHora).toEqual([
      { hora: 12, ventas: 1, total: '28000.00' },
      { hora: 13, ventas: 1, total: '18000.00' },
      { hora: 23, ventas: 1, total: '12000.00' },
    ]);
  });

  it('con un rango de varios días muestra las ventas de cada día', async () => {
    const res = await consultar('/reportes/resumen?desde=2026-10-20&hasta=2026-10-21');

    expect(res.body.ventas).toBe(4);
    expect(res.body.total).toBe('62000.00');
    expect(res.body.porDia).toEqual([
      { fecha: '2026-10-20', ventas: 3, total: '58000.00' },
      { fecha: '2026-10-21', ventas: 1, total: '4000.00' },
    ]);
  });

  it('sin fechas muestra el día de hoy (sin ventas en esta prueba)', async () => {
    const res = await consultar('/reportes/resumen');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ventas: 0,
      total: '0.00',
      ticketPromedio: '0.00',
      porHora: [],
    });
  });
});

describe('GET /reportes/por-producto', () => {
  it('ordena los productos del que más vendió al que menos, con su participación', async () => {
    const res = await consultar('/reportes/por-producto?desde=2026-10-20&hasta=2026-10-20');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe('58000.00');
    // La salchipapa anulada no cuenta; el pedido abierto tampoco.
    expect(res.body.productos.map(({ productoId: _, ...fila }) => fila)).toEqual([
      // 3 hamburguesas = 36.000 → 36.000 / 58.000 = 62,07 %
      {
        producto: 'IND Classic Artesanal',
        categoria: 'Menú',
        cantidad: '3',
        total: '36000.00',
        participacion: '62.07',
      },
      // 3 gaseosas = 12.000 → 20,69 %
      {
        producto: 'Gaseosa personal',
        categoria: 'Menú',
        cantidad: '3',
        total: '12000.00',
        participacion: '20.69',
      },
      // 1 salchipapa = 10.000 → 17,24 %
      {
        producto: 'Salchi Classic 1P',
        categoria: 'Menú',
        cantidad: '1',
        total: '10000.00',
        participacion: '17.24',
      },
    ]);
  });
});

describe('GET /reportes/por-metodo-pago', () => {
  it('muestra los 4 métodos con su total y participación', async () => {
    const res = await consultar('/reportes/por-metodo-pago?desde=2026-10-20&hasta=2026-10-20');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe('58000.00');
    expect(res.body.metodos).toEqual([
      // El efectivo de la venta anulada (10.000) no cuenta.
      { metodo: 'efectivo', pagos: 1, total: '28000.00', participacion: '48.28' },
      { metodo: 'tarjeta', pagos: 1, total: '18000.00', participacion: '31.03' },
      { metodo: 'transferencia', pagos: 1, total: '12000.00', participacion: '20.69' },
      { metodo: 'otro', pagos: 0, total: '0.00', participacion: '0.00' },
    ]);
  });
});

describe('validaciones, permisos y aislamiento', () => {
  it('rechaza fechas inválidas, rangos invertidos y rangos de más de 366 días', async () => {
    const formato = await consultar('/reportes/resumen?desde=20-10-2026');
    const invertido = await consultar('/reportes/resumen?desde=2026-10-21&hasta=2026-10-20');
    const muyLargo = await consultar('/reportes/resumen?desde=2024-01-01&hasta=2026-01-01');

    expect(formato.status).toBe(400);
    expect(invertido.status).toBe(400);
    expect(muyLargo.status).toBe(400);
  });

  it('el administrador ve los reportes; el cajero y el mesero no', async () => {
    const administrador = await consultar('/reportes/resumen', 'administrador');
    const cajero = await consultar('/reportes/resumen', 'cajero');
    const mesero = await consultar('/reportes/por-producto', 'mesero');

    expect(administrador.status).toBe(200);
    expect(cajero.status).toBe(403);
    expect(mesero.status).toBe(403);
  });

  it('otro negocio no ve estas ventas', async () => {
    const res = await request(app)
      .get('/reportes/resumen?desde=2026-10-20&hasta=2026-10-21')
      .set('Authorization', otroNegocio.encabezados.dueno);

    expect(res.body).toMatchObject({ ventas: 0, total: '0.00' });
  });
});
