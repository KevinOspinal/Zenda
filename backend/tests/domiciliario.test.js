// @ts-check
// Pruebas del domiciliario y de las dos formas de pago de un domicilio:
// - Acceso a Zenda: el dueño se lo da y se lo quita; entra con su rol y solo ve sus entregas.
// - Pago anticipado: se cobra antes de salir, solo sale pagado y termina al entregarse.
// - Contra entrega: no se cobra antes de salir; al entregarse queda "por liquidar" hasta que la
//   caja recibe el dinero (liquidación, todo o nada). Mientras tanto la caja no cierra.
// - Cambio de forma de pago antes de salir y enlace de ubicación del cliente.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { conNegocio } from '../src/lib/negocio.js';
import { crearNegocioDePrueba } from './ayudantes.js';

const app = createApp();
const CONTRASENA = 'Domicilios2026';

/** Domicilio contra entrega de una hamburguesa ($12.000 + $3.000 de domicilio = $15.000). */
const CONTRA_ENTREGA = Object.freeze({
  telefono: '3109876543',
  direccion: 'Calle 10 # 5-20, barrio San Antonio',
  formaPago: 'contra_entrega',
  pagaCon: '50000',
});

/** Domicilio de pago anticipado. */
const ANTICIPADO = Object.freeze({
  telefono: '3109876543',
  direccion: 'Calle 10 # 5-20, barrio San Antonio',
  formaPago: 'anticipado',
});

/**
 * @typedef {object} Local
 * @property {import('./ayudantes.js').NegocioDePrueba} negocio
 * @property {string} nit
 * @property {string} hamburguesa Id del producto de $12.000.
 * @property {Record<string, { id: string, encabezado?: string }>} domiciliarios
 */

/** @type {Local} */
let local;

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

/**
 * Inicia sesión como lo hace la app y devuelve el encabezado `Authorization`.
 * @param {string} nit
 * @param {string} email
 */
async function ingresar(nit, email) {
  const res = await request(app).post('/auth/login').send({ nit, email, password: CONTRASENA });
  return res;
}

/**
 * Crea un negocio con caja abierta, una hamburguesa de $12.000 y domiciliarios. Los que se
 * nombran en `conAcceso` reciben acceso a Zenda (dado por el dueño) e inician sesión.
 * @param {string} nit
 * @param {string[]} nombres
 * @param {string[]} conAcceso
 * @returns {Promise<Local>}
 */
async function prepararLocal(nit, nombres, conAcceso) {
  const negocio = await crearNegocioDePrueba(nit);
  const hamburguesa = await conNegocio(negocio.tenantId, async (tx) => {
    const categoria = await tx.categoria.create({
      data: { tenantId: negocio.tenantId, nombre: 'Comidas' },
    });
    const producto = await tx.producto.create({
      data: {
        tenantId: negocio.tenantId,
        categoriaId: categoria.id,
        nombre: 'IND Classic Artesanal',
        precio: '12000',
        tipoImpuesto: 'impoconsumo',
      },
    });
    return producto.id;
  });
  await llamar('post', '/caja/abrir', negocio.encabezados.cajero, { montoInicial: 100000 });

  /** @type {Local['domiciliarios']} */
  const domiciliarios = {};
  for (const nombre of nombres) {
    const creado = await llamar('post', '/domiciliarios', negocio.encabezados.dueno, {
      nombre,
      telefono: '3001234567',
    });
    domiciliarios[nombre] = { id: creado.body.id };
  }
  for (const nombre of conAcceso) {
    const email = `${nombre.toLowerCase()}@${nit}.test`;
    const acceso = await llamar(
      'post',
      `/domiciliarios/${domiciliarios[nombre].id}/acceso`,
      negocio.encabezados.dueno,
      { email, contrasena: CONTRASENA },
    );
    expect(acceso.status).toBe(201);
    const sesion = await ingresar(nit, email);
    domiciliarios[nombre].encabezado = `Bearer ${sesion.body.tokenAcceso}`;
  }
  return { negocio, nit, hamburguesa, domiciliarios };
}

/**
 * Registra un domicilio como la caja, lo manda a cocina y la cocina lo deja listo.
 * @param {Local} en
 * @param {Record<string, unknown>} entrega
 */
async function domicilioListo(en, entrega) {
  const creado = await llamar('post', '/pedidos', en.negocio.encabezados.cajero, {
    tipo: 'domicilio',
    origen: 'whatsapp',
    nombreCliente: 'Juan',
    entrega,
    items: [{ productoId: en.hamburguesa, cantidad: 1 }],
  });
  expect(creado.status).toBe(201);
  await llamar('post', `/pedidos/${creado.body.id}/enviar-cocina`, en.negocio.encabezados.cajero);
  const listo = await llamar(
    'patch',
    `/pedidos/${creado.body.id}/cocina`,
    en.negocio.encabezados.cocina,
    { estadoCocina: 'listo' },
  );
  expect(listo.status).toBe(200);
  return creado.body;
}

/**
 * @param {Local} en
 * @param {string} pedidoId
 * @param {string} domiciliario
 */
function despachar(en, pedidoId, domiciliario) {
  return llamar('post', `/pedidos/${pedidoId}/despachar`, en.negocio.encabezados.cajero, {
    domiciliarioId: en.domiciliarios[domiciliario].id,
  });
}

/**
 * @param {Local} en
 * @param {string} pedidoId
 */
function cobrar(en, pedidoId) {
  return llamar('post', `/pedidos/${pedidoId}/cobrar`, en.negocio.encabezados.cajero, {
    pagos: [{ metodo: 'efectivo', monto: '15000' }],
  });
}

/**
 * @param {Local} en
 * @param {string} domiciliario
 * @param {Record<string, unknown>[]} pedidos
 */
function liquidar(en, domiciliario, pedidos) {
  return llamar(
    'post',
    `/domiciliarios/${en.domiciliarios[domiciliario].id}/liquidar`,
    en.negocio.encabezados.cajero,
    { pedidos },
  );
}

/**
 * Ids de los domicilios en curso que ve quien consulta.
 * @param {string} encabezado
 */
async function domiciliosEnCurso(encabezado) {
  const res = await llamar('get', '/pedidos?domicilios=true', encabezado);
  expect(res.status).toBe(200);
  return res.body.map((/** @type {any} */ pedido) => pedido.id);
}

beforeAll(async () => {
  local = await prepararLocal('812000001', ['Pedro', 'Ana', 'Luis'], ['Pedro', 'Ana']);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('acceso del domiciliario a Zenda', () => {
  it('el dueño se lo da y el domiciliario entra con su rol', async () => {
    const lista = await llamar('get', '/domiciliarios', local.negocio.encabezados.cajero);
    const pedro = lista.body.find((/** @type {any} */ d) => d.id === local.domiciliarios.Pedro.id);
    const luis = lista.body.find((/** @type {any} */ d) => d.id === local.domiciliarios.Luis.id);

    expect(pedro.acceso).toEqual({ email: 'pedro@812000001.test', activo: true });
    expect(luis.acceso).toBeNull();
    const sesion = await ingresar(local.nit, 'pedro@812000001.test');
    expect(sesion.status).toBe(200);
    expect(sesion.body.usuario.rol).toBe('domiciliario');
  });

  it('solo el dueño lo da, una vez y con un correo que nadie más use', async () => {
    const luis = `/domiciliarios/${local.domiciliarios.Luis.id}/acceso`;
    const pedro = `/domiciliarios/${local.domiciliarios.Pedro.id}/acceso`;
    const datos = { email: 'luis@812000001.test', contrasena: CONTRASENA };

    const delAdministrador = await llamar(
      'post',
      luis,
      local.negocio.encabezados.administrador,
      datos,
    );
    const otraVez = await llamar('post', pedro, local.negocio.encabezados.dueno, datos);
    const correoAjeno = await llamar('post', luis, local.negocio.encabezados.dueno, {
      ...datos,
      email: 'cajero@812000001.test',
    });

    expect(delAdministrador.status).toBe(403);
    expect(otraVez.body.error.code).toBe('ACCESO_EXISTENTE');
    expect(correoAjeno.body.error.code).toBe('YA_EXISTE');
  });

  it('su usuario no cambia de rol desde Usuarios', async () => {
    const usuario = await conNegocio(local.negocio.tenantId, (tx) =>
      tx.domiciliario.findUniqueOrThrow({ where: { id: local.domiciliarios.Ana.id } }),
    );

    const res = await llamar(
      'patch',
      `/usuarios/${usuario.usuarioId}`,
      local.negocio.encabezados.dueno,
      { rol: 'cajero' },
    );

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ROL_DOMICILIARIO');
  });

  it('dar y quitar el acceso queda en la auditoría', async () => {
    const res = await llamar(
      'get',
      '/auditoria?accion=dar_acceso_domiciliario',
      local.negocio.encabezados.dueno,
    );

    expect(res.body.map((/** @type {any} */ r) => r.detalle.domiciliario)).toEqual(
      expect.arrayContaining(['Pedro', 'Ana']),
    );
  });
});

describe('lo que ve y hace el domiciliario', () => {
  it('solo ve los domicilios que lleva él, con sus datos de entrega', async () => {
    const dePedro = await domicilioListo(local, CONTRA_ENTREGA);
    const deAna = await domicilioListo(local, CONTRA_ENTREGA);
    await despachar(local, dePedro.id, 'Pedro');
    await despachar(local, deAna.id, 'Ana');
    const pedro = /** @type {string} */ (local.domiciliarios.Pedro.encabezado);

    const lista = await llamar('get', '/pedidos?domicilios=true', pedro);
    const ajeno = await llamar('get', `/pedidos/${deAna.id}`, pedro);
    const propio = await llamar('get', `/pedidos/${dePedro.id}`, pedro);

    expect(lista.body.map((/** @type {any} */ p) => p.id)).toContain(dePedro.id);
    expect(lista.body.map((/** @type {any} */ p) => p.id)).not.toContain(deAna.id);
    expect(lista.body.find((/** @type {any} */ p) => p.id === dePedro.id).entrega).toMatchObject({
      direccion: CONTRA_ENTREGA.direccion,
      formaPago: 'contra_entrega',
      pagaCon: '50000',
    });
    expect(ajeno.status).toBe(404);
    expect(propio.body.entrega.telefono).toBe(CONTRA_ENTREGA.telefono);
  });

  it('no lista otros pedidos, no toma pedidos, no marca platos, no despacha ni cobra', async () => {
    const pedro = /** @type {string} */ (local.domiciliarios.Pedro.encabezado);
    const pedido = await domicilioListo(local, ANTICIPADO);

    const activos = await llamar('get', '/pedidos?activos=true', pedro);
    const todos = await llamar('get', '/pedidos', pedro);
    const nuevo = await llamar('post', '/pedidos', pedro, { tipo: 'mostrador', items: [] });
    const plato = await llamar('patch', `/pedidos/${pedido.id}/cocina`, pedro, {
      estadoCocina: 'entregado',
    });
    const despacho = await llamar('post', `/pedidos/${pedido.id}/despachar`, pedro, {
      domiciliarioId: local.domiciliarios.Pedro.id,
    });
    const cobro = await llamar('post', `/pedidos/${pedido.id}/cobrar`, pedro, {
      pagos: [{ metodo: 'efectivo', monto: '15000' }],
    });

    expect([activos.status, todos.status, nuevo.status, plato.status]).toEqual([
      403, 403, 403, 403,
    ]);
    expect([despacho.status, cobro.status]).toEqual([403, 403]);
  });

  it('no entrega los domicilios que lleva otro', async () => {
    const deAna = await domicilioListo(local, CONTRA_ENTREGA);
    await despachar(local, deAna.id, 'Ana');

    const res = await llamar(
      'post',
      `/pedidos/${deAna.id}/entregar`,
      /** @type {string} */ (local.domiciliarios.Pedro.encabezado),
    );

    expect(res.status).toBe(404);
  });
});

describe('pago anticipado', () => {
  it('solo sale pagado; el domiciliario lo entrega y termina, sin nada por liquidar', async () => {
    const pedro = /** @type {string} */ (local.domiciliarios.Pedro.encabezado);
    const pedido = await domicilioListo(local, ANTICIPADO);

    // 1. Sin pagar no sale.
    const sinPagar = await despachar(local, pedido.id, 'Pedro');
    expect(sinPagar.status).toBe(409);
    expect(sinPagar.body.error.code).toBe('DOMICILIO_SIN_PAGAR');

    // 2. Se cobra en la caja y sale; el domiciliario lo ve ya pagado.
    expect((await cobrar(local, pedido.id)).status).toBe(200);
    expect((await despachar(local, pedido.id, 'Pedro')).status).toBe(200);
    const enCamino = await llamar('get', `/pedidos/${pedido.id}`, pedro);
    expect(enCamino.body.estado).toBe('pagado');

    // 3. Al entregarlo termina: sale de las listas y deja de mostrarle los datos del cliente.
    const entregado = await llamar('post', `/pedidos/${pedido.id}/entregar`, pedro);
    expect(entregado.status).toBe(200);
    expect(await domiciliosEnCurso(local.negocio.encabezados.cajero)).not.toContain(pedido.id);
    expect(await domiciliosEnCurso(pedro)).not.toContain(pedido.id);
    expect(entregado.body.entrega).toBeUndefined();

    // 4. No hay dinero que liquidar.
    const liquidacion = await liquidar(local, 'Pedro', [{ pedidoId: pedido.id }]);
    expect(liquidacion.body.error.code).toBe('DOMICILIO_ANTICIPADO');
  });

  it('no lleva "paga con": el cliente ya pagó', async () => {
    const res = await llamar('post', '/pedidos', local.negocio.encabezados.cajero, {
      tipo: 'domicilio',
      nombreCliente: 'Juan',
      entrega: { ...ANTICIPADO, pagaCon: '50000' },
    });

    expect(res.status).toBe(400);
  });

  it('la forma de pago es obligatoria al tomar el domicilio', async () => {
    const res = await llamar('post', '/pedidos', local.negocio.encabezados.cajero, {
      tipo: 'domicilio',
      nombreCliente: 'Juan',
      entrega: { telefono: ANTICIPADO.telefono, direccion: ANTICIPADO.direccion },
    });

    expect(res.status).toBe(400);
  });
});

describe('contra entrega', () => {
  it('no se cobra antes de salir', async () => {
    const pedido = await domicilioListo(local, CONTRA_ENTREGA);

    const res = await cobrar(local, pedido.id);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COBRO_CONTRA_ENTREGA');
  });

  it('al entregarlo queda por liquidar; la caja recibe el billete y queda cobrado', async () => {
    const pedro = /** @type {string} */ (local.domiciliarios.Pedro.encabezado);
    const pedido = await domicilioListo(local, CONTRA_ENTREGA);
    await despachar(local, pedido.id, 'Pedro');

    // 1. El domiciliario lo entrega: sigue sin cobrar y la caja lo ve por liquidar.
    const entregado = await llamar('post', `/pedidos/${pedido.id}/entregar`, pedro);
    expect(entregado.body.estado).not.toBe('pagado');
    expect(entregado.body.entrega.entregadoEn).toEqual(expect.any(String));
    expect(await domiciliosEnCurso(local.negocio.encabezados.cajero)).toContain(pedido.id);
    expect(await domiciliosEnCurso(pedro)).toContain(pedido.id);

    // 2. La caja lo liquida en efectivo: el billete del cliente queda como lo recibido.
    const liquidacion = await liquidar(local, 'Pedro', [{ pedidoId: pedido.id }]);
    expect(liquidacion.status).toBe(200);
    expect(liquidacion.body.total).toBe('15000.00');
    expect(liquidacion.body.pedidos[0].estado).toBe('pagado');
    expect(liquidacion.body.pedidos[0].pagos[0]).toMatchObject({
      metodo: 'efectivo',
      monto: '15000',
      recibido: '50000',
    });

    // 3. Terminó: sale de las listas y el domiciliario ya no ve los datos del cliente.
    expect(await domiciliosEnCurso(local.negocio.encabezados.cajero)).not.toContain(pedido.id);
    expect(await domiciliosEnCurso(pedro)).not.toContain(pedido.id);
    const despues = await llamar('get', `/pedidos/${pedido.id}`, pedro);
    expect(despues.body.entrega).toBeUndefined();

    // 4. No se liquida dos veces, y queda en la auditoría.
    const otraVez = await liquidar(local, 'Pedro', [{ pedidoId: pedido.id }]);
    expect(otraVez.body.error.code).toBe('DOMICILIO_LIQUIDADO');
    const auditoria = await llamar(
      'get',
      '/auditoria?accion=liquidar_domiciliario',
      local.negocio.encabezados.dueno,
    );
    expect(auditoria.body[0].detalle).toMatchObject({
      domiciliario: 'Pedro',
      pedidos: [pedido.numero],
      total: '15000.00',
    });
  });

  it('si el cliente le pagó por transferencia, se liquida como transferencia', async () => {
    const ana = /** @type {string} */ (local.domiciliarios.Ana.encabezado);
    const pedido = await domicilioListo(local, CONTRA_ENTREGA);
    await despachar(local, pedido.id, 'Ana');
    await llamar('post', `/pedidos/${pedido.id}/entregar`, ana);

    const res = await liquidar(local, 'Ana', [
      { pedidoId: pedido.id, metodo: 'transferencia', referencia: 'Nequi 4521' },
    ]);

    expect(res.body.pedidos[0].pagos[0]).toMatchObject({
      metodo: 'transferencia',
      referencia: 'Nequi 4521',
      recibido: null,
    });
  });

  it('la liquidación es todo o nada', async () => {
    const pedro = /** @type {string} */ (local.domiciliarios.Pedro.encabezado);
    const entregado = await domicilioListo(local, CONTRA_ENTREGA);
    const enCamino = await domicilioListo(local, CONTRA_ENTREGA);
    await despachar(local, entregado.id, 'Pedro');
    await despachar(local, enCamino.id, 'Pedro');
    await llamar('post', `/pedidos/${entregado.id}/entregar`, pedro);

    const res = await liquidar(local, 'Pedro', [
      { pedidoId: entregado.id },
      { pedidoId: enCamino.id },
    ]);
    const sigue = await llamar('get', `/pedidos/${entregado.id}`, local.negocio.encabezados.cajero);

    expect(res.body.error.code).toBe('DOMICILIO_SIN_ENTREGAR');
    expect(sigue.body.estado).not.toBe('pagado');
  });

  it('no se liquida el domicilio de otro domiciliario', async () => {
    const ana = /** @type {string} */ (local.domiciliarios.Ana.encabezado);
    const deAna = await domicilioListo(local, CONTRA_ENTREGA);
    await despachar(local, deAna.id, 'Ana');
    await llamar('post', `/pedidos/${deAna.id}/entregar`, ana);

    const res = await liquidar(local, 'Pedro', [{ pedidoId: deAna.id }]);

    expect(res.status).toBe(404);
  });

  it('sin acceso a Zenda, la caja cobra al volver el domiciliario y lo entrega', async () => {
    const pedido = await domicilioListo(local, CONTRA_ENTREGA);
    await despachar(local, pedido.id, 'Luis');

    const cobro = await cobrar(local, pedido.id);
    const entrega = await llamar(
      'post',
      `/pedidos/${pedido.id}/entregar`,
      local.negocio.encabezados.cajero,
    );

    expect(cobro.status).toBe(200);
    expect(entrega.status).toBe(200);
    expect(await domiciliosEnCurso(local.negocio.encabezados.cajero)).not.toContain(pedido.id);
  });
});

describe('la caja no cierra con dinero en la calle', () => {
  it('con un domicilio por liquidar no cierra; al liquidarlo, sí', async () => {
    const tienda = await prepararLocal('812000002', ['Pedro'], ['Pedro']);
    const pedro = /** @type {string} */ (tienda.domiciliarios.Pedro.encabezado);
    const pedido = await domicilioListo(tienda, CONTRA_ENTREGA);
    await despachar(tienda, pedido.id, 'Pedro');
    await llamar('post', `/pedidos/${pedido.id}/entregar`, pedro);
    const cerrar = () =>
      llamar('post', '/caja/cerrar', tienda.negocio.encabezados.cajero, { montoContado: 115000 });

    const conDineroAfuera = await cerrar();
    await liquidar(tienda, 'Pedro', [{ pedidoId: pedido.id }]);
    const liquidado = await cerrar();

    expect(conDineroAfuera.status).toBe(409);
    expect(liquidado.status).toBe(200);
    // Base de $100.000 + $15.000 del domicilio: cuadra.
    expect(liquidado.body.arqueo.diferencia).toBe('0.00');
  });
});

describe('cambio de forma de pago', () => {
  it('contra entrega a anticipado antes de salir: borra el "paga con" y ya se cobra', async () => {
    const pedido = await domicilioListo(local, CONTRA_ENTREGA);

    const cambio = await llamar(
      'patch',
      `/pedidos/${pedido.id}/domicilio`,
      local.negocio.encabezados.cajero,
      { formaPago: 'anticipado' },
    );

    expect(cambio.body.entrega).toMatchObject({ formaPago: 'anticipado', pagaCon: null });
    expect((await cobrar(local, pedido.id)).status).toBe(200);
  });

  it('uno ya cobrado no pasa a contra entrega', async () => {
    const pedido = await domicilioListo(local, ANTICIPADO);
    await cobrar(local, pedido.id);

    const res = await llamar(
      'patch',
      `/pedidos/${pedido.id}/domicilio`,
      local.negocio.encabezados.cajero,
      { formaPago: 'contra_entrega' },
    );

    expect(res.body.error.code).toBe('DOMICILIO_YA_PAGADO');
  });

  it('después de salir ya no cambia', async () => {
    const pedido = await domicilioListo(local, CONTRA_ENTREGA);
    await despachar(local, pedido.id, 'Luis');

    const res = await llamar(
      'patch',
      `/pedidos/${pedido.id}/domicilio`,
      local.negocio.encabezados.cajero,
      { formaPago: 'anticipado' },
    );

    expect(res.body.error.code).toBe('DOMICILIO_DESPACHADO');
  });

  it('a uno de pago anticipado no se le pone "paga con"', async () => {
    const pedido = await domicilioListo(local, ANTICIPADO);

    const res = await llamar(
      'patch',
      `/pedidos/${pedido.id}/domicilio`,
      local.negocio.encabezados.cajero,
      { pagaCon: 20000 },
    );

    expect(res.body.error.code).toBe('PAGA_CON_SOLO_CONTRA_ENTREGA');
  });
});

describe('ubicación del cliente', () => {
  it('acepta enlaces de Google Maps y Waze, y nada más', async () => {
    /** @param {string} ubicacionUrl */
    const conUbicacion = (ubicacionUrl) =>
      llamar('post', '/pedidos', local.negocio.encabezados.cajero, {
        tipo: 'domicilio',
        nombreCliente: 'Juan',
        entrega: { ...ANTICIPADO, ubicacionUrl },
      });

    const validos = await Promise.all(
      [
        'https://maps.app.goo.gl/AbCdEf123',
        'https://maps.google.com/?q=3.6587,-76.2455',
        'https://www.google.com/maps/place/El+Cerrito',
        'https://waze.com/ul?ll=3.6587,-76.2455',
      ].map(conUbicacion),
    );
    const invalidos = await Promise.all(
      [
        'http://maps.google.com/?q=3.65,-76.24',
        'https://www.google.com/search?q=hamburguesas',
        'https://ejemplo.com/maps',
        'no es un enlace',
      ].map(conUbicacion),
    );

    expect(validos.map((res) => res.status)).toEqual([201, 201, 201, 201]);
    expect(validos[0].body.entrega.ubicacionUrl).toBe('https://maps.app.goo.gl/AbCdEf123');
    expect(invalidos.map((res) => res.status)).toEqual([400, 400, 400, 400]);
  });
});

describe('quitar el acceso', () => {
  it('ya no entra; si se le devuelve, entra de nuevo', async () => {
    const ruta = `/domiciliarios/${local.domiciliarios.Ana.id}/acceso`;

    const quitado = await llamar('delete', ruta, local.negocio.encabezados.dueno);
    const sinAcceso = await ingresar(local.nit, 'ana@812000001.test');
    const devuelto = await llamar('post', ruta, local.negocio.encabezados.dueno, {
      email: 'ana@812000001.test',
      contrasena: CONTRASENA,
    });
    const otraVez = await ingresar(local.nit, 'ana@812000001.test');

    expect(quitado.body.acceso).toEqual({ email: 'ana@812000001.test', activo: false });
    expect(sinAcceso.status).toBe(401);
    expect(devuelto.status).toBe(201);
    expect(otraVez.status).toBe(200);
  });
});
