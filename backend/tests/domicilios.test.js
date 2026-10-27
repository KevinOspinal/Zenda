// @ts-check
// Pruebas de los tipos de pedido y los domicilios:
// - Número del día, tipo (mesa, mostrador, domicilio) y origen de cada pedido.
// - Domicilio: valor por defecto de $3.000 que suma al total, editable mientras no se cobre;
//   sus datos de entrega solo los ve la caja (Ley 1581).
// - Despachar con un domiciliario, cobrar contra entrega y marcar entregado.
// - Domiciliarios, configuración del valor por defecto y reportes por tipo y origen.
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
const ids = { hamburguesa: '', gaseosa: '', domiciliario: '' };
let mesasCreadas = 0;

const ENTREGA = Object.freeze({
  telefono: '3109876543',
  direccion: 'Calle 10 # 5-20, barrio San Antonio',
  indicaciones: 'Apto 302, timbre dañado',
  pagaCon: '50000',
});

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
 * Registra un domicilio de una hamburguesa ($12.000) como lo hace la caja.
 * @param {Record<string, unknown>} [cambios]
 */
async function crearDomicilio(cambios = {}) {
  const res = await llamar('post', '/pedidos', negocio.encabezados.cajero, {
    tipo: 'domicilio',
    origen: 'whatsapp',
    nombreCliente: 'Juan',
    entrega: ENTREGA,
    items: [{ productoId: ids.hamburguesa, cantidad: 1 }],
    ...cambios,
  });
  expect(res.status).toBe(201);
  return res.body;
}

/**
 * Un domicilio enviado a cocina que la cocina ya tiene listo: el único que se puede despachar.
 * @param {Record<string, unknown>} [cambios]
 */
async function domicilioListoParaSalir(cambios = {}) {
  const pedido = await crearDomicilio(cambios);
  await llamar('post', `/pedidos/${pedido.id}/enviar-cocina`, negocio.encabezados.cajero);
  const listo = await llamar('patch', `/pedidos/${pedido.id}/cocina`, negocio.encabezados.cocina, {
    estadoCocina: 'listo',
  });
  expect(listo.status).toBe(200);
  return pedido;
}

/**
 * @param {string} pedidoId
 * @param {string} monto
 */
function cobrar(pedidoId, monto) {
  return llamar('post', `/pedidos/${pedidoId}/cobrar`, negocio.encabezados.cajero, {
    pagos: [{ metodo: 'efectivo', monto }],
  });
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

/** Fecha de hoy en Colombia (YYYY-MM-DD), la que usan los reportes. */
const hoyEnColombia = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

beforeAll(async () => {
  negocio = await crearNegocioDePrueba('809000001');
  otroNegocio = await crearNegocioDePrueba('809000002');

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

  const domiciliario = await llamar('post', '/domiciliarios', negocio.encabezados.dueno, {
    nombre: 'Pedro Gómez',
    telefono: '3001234567',
  });
  ids.domiciliario = domiciliario.body.id;

  await llamar('post', '/caja/abrir', negocio.encabezados.cajero, { montoInicial: 100000 });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('número del día y tipo de pedido', () => {
  it('cada pedido recibe el siguiente número del día; el tipo sale de la mesa', async () => {
    const primero = await llamar('post', '/pedidos', negocio.encabezados.cajero, { items: [] });
    const segundo = await llamar('post', '/pedidos', negocio.encabezados.mesero, {
      mesaId: await nuevaMesa(),
    });

    expect(primero.body.tipo).toBe('mostrador');
    expect(segundo.body.tipo).toBe('mesa');
    expect(segundo.body.numero).toBe(primero.body.numero + 1);
  });

  it('el número vuelve a 1 al día siguiente', async () => {
    // Se simula que el último número se dio ayer.
    await conNegocio(negocio.tenantId, (tx) =>
      tx.contadorPedidos.updateMany({ data: { fecha: new Date('2000-01-01') } }),
    );

    const res = await llamar('post', '/pedidos', negocio.encabezados.cajero, { items: [] });

    expect(res.body.numero).toBe(1);
  });

  it('en mostrador guarda el origen y el nombre con el que se llama al cliente', async () => {
    const res = await llamar('post', '/pedidos', negocio.encabezados.cajero, {
      origen: 'whatsapp',
      nombreCliente: 'Ana',
      items: [{ productoId: ids.gaseosa, cantidad: 1 }],
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ tipo: 'mostrador', origen: 'whatsapp', nombreCliente: 'Ana' });
    expect(res.body.valorDomicilio).toBe('0');
  });

  it('valida que cada tipo traiga sus datos', async () => {
    const casos = [
      { tipo: 'mesa' },
      { tipo: 'mostrador', mesaId: await nuevaMesa() },
      { tipo: 'domicilio', nombreCliente: 'Juan' },
      { tipo: 'domicilio', entrega: ENTREGA },
      { tipo: 'mostrador', valorDomicilio: 3000 },
      { tipo: 'mostrador', entrega: ENTREGA },
    ];
    for (const cuerpo of casos) {
      const res = await llamar('post', '/pedidos', negocio.encabezados.cajero, cuerpo);
      expect(res.status, JSON.stringify(cuerpo)).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('domicilios', () => {
  it('suman $3.000 al total por defecto, sin impuesto y sin propina sugerida', async () => {
    const pedido = await crearDomicilio();

    // Hamburguesa: base $11.111,11 + INC $888,89 = $12.000; más $3.000 de domicilio.
    expect(pedido).toMatchObject({
      tipo: 'domicilio',
      origen: 'whatsapp',
      nombreCliente: 'Juan',
      valorDomicilio: '3000',
      subtotal: '14111.11',
      impuestos: '888.89',
      total: '15000',
      propinaSugerida: '0.00',
    });
    expect(pedido.entrega).toMatchObject({
      telefono: ENTREGA.telefono,
      direccion: ENTREGA.direccion,
      pagaCon: '50000',
      despachadoEn: null,
      entregadoEn: null,
    });
  });

  it('el valor se cambia al registrarlo y después, mientras no se cobre', async () => {
    const pedido = await crearDomicilio({ valorDomicilio: 5000 });
    expect(pedido.total).toBe('17000');

    const lejos = await llamar(
      'patch',
      `/pedidos/${pedido.id}/domicilio`,
      negocio.encabezados.cajero,
      {
        valorDomicilio: 6000,
        indicaciones: null,
      },
    );
    expect(lejos.body.total).toBe('18000');
    expect(lejos.body.entrega.indicaciones).toBeNull();

    await cobrar(pedido.id, '18000');
    const tarde = await llamar(
      'patch',
      `/pedidos/${pedido.id}/domicilio`,
      negocio.encabezados.cajero,
      {
        valorDomicilio: 3000,
      },
    );
    expect(tarde.status).toBe(409);
    expect(tarde.body.error.code).toBe('PEDIDO_CERRADO');

    // La dirección sí se puede corregir hasta que se entregue.
    const direccion = await llamar(
      'patch',
      `/pedidos/${pedido.id}/domicilio`,
      negocio.encabezados.cajero,
      { direccion: 'Carrera 4 # 8-15' },
    );
    expect(direccion.status).toBe(200);
  });

  it('el mesero no registra domicilios ni ve sus datos de entrega', async () => {
    const intento = await llamar('post', '/pedidos', negocio.encabezados.mesero, {
      tipo: 'domicilio',
      nombreCliente: 'Juan',
      entrega: ENTREGA,
    });
    expect(intento.status).toBe(403);

    const pedido = await crearDomicilio();
    const delMesero = await llamar('get', `/pedidos/${pedido.id}`, negocio.encabezados.mesero);
    expect(delMesero.status).toBe(200);
    expect(delMesero.body).not.toHaveProperty('entrega');
    expect(JSON.stringify(delMesero.body)).not.toContain(ENTREGA.telefono);

    const lista = await llamar('get', '/pedidos?activos=true', negocio.encabezados.cocina);
    expect(JSON.stringify(lista.body)).not.toContain(ENTREGA.direccion);

    const domicilios = await llamar('get', '/pedidos?domicilios=true', negocio.encabezados.mesero);
    expect(domicilios.status).toBe(403);
  });

  it('al despacharlo sale con el domiciliario y sus platos salen de la cocina', async () => {
    const pedido = await domicilioListoParaSalir();

    const res = await llamar(
      'post',
      `/pedidos/${pedido.id}/despachar`,
      negocio.encabezados.cajero,
      {
        domiciliarioId: ids.domiciliario,
      },
    );

    expect(res.status).toBe(200);
    expect(res.body.entrega.despachadoEn).toEqual(expect.any(String));
    expect(res.body.entrega.domiciliario).toMatchObject({ nombre: 'Pedro Gómez' });
    expect(res.body.items.every((/** @type {any} */ i) => i.estadoCocina === 'entregado')).toBe(
      true,
    );
    const cocina = await llamar('get', '/pedidos?cocina=true', negocio.encabezados.cocina);
    expect(cocina.body.map((/** @type {any} */ p) => p.id)).not.toContain(pedido.id);

    const otraVez = await llamar(
      'post',
      `/pedidos/${pedido.id}/despachar`,
      negocio.encabezados.cajero,
      { domiciliarioId: ids.domiciliario },
    );
    expect(otraVez.status).toBe(409);
    expect(otraVez.body.error.code).toBe('DOMICILIO_DESPACHADO');
  });

  it('no sale con un domiciliario inactivo ni con uno de otro negocio', async () => {
    const inactivo = await llamar('post', '/domiciliarios', negocio.encabezados.dueno, {
      nombre: 'Luis Prado',
      telefono: '3011112233',
    });
    await llamar('patch', `/domiciliarios/${inactivo.body.id}`, negocio.encabezados.dueno, {
      activo: false,
    });
    const ajeno = await llamar('post', '/domiciliarios', otroNegocio.encabezados.dueno, {
      nombre: 'Ajeno',
      telefono: '3020000000',
    });
    const pedido = await domicilioListoParaSalir();

    const conInactivo = await llamar(
      'post',
      `/pedidos/${pedido.id}/despachar`,
      negocio.encabezados.cajero,
      { domiciliarioId: inactivo.body.id },
    );
    const conAjeno = await llamar(
      'post',
      `/pedidos/${pedido.id}/despachar`,
      negocio.encabezados.cajero,
      { domiciliarioId: ajeno.body.id },
    );

    expect(conInactivo.status).toBe(409);
    expect(conInactivo.body.error.code).toBe('DOMICILIARIO_INACTIVO');
    expect(conAjeno.status).toBe(404);
  });

  it('contra entrega: se cobra cuando vuelve el domiciliario y luego se marca entregado', async () => {
    const pedido = await crearDomicilio();
    const entregar = () =>
      llamar('post', `/pedidos/${pedido.id}/entregar`, negocio.encabezados.cajero);
    const enCurso = async () => {
      const res = await llamar('get', '/pedidos?domicilios=true', negocio.encabezados.cajero);
      return res.body.map((/** @type {any} */ p) => p.id);
    };

    // Sin salir no se puede entregar.
    const antes = await entregar();
    expect(antes.status).toBe(409);
    expect(antes.body.error.code).toBe('DOMICILIO_SIN_DESPACHAR');

    await llamar('post', `/pedidos/${pedido.id}/enviar-cocina`, negocio.encabezados.cajero);
    await llamar('patch', `/pedidos/${pedido.id}/cocina`, negocio.encabezados.cocina, {
      estadoCocina: 'listo',
    });
    await llamar('post', `/pedidos/${pedido.id}/despachar`, negocio.encabezados.cajero, {
      domiciliarioId: ids.domiciliario,
    });
    expect(await enCurso()).toContain(pedido.id);

    expect((await cobrar(pedido.id, '15000')).status).toBe(200);
    const entregado = await entregar();

    expect(entregado.status).toBe(200);
    expect(entregado.body.entrega.entregadoEn).toEqual(expect.any(String));
    expect(await enCurso()).not.toContain(pedido.id);
  });

  it('solo sale cuando la cocina lo tiene listo', async () => {
    const pedido = await crearDomicilio();
    const despachar = () =>
      llamar('post', `/pedidos/${pedido.id}/despachar`, negocio.encabezados.cajero, {
        domiciliarioId: ids.domiciliario,
      });

    const sinEnviar = await despachar();
    expect(sinEnviar.status).toBe(409);
    expect(sinEnviar.body.error.code).toBe('DOMICILIO_SIN_ENVIAR');

    await llamar('post', `/pedidos/${pedido.id}/enviar-cocina`, negocio.encabezados.cajero);
    const enPreparacion = await despachar();
    expect(enPreparacion.status).toBe(409);
    expect(enPreparacion.body.error.code).toBe('DOMICILIO_EN_PREPARACION');

    await llamar('patch', `/pedidos/${pedido.id}/cocina`, negocio.encabezados.cocina, {
      estadoCocina: 'listo',
    });
    expect((await despachar()).status).toBe(200);
  });

  it('uno cobrado antes de mandarlo a cocina se puede enviar después', async () => {
    const pedido = await crearDomicilio();
    await cobrar(pedido.id, '15000');

    const res = await llamar(
      'post',
      `/pedidos/${pedido.id}/enviar-cocina`,
      negocio.encabezados.cajero,
    );

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('pagado');
    expect(res.body.enviadoACocinaEn).toEqual(expect.any(String));
    const cocina = await llamar('get', '/pedidos?cocina=true', negocio.encabezados.cocina);
    expect(cocina.body.map((/** @type {any} */ p) => p.id)).toContain(pedido.id);
  });

  it('la cocina no lo marca entregado: sale cuando la caja lo despacha', async () => {
    const pedido = await crearDomicilio();
    await llamar('post', `/pedidos/${pedido.id}/enviar-cocina`, negocio.encabezados.cajero);
    const itemId = pedido.items[0].id;
    await llamar(
      'patch',
      `/pedidos/${pedido.id}/items/${itemId}/cocina`,
      negocio.encabezados.cocina,
      {
        estadoCocina: 'listo',
      },
    );

    const res = await llamar(
      'patch',
      `/pedidos/${pedido.id}/items/${itemId}/cocina`,
      negocio.encabezados.cocina,
      { estadoCocina: 'entregado' },
    );

    expect(res.status).toBe(403);
  });

  it('un domicilio no se divide', async () => {
    const pedido = await crearDomicilio();

    const res = await llamar('post', `/pedidos/${pedido.id}/dividir`, negocio.encabezados.cajero, {
      items: [{ itemId: pedido.items[0].id, cantidad: '1' }],
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DOMICILIO_NO_SE_DIVIDE');
  });

  it('el otro negocio no ve estos domicilios', async () => {
    const res = await llamar('get', '/pedidos?domicilios=true', otroNegocio.encabezados.cajero);

    expect(res.body).toEqual([]);
  });
});

describe('entregar pedidos sin mesa', () => {
  it('en mostrador, entregar saca de la cocina lo que quedaba', async () => {
    const creado = await llamar('post', '/pedidos', negocio.encabezados.cajero, {
      nombreCliente: 'Ana',
      items: [{ productoId: ids.hamburguesa, cantidad: 1 }],
    });
    await llamar('post', `/pedidos/${creado.body.id}/enviar-cocina`, negocio.encabezados.cajero);
    await cobrar(creado.body.id, '12000');

    const res = await llamar(
      'post',
      `/pedidos/${creado.body.id}/entregar`,
      negocio.encabezados.cajero,
    );

    expect(res.status).toBe(200);
    expect(res.body.items[0].estadoCocina).toBe('entregado');
    const cocina = await llamar('get', '/pedidos?cocina=true', negocio.encabezados.cocina);
    expect(cocina.body.map((/** @type {any} */ p) => p.id)).not.toContain(creado.body.id);
  });

  it('en una mesa no aplica: cada plato lo entrega el mesero', async () => {
    const creado = await llamar('post', '/pedidos', negocio.encabezados.mesero, {
      mesaId: await nuevaMesa(),
      items: [{ productoId: ids.gaseosa, cantidad: 1 }],
    });

    const res = await llamar(
      'post',
      `/pedidos/${creado.body.id}/entregar`,
      negocio.encabezados.cajero,
    );

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ENTREGA_EN_MESA');
  });
});

describe('domiciliarios', () => {
  it('los registra la gerencia; la caja los ve; el mesero no', async () => {
    const delCajero = await llamar('post', '/domiciliarios', negocio.encabezados.cajero, {
      nombre: 'No',
      telefono: '3000000000',
    });
    const lista = await llamar('get', '/domiciliarios', negocio.encabezados.cajero);
    const delMesero = await llamar('get', '/domiciliarios', negocio.encabezados.mesero);

    expect(delCajero.status).toBe(403);
    expect(lista.status).toBe(200);
    expect(lista.body.map((/** @type {any} */ d) => d.nombre)).toContain('Pedro Gómez');
    expect(delMesero.status).toBe(403);
  });

  it('se desactivan en lugar de borrarse; ?activos=true trae solo los activos', async () => {
    const creado = await llamar('post', '/domiciliarios', negocio.encabezados.administrador, {
      nombre: 'Marta Ruiz',
      telefono: '+57 312 555 0000',
    });
    await llamar('patch', `/domiciliarios/${creado.body.id}`, negocio.encabezados.administrador, {
      activo: false,
    });

    const todos = await llamar('get', '/domiciliarios', negocio.encabezados.cajero);
    const activos = await llamar('get', '/domiciliarios?activos=true', negocio.encabezados.cajero);

    expect(todos.body.map((/** @type {any} */ d) => d.id)).toContain(creado.body.id);
    expect(activos.body.map((/** @type {any} */ d) => d.id)).not.toContain(creado.body.id);
  });

  it('valida el teléfono', async () => {
    const res = await llamar('post', '/domiciliarios', negocio.encabezados.dueno, {
      nombre: 'Sin número',
      telefono: 'abc',
    });

    expect(res.status).toBe(400);
  });
});

describe('configuración y reportes', () => {
  it('el valor por defecto es $3.000 y el dueño lo cambia; queda en la auditoría', async () => {
    const antes = await llamar('get', '/negocios/actual', negocio.encabezados.dueno);
    expect(antes.body.valorDomicilio).toBe('3000');

    const cambio = await llamar('patch', '/negocios/actual', negocio.encabezados.dueno, {
      valorDomicilio: 3500,
    });
    expect(cambio.status).toBe(200);
    expect(cambio.body.valorDomicilio).toBe('3500');

    const pedido = await crearDomicilio();
    expect(pedido.valorDomicilio).toBe('3500');

    const auditoria = await llamar(
      'get',
      '/auditoria?accion=cambiar_valor_domicilio',
      negocio.encabezados.dueno,
    );
    expect(auditoria.body[0]).toMatchObject({ detalle: { anterior: '3000', nuevo: '3500' } });

    await llamar('patch', '/negocios/actual', negocio.encabezados.dueno, { valorDomicilio: 3000 });
  });

  it('el resumen de ventas dice cuánto vende cada tipo de pedido y cada origen', async () => {
    const pedido = await crearDomicilio();
    await cobrar(pedido.id, '15000');
    const hoy = hoyEnColombia();

    const res = await llamar(
      'get',
      `/reportes/resumen?desde=${hoy}&hasta=${hoy}`,
      negocio.encabezados.dueno,
    );

    expect(res.status).toBe(200);
    expect(res.body.porTipo.map((/** @type {any} */ f) => f.tipo)).toEqual([
      'mesa',
      'mostrador',
      'domicilio',
    ]);
    expect(res.body.porOrigen.map((/** @type {any} */ f) => f.origen)).toEqual([
      'local',
      'whatsapp',
      'telefono',
      'otro',
    ]);
    const domicilio = res.body.porTipo.find((/** @type {any} */ f) => f.tipo === 'domicilio');
    const whatsapp = res.body.porOrigen.find((/** @type {any} */ f) => f.origen === 'whatsapp');
    expect(domicilio.ventas).toBeGreaterThanOrEqual(1);
    expect(whatsapp.ventas).toBeGreaterThanOrEqual(1);
  });
});
