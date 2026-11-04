// @ts-check
// Pruebas del cobro por Bre-B: el dueño guarda la llave y el contenido del QR de su banco,
// todos los roles los ven (la caja y los meseros los muestran), cada formato de llave se
// valida y se normaliza, los cambios quedan en la auditoría y un negocio no ve los de otro.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { crearNegocioDePrueba } from './ayudantes.js';

const app = createApp();

/** Contenido de un QR de pago (formato EMVCo, el que usan los QR de los bancos). */
const QR_DEL_BANCO =
  '00020101021126360014CO.COM.BREB.LLA0112@laindustria5204581253031705802CO5912La Industria6004Cali6304AB12';

/** @type {import('./ayudantes.js').NegocioDePrueba} */
let negocio;
/** @type {import('./ayudantes.js').NegocioDePrueba} */
let otroNegocio;

/**
 * @param {string} encabezado
 * @param {Record<string, unknown>} cuerpo
 */
function configurar(encabezado, cuerpo) {
  return request(app).patch('/negocios/actual').set('Authorization', encabezado).send(cuerpo);
}

beforeAll(async () => {
  negocio = await crearNegocioDePrueba('811000001');
  otroNegocio = await crearNegocioDePrueba('811000002');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('cobro por Bre-B', () => {
  it('un negocio nuevo empieza sin llave ni QR', async () => {
    const res = await request(app)
      .get('/negocios/actual')
      .set('Authorization', negocio.encabezados.dueno);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ llaveBreB: null, qrBreB: null });
  });

  it('el dueño guarda la llave y el QR, y el mesero y la caja los ven', async () => {
    const res = await configurar(negocio.encabezados.dueno, {
      llaveBreB: '@laindustria',
      qrBreB: QR_DEL_BANCO,
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ llaveBreB: '@laindustria', qrBreB: QR_DEL_BANCO });

    for (const rol of /** @type {const} */ (['mesero', 'cajero'])) {
      const consulta = await request(app)
        .get('/negocios/actual')
        .set('Authorization', negocio.encabezados[rol]);
      expect(consulta.body).toMatchObject({ llaveBreB: '@laindustria', qrBreB: QR_DEL_BANCO });
    }
  });

  it.each([
    ['celular con espacios', '300 123 4567', '3001234567'],
    ['código de comercio', '0012345678', '0012345678'],
    ['documento con puntos', '1.234.567.890', '1234567890'],
    ['correo en mayúsculas', ' Pagos@LaIndustria.co ', 'pagos@laindustria.co'],
    ['llave que empieza por @', '@la.industria', '@la.industria'],
  ])('acepta un %s y lo guarda como lo registran los bancos', async (_tipo, escrita, guardada) => {
    const res = await configurar(negocio.encabezados.dueno, { llaveBreB: escrita });

    expect(res.status).toBe(200);
    expect(res.body.llaveBreB).toBe(guardada);
  });

  it.each([
    ['un texto sin formato de llave', 'laindustria'],
    ['una llave con espacios', '@la industria'],
    ['un @ sin nombre', '@'],
    ['un correo mal escrito', 'pagos@laindustria'],
  ])('rechaza %s', async (_caso, llave) => {
    const res = await configurar(negocio.encabezados.dueno, { llaveBreB: llave });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza un QR con saltos de línea o demasiado largo', async () => {
    const conSalto = await configurar(negocio.encabezados.dueno, {
      qrBreB: 'linea uno\nlinea dos',
    });
    const muyLargo = await configurar(negocio.encabezados.dueno, { qrBreB: '0'.repeat(513) });

    expect(conSalto.status).toBe(400);
    expect(muyLargo.status).toBe(400);
  });

  it('solo el dueño cambia la llave: es por donde entra la plata', async () => {
    for (const rol of /** @type {const} */ (['administrador', 'cajero', 'mesero'])) {
      const res = await configurar(negocio.encabezados[rol], { llaveBreB: '3009998877' });
      expect(res.status).toBe(403);
    }
  });

  it('cada cambio queda en la auditoría con el valor anterior', async () => {
    await configurar(negocio.encabezados.dueno, { llaveBreB: '@antes', qrBreB: QR_DEL_BANCO });
    await configurar(negocio.encabezados.dueno, { llaveBreB: '@ahora' });

    const res = await request(app)
      .get('/auditoria?accion=cambiar_cobro_bre_b')
      .set('Authorization', negocio.encabezados.dueno);

    expect(res.status).toBe(200);
    // El más reciente primero; el QR no cambió, así que no aparece en el detalle.
    expect(res.body[0].detalle).toEqual({ llaveAnterior: '@antes', llaveNueva: '@ahora' });
  });

  it('no audita nada si la llave y el QR quedan iguales', async () => {
    await configurar(negocio.encabezados.dueno, { llaveBreB: '@igual' });
    const antes = await request(app)
      .get('/auditoria?accion=cambiar_cobro_bre_b')
      .set('Authorization', negocio.encabezados.dueno);

    await configurar(negocio.encabezados.dueno, { llaveBreB: '@igual', pieRecibo: 'Gracias' });
    const despues = await request(app)
      .get('/auditoria?accion=cambiar_cobro_bre_b')
      .set('Authorization', negocio.encabezados.dueno);

    expect(despues.body).toHaveLength(antes.body.length);
  });

  it('null borra la llave y el QR', async () => {
    await configurar(negocio.encabezados.dueno, { llaveBreB: '@borrar', qrBreB: QR_DEL_BANCO });

    const res = await configurar(negocio.encabezados.dueno, { llaveBreB: null, qrBreB: null });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ llaveBreB: null, qrBreB: null });
  });

  it('un negocio no ve la llave de otro', async () => {
    await configurar(negocio.encabezados.dueno, { llaveBreB: '@solomia' });

    const res = await request(app)
      .get('/negocios/actual')
      .set('Authorization', otroNegocio.encabezados.dueno);

    expect(res.body.llaveBreB).toBeNull();
  });
});
