// @ts-check
// Pruebas de tiempo real (Socket.IO): autenticación de la conexión, eventos del ciclo de
// una venta, aislamiento entre negocios y desconexión cuando vence el token.
import { createServer } from 'node:http';
import jwt from 'jsonwebtoken';
import { io as conectarCliente } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { conNegocio } from '../src/lib/negocio.js';
import { EVENTOS, registrarServidorSocket } from '../src/sockets/eventos.js';
import { crearServidorSocket } from '../src/sockets/servidor.js';
import { crearNegocioDePrueba } from './ayudantes.js';

/** @typedef {import('socket.io-client').Socket} SocketCliente */

const servidorHttp = createServer(createApp());
const io = crearServidorSocket(servidorHttp);
/** @type {string} */
let url;

/** @type {import('./ayudantes.js').NegocioDePrueba} */
let negocio;
/** @type {import('./ayudantes.js').NegocioDePrueba} */
let otroNegocio;
/** @type {SocketCliente[]} */
const abiertos = [];

const ids = { hamburguesa: '', mesa: '' };

/**
 * Quita el prefijo "Bearer " de un encabezado de prueba.
 * @param {string} encabezado
 */
const tokenDe = (encabezado) => encabezado.replace('Bearer ', '');

/**
 * Conecta un dispositivo. Resuelve al conectar; rechaza con el código de error si no lo dejan.
 * @param {Record<string, unknown>} opciones Opciones del cliente (auth o extraHeaders).
 * @returns {Promise<SocketCliente>}
 */
function conectar(opciones) {
  return new Promise((resolve, reject) => {
    const socket = conectarCliente(url, {
      transports: ['websocket'],
      reconnection: false,
      ...opciones,
    });
    abiertos.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (error) => reject(error.message));
  });
}

/**
 * Espera un evento en un socket.
 * @param {SocketCliente} socket
 * @param {string} evento
 * @returns {Promise<any>}
 */
function esperarEvento(socket, evento) {
  return new Promise((resolve, reject) => {
    const limite = setTimeout(() => reject(new Error(`No llegó el evento ${evento}`)), 3000);
    socket.once(evento, (datos) => {
      clearTimeout(limite);
      resolve(datos);
    });
  });
}

/**
 * Petición REST autenticada al mismo servidor.
 * @param {'get' | 'post' | 'patch'} metodo
 * @param {string} ruta
 * @param {import('./ayudantes.js').Rol} rol
 * @param {Record<string, unknown>} [cuerpo]
 */
function llamar(metodo, ruta, rol, cuerpo) {
  const peticion = request(servidorHttp)
    [metodo](ruta)
    .set('Authorization', negocio.encabezados[rol]);
  return cuerpo ? peticion.send(cuerpo) : peticion;
}

beforeAll(async () => {
  registrarServidorSocket(io);
  await new Promise((resolve) => servidorHttp.listen(0, () => resolve(undefined)));
  const direccion = /** @type {import('node:net').AddressInfo} */ (servidorHttp.address());
  url = `http://localhost:${direccion.port}`;

  negocio = await crearNegocioDePrueba('760000001');
  otroNegocio = await crearNegocioDePrueba('760000002');

  await conNegocio(negocio.tenantId, async (tx) => {
    const { id: categoriaId } = await tx.categoria.create({
      data: { tenantId: negocio.tenantId, nombre: 'Hamburguesas' },
    });
    ids.hamburguesa = (
      await tx.producto.create({
        data: {
          tenantId: negocio.tenantId,
          categoriaId,
          nombre: 'IND Classic Artesanal',
          precio: '12000',
          tipoImpuesto: 'impoconsumo',
        },
      })
    ).id;
    ids.mesa = (
      await tx.mesa.create({ data: { tenantId: negocio.tenantId, nombre: 'Mesa 1', capacidad: 4 } })
    ).id;
  });
});

afterAll(async () => {
  for (const socket of abiertos) socket.disconnect();
  registrarServidorSocket(null);
  await new Promise((resolve) => io.close(() => resolve(undefined)));
  await prisma.$disconnect();
});

describe('conexión', () => {
  it('rechaza conexiones sin token', async () => {
    await expect(conectar({})).rejects.toBe('NO_AUTENTICADO');
  });

  it('rechaza un token alterado', async () => {
    const alterado = tokenDe(negocio.encabezados.mesero).slice(0, -3) + 'abc';
    await expect(conectar({ auth: { token: alterado } })).rejects.toBe('TOKEN_INVALIDO');
  });

  it('rechaza un token vencido', async () => {
    const vencido = jwt.sign(
      { tenantId: negocio.tenantId, rol: 'mesero', exp: Math.floor(Date.now() / 1000) - 10 },
      process.env.JWT_SECRET ?? '',
      { subject: negocio.usuarios.mesero },
    );
    await expect(conectar({ auth: { token: vencido } })).rejects.toBe('TOKEN_EXPIRADO');
  });

  it('acepta el token en auth.token o en el encabezado Authorization (Postman)', async () => {
    const porAuth = await conectar({ auth: { token: tokenDe(negocio.encabezados.mesero) } });
    const porEncabezado = await conectar({
      extraHeaders: { Authorization: negocio.encabezados.cajero },
    });

    expect(porAuth.connected).toBe(true);
    expect(porEncabezado.connected).toBe(true);
  });

  it('cuando el token vence, avisa sesion:expirada y desconecta', async () => {
    const vencePronto = jwt.sign(
      { tenantId: negocio.tenantId, rol: 'mesero', exp: Math.floor(Date.now() / 1000) + 1 },
      process.env.JWT_SECRET ?? '',
      { subject: negocio.usuarios.mesero },
    );
    const socket = await conectar({ auth: { token: vencePronto } });

    // Se escuchan los dos eventos desde el inicio: llegan casi al mismo tiempo.
    const aviso = esperarEvento(socket, EVENTOS.SESION_EXPIRADA);
    const desconexion = esperarEvento(socket, 'disconnect');

    expect((await aviso).mensaje).toMatch(/expiró/);
    await desconexion;
    expect(socket.connected).toBe(false);
  });
});

describe('eventos del ciclo de una venta', () => {
  /** @type {SocketCliente} */
  let cocina;
  /** @type {SocketCliente} */
  let caja;
  /** Eventos que recibe un dispositivo del otro negocio: debe quedar vacío. */
  /** @type {string[]} */
  const eventosAjenos = [];
  /** @type {string} */
  let pedidoId;

  beforeAll(async () => {
    cocina = await conectar({ auth: { token: tokenDe(negocio.encabezados.mesero) } });
    caja = await conectar({ auth: { token: tokenDe(negocio.encabezados.cajero) } });
    const ajeno = await conectar({ auth: { token: tokenDe(otroNegocio.encabezados.dueno) } });
    ajeno.onAny((evento) => eventosAjenos.push(evento));
  });

  it('abrir la caja avisa a los meseros, sin montos', async () => {
    const evento = esperarEvento(cocina, EVENTOS.CAJA_ABIERTA);
    await llamar('post', '/caja/abrir', 'cajero', { montoInicial: 100000 });

    const datos = await evento;
    expect(datos.turnoId).toEqual(expect.any(String));
    expect(datos).not.toHaveProperty('montoInicial');
  });

  it('crear un pedido en mesa avisa el pedido nuevo y que la mesa quedó ocupada', async () => {
    const pedidoCreado = esperarEvento(caja, EVENTOS.PEDIDO_CREADO);
    const mesa = esperarEvento(caja, EVENTOS.MESA_ESTADO);

    const res = await llamar('post', '/pedidos', 'mesero', { mesaId: ids.mesa });
    pedidoId = res.body.id;

    expect(await pedidoCreado).toMatchObject({
      id: pedidoId,
      estado: 'abierto',
      mesa: { id: ids.mesa, nombre: 'Mesa 1' },
    });
    expect(await mesa).toEqual({ mesaId: ids.mesa, nombre: 'Mesa 1', estado: 'ocupada' });
  });

  it('agregar un ítem avisa el pedido con su comanda y el total nuevo', async () => {
    const actualizado = esperarEvento(caja, EVENTOS.PEDIDO_ACTUALIZADO);
    await llamar('post', `/pedidos/${pedidoId}/items`, 'mesero', {
      productoId: ids.hamburguesa,
      cantidad: 2,
      notas: 'Sin cebolla',
    });

    const datos = await actualizado;
    expect(datos.total).toBe('24000');
    expect(datos.items).toEqual([
      expect.objectContaining({
        producto: 'IND Classic Artesanal',
        cantidad: '2',
        notas: 'Sin cebolla',
      }),
    ]);
  });

  it('enviar a cocina entrega la comanda a la cocina', async () => {
    const comanda = esperarEvento(cocina, EVENTOS.PEDIDO_ENVIADO_A_COCINA);
    await llamar('post', `/pedidos/${pedidoId}/enviar-cocina`, 'mesero');

    expect(await comanda).toMatchObject({
      id: pedidoId,
      estado: 'enviado_a_cocina',
      mesa: { nombre: 'Mesa 1' },
      items: [{ producto: 'IND Classic Artesanal', cantidad: '2', estadoCocina: 'pendiente' }],
    });
  });

  it('cuando la cocina marca un ítem como listo, el mesero se entera', async () => {
    const { body: pedido } = await llamar('get', `/pedidos/${pedidoId}`, 'mesero');
    const itemId = pedido.items[0].id;
    await llamar('patch', `/pedidos/${pedidoId}/items/${itemId}/cocina`, 'cocina', {
      estadoCocina: 'preparando',
    });

    const listo = esperarEvento(cocina, EVENTOS.ITEM_ESTADO_COCINA);
    await llamar('patch', `/pedidos/${pedidoId}/items/${itemId}/cocina`, 'cocina', {
      estadoCocina: 'listo',
    });

    expect(await listo).toEqual({
      pedidoId,
      mesa: { id: ids.mesa, nombre: 'Mesa 1' },
      itemId,
      producto: 'IND Classic Artesanal',
      estadoCocina: 'listo',
    });
  });

  it('cobrar avisa el pago y que la mesa quedó libre, sin datos del cliente', async () => {
    const pagado = esperarEvento(cocina, EVENTOS.PEDIDO_PAGADO);
    const mesa = esperarEvento(cocina, EVENTOS.MESA_ESTADO);

    await llamar('post', `/pedidos/${pedidoId}/cobrar`, 'cajero', {
      pagos: [{ metodo: 'efectivo', monto: 24000 }],
    });

    const datos = await pagado;
    expect(datos).toMatchObject({ id: pedidoId, estado: 'pagado' });
    expect(datos).not.toHaveProperty('cliente');
    expect(datos).not.toHaveProperty('pagos');
    expect(await mesa).toMatchObject({ mesaId: ids.mesa, estado: 'libre' });
  });

  it('anular avisa el pedido anulado', async () => {
    const { body: pedido } = await llamar('post', '/pedidos', 'cajero', {
      items: [{ productoId: ids.hamburguesa, cantidad: 1 }],
    });
    const anulado = esperarEvento(caja, EVENTOS.PEDIDO_ANULADO);

    await llamar('post', `/pedidos/${pedido.id}/anular`, 'dueno', { motivo: 'Prueba' });

    expect(await anulado).toMatchObject({ id: pedido.id, estado: 'anulado', mesa: null });
  });

  it('cerrar la caja avisa a todos, sin el arqueo', async () => {
    const cerrada = esperarEvento(cocina, EVENTOS.CAJA_CERRADA);
    await llamar('post', '/caja/cerrar', 'cajero', { montoContado: 124000 });

    const datos = await cerrada;
    expect(datos.cerradoEn).toEqual(expect.any(String));
    expect(datos).not.toHaveProperty('arqueo');
  });

  it('un dispositivo de otro negocio no recibió ningún evento', () => {
    expect(eventosAjenos).toEqual([]);
  });
});
