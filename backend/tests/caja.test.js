// @ts-check
// Pruebas de la caja: apertura, un solo turno abierto, resumen de ventas por método,
// cierre con arqueo (sobrante o faltante), auditoría, permisos y aislamiento.
//
// Los pedidos y pagos se insertan directamente en la base porque sus endpoints
// llegan en la tarea 8; así el resumen se prueba con valores conocidos.
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

beforeAll(async () => {
  negocio = await crearNegocioDePrueba('730000001');
  otroNegocio = await crearNegocioDePrueba('730000002');
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Pedidos creados directo en la base: cada uno lleva su número del día. */
let pedidosCreados = 0;

/**
 * Crea un pedido con sus pagos directamente en la base.
 * Los totales cumplen la regla subtotal + impuestos + ajuste = total.
 * @param {string} turnoId
 * @param {'abierto' | 'enviado_a_cocina' | 'pagado' | 'anulado'} estado
 * @param {{ metodo: 'efectivo' | 'tarjeta' | 'transferencia' | 'otro', monto: string }[]} pagos
 */
function crearPedidoConPagos(turnoId, estado, pagos) {
  pedidosCreados += 1;
  return conNegocio(negocio.tenantId, (tx) =>
    tx.pedido.create({
      data: {
        tenantId: negocio.tenantId,
        numero: pedidosCreados,
        turnoId,
        meseroId: negocio.usuarios.mesero,
        estado,
        subtotal: '29166.66',
        impuestos: '2333.33',
        ajusteRedondeo: '0.01',
        total: '31500.00',
        pagos: {
          create: pagos.map((pago) => ({ ...pago, tenantId: negocio.tenantId })),
        },
      },
    }),
  );
}

/**
 * @param {'post' | 'get'} metodo
 * @param {string} ruta
 * @param {string} encabezado
 * @param {Record<string, unknown>} [cuerpo]
 */
function llamar(metodo, ruta, encabezado, cuerpo) {
  const peticion = request(app)[metodo](ruta).set('Authorization', encabezado);
  return cuerpo ? peticion.send(cuerpo) : peticion;
}

describe('caja: ciclo completo de un turno', () => {
  /** @type {string} */
  let turnoId;

  it('sin turno abierto, /caja/actual responde 404', async () => {
    const res = await llamar('get', '/caja/actual', negocio.encabezados.cajero);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SIN_TURNO_ABIERTO');
  });

  it('el cajero abre la caja con $100.000 de base', async () => {
    const res = await llamar('post', '/caja/abrir', negocio.encabezados.cajero, {
      montoInicial: 100000,
    });
    turnoId = res.body.id;

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      montoInicial: '100000',
      abiertoPorId: negocio.usuarios.cajero,
      cerradoEn: null,
    });
  });

  it('no se puede abrir un segundo turno mientras el primero esté abierto', async () => {
    const res = await llamar('post', '/caja/abrir', negocio.encabezados.administrador, {
      montoInicial: 50000,
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TURNO_YA_ABIERTO');
  });

  it('el resumen suma los pagos por método y no cuenta los pedidos anulados', async () => {
    // Pedido cobrado: $20.000 en efectivo + $11.500 con tarjeta.
    await crearPedidoConPagos(turnoId, 'pagado', [
      { metodo: 'efectivo', monto: '20000' },
      { metodo: 'tarjeta', monto: '11500' },
    ]);
    // Pedido anulado: su pago en efectivo no debe sumar.
    await crearPedidoConPagos(turnoId, 'anulado', [{ metodo: 'efectivo', monto: '5000' }]);

    const res = await llamar('get', '/caja/actual', negocio.encabezados.cajero);

    expect(res.status).toBe(200);
    expect(res.body.resumen).toEqual({
      ventasPorMetodo: {
        efectivo: '20000.00',
        tarjeta: '11500.00',
        transferencia: '0.00',
        otro: '0.00',
      },
      totalCobrado: '31500.00',
      totalVendido: '31500.00',
      propinas: '0.00',
      // Base de $100.000 + $20.000 cobrados en efectivo.
      efectivoEsperado: '120000.00',
      pedidos: { pagados: 1, abiertos: 0, anulados: 1 },
    });
  });

  it('no deja cerrar la caja con pedidos sin cobrar', async () => {
    const pendiente = await crearPedidoConPagos(turnoId, 'enviado_a_cocina', []);

    const res = await llamar('post', '/caja/cerrar', negocio.encabezados.cajero, {
      montoContado: 120000,
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PEDIDOS_ABIERTOS');

    // Se anula el pendiente para poder continuar.
    await conNegocio(negocio.tenantId, (tx) =>
      tx.pedido.update({ where: { id: pendiente.id }, data: { estado: 'anulado' } }),
    );
  });

  it('cierra con arqueo: contar $119.500 cuando se esperaban $120.000 es un faltante de $500', async () => {
    const res = await llamar('post', '/caja/cerrar', negocio.encabezados.cajero, {
      montoContado: '119500',
    });

    expect(res.status).toBe(200);
    expect(res.body.cerradoEn).not.toBeNull();
    expect(res.body.cerradoPorId).toBe(negocio.usuarios.cajero);
    expect(res.body.arqueo).toEqual({
      efectivoEsperado: '120000.00',
      montoContado: '119500.00',
      diferencia: '-500.00',
    });
  });

  it('el cierre queda en la auditoría', async () => {
    const registro = await conNegocio(negocio.tenantId, (tx) =>
      tx.auditoria.findFirst({ where: { accion: 'cerrar_caja', entidadId: turnoId } }),
    );

    expect(registro).toMatchObject({
      usuarioId: negocio.usuarios.cajero,
      detalle: { efectivoEsperado: '120000.00', montoContado: '119500.00', diferencia: '-500.00' },
    });
  });

  it('después de cerrar ya no hay turno abierto y se puede abrir uno nuevo', async () => {
    const actual = await llamar('get', '/caja/actual', negocio.encabezados.cajero);
    const cerrarOtraVez = await llamar('post', '/caja/cerrar', negocio.encabezados.cajero, {
      montoContado: 0,
    });
    const nuevo = await llamar('post', '/caja/abrir', negocio.encabezados.cajero, {
      montoInicial: 80000,
    });

    expect(actual.status).toBe(404);
    expect(cerrarOtraVez.status).toBe(404);
    expect(nuevo.status).toBe(201);
  });

  it('el historial muestra el arqueo del turno cerrado', async () => {
    const lista = await llamar('get', '/caja/turnos', negocio.encabezados.dueno);
    const detalle = await llamar('get', `/caja/turnos/${turnoId}`, negocio.encabezados.dueno);

    expect(lista.status).toBe(200);
    expect(lista.body).toHaveLength(2);
    expect(lista.body[1].abiertoPor.nombre).toBe('cajero 730000001');
    expect(detalle.body.arqueo.diferencia).toBe('-500.00');
  });
});

describe('caja: permisos y aislamiento', () => {
  it('el mesero no maneja la caja', async () => {
    const abrir = await llamar('post', '/caja/abrir', negocio.encabezados.mesero, {
      montoInicial: 1000,
    });
    const actual = await llamar('get', '/caja/actual', negocio.encabezados.mesero);

    expect(abrir.status).toBe(403);
    expect(actual.status).toBe(403);
  });

  it('el cajero no ve el historial de arqueos', async () => {
    const res = await llamar('get', '/caja/turnos', negocio.encabezados.cajero);

    expect(res.status).toBe(403);
  });

  it('valida los montos', async () => {
    const negativo = await llamar('post', '/caja/abrir', otroNegocio.encabezados.cajero, {
      montoInicial: -1,
    });
    const conPuntos = await llamar('post', '/caja/abrir', otroNegocio.encabezados.cajero, {
      montoInicial: '100.000',
    });

    expect(negativo.status).toBe(400);
    expect(conPuntos.status).toBe(400);
  });

  it('el turno abierto de un negocio no afecta al otro', async () => {
    // El primer negocio tiene un turno abierto; el otro puede abrir el suyo sin problema.
    const res = await llamar('post', '/caja/abrir', otroNegocio.encabezados.cajero, {
      montoInicial: 50000,
    });
    const ajeno = await llamar('get', '/caja/turnos', otroNegocio.encabezados.dueno);

    expect(res.status).toBe(201);
    expect(ajeno.body).toHaveLength(1);
  });
});
