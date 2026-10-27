// @ts-check
// Pruebas del menú: categorías, productos, permisos por rol, validaciones de impuesto,
// aislamiento entre negocios y auditoría de cambios de precio.
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

beforeAll(async () => {
  negocio = await crearNegocioDePrueba('700000001');
  otroNegocio = await crearNegocioDePrueba('700000002');

  const res = await request(app)
    .post('/categorias')
    .set('Authorization', negocio.encabezados.administrador)
    .send({ nombre: 'Hamburguesas', orden: 1 });
  categoriaId = res.body.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * Crea un producto como administrador.
 * @param {Record<string, unknown>} datos
 */
function crearProducto(datos) {
  return request(app)
    .post('/productos')
    .set('Authorization', negocio.encabezados.administrador)
    .send({ categoriaId, tipoImpuesto: 'impoconsumo', ...datos });
}

describe('categorías', () => {
  it('el administrador crea categorías y todos los roles las consultan', async () => {
    const res = await request(app)
      .get('/categorias')
      .set('Authorization', negocio.encabezados.mesero);

    expect(res.status).toBe(200);
    expect(res.body.map((/** @type {{ nombre: string }} */ c) => c.nombre)).toContain(
      'Hamburguesas',
    );
  });

  it('el mesero no puede crear categorías', async () => {
    const res = await request(app)
      .post('/categorias')
      .set('Authorization', negocio.encabezados.mesero)
      .send({ nombre: 'Postres' });

    expect(res.status).toBe(403);
  });

  it('una categoría con productos no se puede eliminar; una vacía sí', async () => {
    await crearProducto({ nombre: 'Producto que la ocupa', precio: 1000 });
    const ocupada = await request(app)
      .delete(`/categorias/${categoriaId}`)
      .set('Authorization', negocio.encabezados.dueno);

    const { body: vacia } = await request(app)
      .post('/categorias')
      .set('Authorization', negocio.encabezados.dueno)
      .send({ nombre: 'Temporal' });
    const eliminada = await request(app)
      .delete(`/categorias/${vacia.id}`)
      .set('Authorization', negocio.encabezados.dueno);

    expect(ocupada.status).toBe(409);
    expect(ocupada.body.error.code).toBe('EN_USO');
    expect(eliminada.status).toBe(204);
  });
});

describe('productos', () => {
  it('crea un producto con precio exacto en pesos', async () => {
    const res = await crearProducto({
      nombre: 'IND Classic Artesanal',
      descripcion: 'Carne artesanal',
      precio: '12000',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nombre: 'IND Classic Artesanal', activo: true });
    // El dinero viaja como texto para no perder precisión.
    expect(res.body.precio).toBe('12000');
  });

  it('rechaza precios con separador de miles, negativos o con más de 2 decimales', async () => {
    for (const precio of ['12.000', -500, '100.123', 'doce mil']) {
      const res = await crearProducto({ nombre: 'Mal precio', precio });
      expect(res.status).toBe(400);
    }
  });

  it('rechaza IVA en un negocio responsable del INC', async () => {
    const res = await crearProducto({ nombre: 'Con IVA', precio: 5000, tipoImpuesto: 'iva' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('IMPUESTO_NO_PERMITIDO');
  });

  it('no permite usar una categoría de otro negocio', async () => {
    const { body: categoriaAjena } = await request(app)
      .post('/categorias')
      .set('Authorization', otroNegocio.encabezados.dueno)
      .send({ nombre: 'Ajena' });

    const res = await crearProducto({
      nombre: 'Intruso',
      precio: 1000,
      categoriaId: categoriaAjena.id,
    });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CATEGORIA_NO_ENCONTRADA');
  });

  it('no permite ver ni editar productos de otro negocio', async () => {
    const { body: producto } = await crearProducto({ nombre: 'Privado', precio: 3000 });

    const ver = await request(app)
      .get(`/productos/${producto.id}`)
      .set('Authorization', otroNegocio.encabezados.dueno);
    const editar = await request(app)
      .patch(`/productos/${producto.id}`)
      .set('Authorization', otroNegocio.encabezados.dueno)
      .send({ precio: 1 });

    expect(ver.status).toBe(404);
    expect(editar.status).toBe(404);
  });

  it('un cambio de precio queda en la auditoría con el valor anterior y el nuevo', async () => {
    const { body: producto } = await crearProducto({ nombre: 'IND Bacon', precio: 14000 });

    const res = await request(app)
      .patch(`/productos/${producto.id}`)
      .set('Authorization', negocio.encabezados.dueno)
      .send({ precio: 15000 });

    const registros = await conNegocio(negocio.tenantId, (tx) =>
      tx.auditoria.findMany({ where: { entidadId: producto.id } }),
    );

    expect(res.status).toBe(200);
    expect(res.body.precio).toBe('15000');
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({
      accion: 'cambiar_precio',
      detalle: { producto: 'IND Bacon', precioAnterior: '14000.00', precioNuevo: '15000.00' },
    });
  });

  it('editar otros campos sin cambiar el precio no genera auditoría', async () => {
    const { body: producto } = await crearProducto({ nombre: 'Perro Clasic', precio: 15000 });

    await request(app)
      .patch(`/productos/${producto.id}`)
      .set('Authorization', negocio.encabezados.dueno)
      .send({ descripcion: 'Con papas', precio: '15000.00' });

    const registros = await conNegocio(negocio.tenantId, (tx) =>
      tx.auditoria.count({ where: { entidadId: producto.id } }),
    );
    expect(registros).toBe(0);
  });

  it('un PATCH vacío se rechaza', async () => {
    const { body: producto } = await crearProducto({ nombre: 'Vacío', precio: 1000 });
    const res = await request(app)
      .patch(`/productos/${producto.id}`)
      .set('Authorization', negocio.encabezados.dueno)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('GET /menu', () => {
  it('muestra solo los productos activos, agrupados por categoría', async () => {
    const { body: producto } = await crearProducto({ nombre: 'Agotado', precio: 2000 });
    await request(app)
      .patch(`/productos/${producto.id}`)
      .set('Authorization', negocio.encabezados.administrador)
      .send({ activo: false });

    const menu = await request(app).get('/menu').set('Authorization', negocio.encabezados.mesero);
    const todos = await request(app)
      .get('/productos?activo=false')
      .set('Authorization', negocio.encabezados.mesero);

    /** @type {{ productos: { nombre: string }[] }[]} */
    const categorias = menu.body;
    const nombresEnMenu = categorias.flatMap((c) => c.productos.map((p) => p.nombre));

    expect(menu.status).toBe(200);
    expect(nombresEnMenu).toContain('IND Classic Artesanal');
    expect(nombresEnMenu).not.toContain('Agotado');
    expect(todos.body.map((/** @type {{ nombre: string }} */ p) => p.nombre)).toEqual(['Agotado']);
  });

  it('sin token responde 401', async () => {
    const res = await request(app).get('/menu');

    expect(res.status).toBe(401);
  });
});
