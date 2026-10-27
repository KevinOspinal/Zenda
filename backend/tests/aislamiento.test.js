// @ts-check
// Prueba obligatoria de aislamiento entre negocios: un negocio nunca puede leer
// ni modificar datos de otro, aunque el código olvide filtrar por tenant_id.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/db.js';
import { conNegocio } from '../src/lib/negocio.js';

/** @type {{ id: string }} */
let negocioA;
/** @type {{ id: string }} */
let negocioB;
/** @type {{ id: string }} */
let mesaDeB;

beforeAll(async () => {
  // La tabla tenants no tiene RLS: se crea el negocio antes de saber cuál es el activo.
  negocioA = await prisma.tenant.create({ data: { nombre: 'Café A', nit: '900000001' } });
  negocioB = await prisma.tenant.create({ data: { nombre: 'Café B', nit: '900000002' } });

  // Ambos negocios tienen una mesa con el mismo nombre: los nombres son únicos por negocio.
  await conNegocio(negocioA.id, (tx) =>
    tx.mesa.create({ data: { tenantId: negocioA.id, nombre: 'Mesa 1', capacidad: 4 } }),
  );
  mesaDeB = await conNegocio(negocioB.id, (tx) =>
    tx.mesa.create({ data: { tenantId: negocioB.id, nombre: 'Mesa 1', capacidad: 2 } }),
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('aislamiento entre negocios (RLS)', () => {
  it('un negocio solo ve sus propias filas', async () => {
    const mesas = await conNegocio(negocioA.id, (tx) => tx.mesa.findMany());

    expect(mesas).toHaveLength(1);
    expect(mesas[0].tenantId).toBe(negocioA.id);
  });

  it('no puede leer una fila de otro negocio aunque conozca su id', async () => {
    const mesa = await conNegocio(negocioA.id, (tx) =>
      tx.mesa.findUnique({ where: { id: mesaDeB.id } }),
    );

    expect(mesa).toBeNull();
  });

  it('no puede modificar ni borrar filas de otro negocio', async () => {
    const actualizadas = await conNegocio(negocioA.id, (tx) =>
      tx.mesa.updateMany({ where: { id: mesaDeB.id }, data: { nombre: 'Hackeada' } }),
    );
    const borradas = await conNegocio(negocioA.id, (tx) =>
      tx.mesa.deleteMany({ where: { id: mesaDeB.id } }),
    );

    expect(actualizadas.count).toBe(0);
    expect(borradas.count).toBe(0);

    // La mesa de B sigue intacta.
    const mesa = await conNegocio(negocioB.id, (tx) =>
      tx.mesa.findUnique({ where: { id: mesaDeB.id } }),
    );
    expect(mesa?.nombre).toBe('Mesa 1');
  });

  it('no puede crear filas a nombre de otro negocio', async () => {
    const intento = conNegocio(negocioA.id, (tx) =>
      tx.mesa.create({ data: { tenantId: negocioB.id, nombre: 'Intrusa', capacidad: 2 } }),
    );

    await expect(intento).rejects.toThrow(/row-level security/);
  });

  it('sin negocio activo no se ve ninguna fila', async () => {
    const mesas = await prisma.mesa.findMany();

    expect(mesas).toHaveLength(0);
  });

  it('el negocio activo no se filtra a la siguiente consulta de la misma conexión', async () => {
    await conNegocio(negocioA.id, (tx) => tx.mesa.findMany());
    const despues = await prisma.mesa.findMany();

    expect(despues).toHaveLength(0);
  });

  it('rechaza un id de negocio que no es UUID', async () => {
    await expect(conNegocio('1 OR 1=1', (tx) => tx.mesa.findMany())).rejects.toThrow();
  });
});

describe('configuración de seguridad de la base', () => {
  it('toda tabla con tenant_id tiene RLS activado y forzado', async () => {
    // Si alguien crea una tabla nueva y olvida agregarla a rls.sql, esta prueba falla.
    /** @type {{ tabla: string, rls: boolean, forzado: boolean }[]} */
    const tablas = await prisma.$queryRaw`
      SELECT c.relname AS tabla, c.relrowsecurity AS rls, c.relforcerowsecurity AS forzado
      FROM pg_class c
      JOIN information_schema.columns col
        ON col.table_name = c.relname AND col.table_schema = 'public'
      WHERE col.column_name = 'tenant_id' AND c.relkind = 'r'
    `;

    expect(tablas.length).toBeGreaterThanOrEqual(15);
    const sinProteccion = tablas.filter((t) => !t.rls || !t.forzado).map((t) => t.tabla);
    expect(sinProteccion).toEqual([]);
  });

  it('la app no se conecta como superusuario ni puede saltarse RLS', async () => {
    /** @type {{ superusuario: boolean, saltaRls: boolean }[]} */
    const [rol] = await prisma.$queryRaw`
      SELECT rolsuper AS superusuario, rolbypassrls AS "saltaRls"
      FROM pg_roles WHERE rolname = current_user
    `;

    expect(rol).toEqual({ superusuario: false, saltaRls: false });
  });

  it('la auditoría solo admite inserciones', async () => {
    const registro = await conNegocio(negocioA.id, (tx) =>
      tx.auditoria.create({
        data: { tenantId: negocioA.id, accion: 'prueba', entidad: 'mesas' },
      }),
    );

    const editar = conNegocio(negocioA.id, (tx) =>
      tx.auditoria.update({ where: { id: registro.id }, data: { accion: 'alterada' } }),
    );
    const borrar = conNegocio(negocioA.id, (tx) =>
      tx.auditoria.delete({ where: { id: registro.id } }),
    );

    await expect(editar).rejects.toThrow(/permission denied/);
    await expect(borrar).rejects.toThrow(/permission denied/);
  });
});
