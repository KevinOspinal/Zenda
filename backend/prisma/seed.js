// @ts-check
// Datos de ejemplo para desarrollo y para el demo.
//
// Crea dos negocios:
// - "La Industria": comidas rápidas con su menú real, usuarios de los 4 roles y 10 mesas.
// - "Cafetería El Trigal": negocio pequeño que sirve para comprobar el aislamiento entre negocios.
//
// Uso: npm run db:seed   (necesita SEED_CONTRASENA en el .env)
//
// Es seguro ejecutarlo varias veces: si un negocio ya existe (por su NIT), no lo toca.
// Los NIT, correos y documentos son ficticios.
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { hashearContrasena } from '../src/lib/contrasenas.js';
import { prisma } from '../src/lib/db.js';
import { conNegocio } from '../src/lib/negocio.js';
import { menuLaIndustria } from './datos/menuLaIndustria.js';

/** @typedef {import('../src/lib/negocio.js').TransaccionPrisma} TransaccionPrisma */
/** @typedef {import('./datos/menuLaIndustria.js').CategoriaMenu} CategoriaMenu */
/** @typedef {'dueno' | 'administrador' | 'cajero' | 'mesero'} Rol */

/**
 * @typedef {object} DatosNegocio
 * @property {string} nombre
 * @property {string} nit
 * @property {string} ciudad
 * @property {{ nombre: string, email: string, rol: Rol }[]} usuarios
 * @property {{ nombre: string, zona: string, capacidad: number }[]} mesas
 * @property {CategoriaMenu[]} menu
 */

/** @type {DatosNegocio} */
const LA_INDUSTRIA = {
  nombre: 'La Industria',
  nit: '900111222',
  ciudad: 'Cali',
  usuarios: [
    { nombre: 'Andrés Gómez', email: 'dueno@laindustria.test', rol: 'dueno' },
    { nombre: 'Paola Ríos', email: 'admin@laindustria.test', rol: 'administrador' },
    { nombre: 'Camilo Torres', email: 'cajero@laindustria.test', rol: 'cajero' },
    { nombre: 'Laura Pérez', email: 'laura@laindustria.test', rol: 'mesero' },
    { nombre: 'Juan Díaz', email: 'juan@laindustria.test', rol: 'mesero' },
  ],
  mesas: [
    ...Array.from({ length: 8 }, (_, i) => ({
      nombre: `Mesa ${i + 1}`,
      zona: 'Salón',
      capacidad: 4,
    })),
    { nombre: 'Terraza 1', zona: 'Terraza', capacidad: 6 },
    { nombre: 'Terraza 2', zona: 'Terraza', capacidad: 6 },
  ],
  menu: menuLaIndustria,
};

/** @type {DatosNegocio} */
const EL_TRIGAL = {
  nombre: 'Cafetería El Trigal',
  nit: '900333444',
  ciudad: 'Bogotá',
  usuarios: [{ nombre: 'Marta Rojas', email: 'dueno@eltrigal.test', rol: 'dueno' }],
  mesas: [{ nombre: 'Mesa 1', zona: 'Salón', capacidad: 4 }],
  menu: [
    {
      nombre: 'Bebidas calientes',
      productos: [
        { nombre: 'Tinto', precio: '2500' },
        { nombre: 'Café con leche', precio: '4000' },
      ],
    },
    {
      nombre: 'Panadería',
      productos: [
        { nombre: 'Pandebono', precio: '2500' },
        { nombre: 'Buñuelo', precio: '2500' },
      ],
    },
  ],
};

/** Clientes ficticios para facturar a nombre de alguien en el demo. */
const CLIENTES_DE_PRUEBA = [
  {
    tipoDocumento: /** @type {const} */ ('cc'),
    numeroDocumento: '1000000001',
    nombre: 'Cliente de Prueba Uno',
    email: 'cliente1@ejemplo.test',
  },
  {
    tipoDocumento: /** @type {const} */ ('nit'),
    numeroDocumento: '800000999',
    nombre: 'Empresa de Prueba S.A.S.',
    email: 'facturas@empresa.test',
  },
];

/**
 * Crea los negocios de ejemplo. Los que ya existen se dejan como están.
 * @param {{ contrasena: string }} opciones Contraseña que tendrán todos los usuarios de ejemplo.
 * @returns {Promise<{ nombre: string, creado: boolean }[]>} Qué negocios se crearon.
 */
export async function sembrarDatos({ contrasena }) {
  // El hash se calcula una vez: argon2 es lento a propósito.
  const passwordHash = await hashearContrasena(contrasena);

  const resultados = [];
  for (const negocio of [LA_INDUSTRIA, EL_TRIGAL]) {
    const creado = await crearNegocio(negocio, passwordHash);
    resultados.push({ nombre: negocio.nombre, creado });
  }
  return resultados;
}

/**
 * Crea un negocio con todos sus datos en una sola transacción: si algo falla, no queda nada a medias.
 * @param {DatosNegocio} datos
 * @param {string} passwordHash
 * @returns {Promise<boolean>} false si el negocio ya existía.
 */
async function crearNegocio(datos, passwordHash) {
  // 1. Si ya existe un negocio con ese NIT, no se toca.
  const existente = await prisma.tenant.findUnique({ where: { nit: datos.nit } });
  if (existente) return false;

  // 2. El id se genera aquí porque hay que fijar el negocio activo antes de crearlo (RLS).
  const tenantId = randomUUID();

  await conNegocio(tenantId, async (tx) => {
    await tx.tenant.create({
      data: { id: tenantId, nombre: datos.nombre, nit: datos.nit, ciudad: datos.ciudad },
    });

    // 3. Usuarios, mesas y clientes.
    await tx.usuario.createMany({
      data: datos.usuarios.map((usuario) => ({ ...usuario, tenantId, passwordHash })),
    });
    await tx.mesa.createMany({ data: datos.mesas.map((mesa) => ({ ...mesa, tenantId })) });
    await tx.cliente.createMany({
      data: CLIENTES_DE_PRUEBA.map((cliente) => ({ ...cliente, tenantId })),
    });

    // 4. Menú: categorías en el orden de la carta y sus productos.
    await crearMenu(tx, tenantId, datos.menu);
  });

  return true;
}

/**
 * Crea las categorías y productos del menú, y el inventario inicial de los que lo controlan.
 * @param {TransaccionPrisma} tx
 * @param {string} tenantId
 * @param {CategoriaMenu[]} menu
 */
async function crearMenu(tx, tenantId, menu) {
  for (const [orden, categoria] of menu.entries()) {
    const { id: categoriaId } = await tx.categoria.create({
      data: { tenantId, nombre: categoria.nombre, orden },
    });

    for (const producto of categoria.productos) {
      const creado = await tx.producto.create({
        data: {
          tenantId,
          categoriaId,
          nombre: producto.nombre,
          descripcion: producto.descripcion,
          precio: producto.precio,
          // Restaurante independiente: todo el consumo paga INC del 8 % (ver src/config/impuestos.js).
          tipoImpuesto: 'impoconsumo',
          controlaStock: producto.controlaStock ?? false,
          stock: producto.stock ?? '0',
        },
      });

      // El stock inicial se registra como una compra, para que el inventario cuadre
      // con la suma de sus movimientos.
      if (producto.controlaStock && producto.stock) {
        await tx.movimientoInventario.create({
          data: { tenantId, productoId: creado.id, tipo: 'compra', cantidad: producto.stock },
        });
      }
    }
  }
}

// ───────────────────────────── Ejecución desde la terminal ─────────────────────────────

/** Solo se ejecuta al correr `npm run db:seed`, no al importar el archivo en las pruebas. */
async function ejecutarDesdeTerminal() {
  const contrasena = z
    .string({ error: 'Falta SEED_CONTRASENA en el .env' })
    .min(8, 'SEED_CONTRASENA debe tener al menos 8 caracteres')
    .parse(process.env.SEED_CONTRASENA);

  const resultados = await sembrarDatos({ contrasena });

  for (const { nombre, creado } of resultados) {
    console.log(creado ? `✔ Creado: ${nombre}` : `• Ya existía, no se modificó: ${nombre}`);
  }
  console.log('\nUsuarios de La Industria (NIT 900111222), contraseña = SEED_CONTRASENA:');
  for (const usuario of LA_INDUSTRIA.usuarios) {
    console.log(`  ${usuario.rol.padEnd(14)} ${usuario.email}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await ejecutarDesdeTerminal();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
