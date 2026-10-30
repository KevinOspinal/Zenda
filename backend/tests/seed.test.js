// @ts-check
// Pruebas del seed: crea los negocios de ejemplo completos, no duplica datos al
// ejecutarse de nuevo, respeta el aislamiento y su menú se puede vender sin errores.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { menuLaIndustria } from '../prisma/datos/menuLaIndustria.js';
import { sembrarDatos } from '../prisma/seed.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { conNegocio } from '../src/lib/negocio.js';
import { calcularLinea, obtenerTasaImpuesto } from '../src/modules/pedidos/calculoImpuestos.js';

const CONTRASENA = 'Contrasena-de-prueba-1';
const totalProductosMenu = menuLaIndustria.reduce((total, c) => total + c.productos.length, 0);

/** @type {{ id: string }} */
let laIndustria;
/** @type {{ id: string }} */
let elTrigal;

beforeAll(async () => {
  await sembrarDatos({ contrasena: CONTRASENA });
  laIndustria = await prisma.tenant.findUniqueOrThrow({ where: { nit: '900111222' } });
  elTrigal = await prisma.tenant.findUniqueOrThrow({ where: { nit: '900333444' } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('seed de datos de ejemplo', () => {
  it('crea La Industria con su menú, usuarios de todos los roles y mesas', async () => {
    const conteos = await conNegocio(laIndustria.id, async (tx) => ({
      categorias: await tx.categoria.count(),
      productos: await tx.producto.count(),
      mesas: await tx.mesa.count(),
      roles: (await tx.usuario.findMany({ distinct: ['rol'], select: { rol: true } }))
        .map((usuario) => usuario.rol)
        .sort(),
    }));

    expect(conteos).toEqual({
      categorias: menuLaIndustria.length,
      productos: totalProductosMenu,
      mesas: 10,
      roles: ['administrador', 'cajero', 'cocina', 'domiciliario', 'dueno', 'mesero'],
    });
  });

  it('el domiciliario con acceso queda vinculado a su usuario', async () => {
    const pedro = await conNegocio(laIndustria.id, (tx) =>
      tx.domiciliario.findFirstOrThrow({
        where: { nombre: 'Pedro Gómez' },
        include: { usuario: { select: { email: true, rol: true } } },
      }),
    );

    expect(pedro.usuario).toEqual({ email: 'pedro@laindustria.test', rol: 'domiciliario' });
  });

  it('no duplica nada si se ejecuta otra vez', async () => {
    const resultados = await sembrarDatos({ contrasena: CONTRASENA });
    const productos = await conNegocio(laIndustria.id, (tx) => tx.producto.count());

    expect(resultados.every((r) => !r.creado)).toBe(true);
    expect(productos).toBe(totalProductosMenu);
  });

  it('cada negocio solo ve su propio menú', async () => {
    const productosTrigal = await conNegocio(elTrigal.id, (tx) =>
      tx.producto.findMany({ select: { nombre: true } }),
    );

    expect(productosTrigal.map((p) => p.nombre).sort()).toEqual([
      'Buñuelo',
      'Café con leche',
      'Pandebono',
      'Tinto',
    ]);
  });

  it('el inventario inicial de las bebidas cuadra con sus movimientos', async () => {
    const bebidas = await conNegocio(laIndustria.id, (tx) =>
      tx.producto.findMany({ where: { controlaStock: true }, include: { movimientos: true } }),
    );

    expect(bebidas.length).toBeGreaterThan(0);
    for (const bebida of bebidas) {
      const sumaMovimientos = bebida.movimientos.reduce(
        (total, m) => total.plus(m.cantidad),
        bebida.stock.minus(bebida.stock),
      );
      expect(sumaMovimientos.equals(bebida.stock)).toBe(true);
    }
  });

  it('todo el menú se puede vender: precios válidos e impuesto según el régimen', async () => {
    const productos = await conNegocio(laIndustria.id, (tx) => tx.producto.findMany());

    for (const producto of productos) {
      const tasa = obtenerTasaImpuesto('responsable_inc', producto.tipoImpuesto);
      const linea = calcularLinea({
        precioConImpuesto: producto.precio,
        cantidad: '1',
        tasaImpuesto: tasa,
      });

      expect(producto.precio.greaterThan(0)).toBe(true);
      expect(linea.totalAPagar.equals(producto.precio)).toBe(true);
    }
  });

  it('los usuarios del seed pueden iniciar sesión', async () => {
    const res = await request(createApp())
      .post('/auth/login')
      .send({ nit: '900111222', email: 'cajero@laindustria.test', password: CONTRASENA });

    expect(res.status).toBe(200);
    expect(res.body.usuario.rol).toBe('cajero');
  });
});
