// @ts-check
// Crea la cuenta del administrador de Zenda en un negocio que ya existe (los que se
// registraron antes de que existiera el rol), o convierte en administrador de Zenda una cuenta
// que ya está en el negocio. Se conecta directo a la base porque ninguna cuenta puede crear
// este rol desde la app (ver src/config/roles.js).
//
// Uso, desde la carpeta backend:
//   node scripts/crear-administrador-zenda.js
//
// - Pide la URL de la base sin mostrarla (o usa la variable DATABASE_URL, si está definida) y
//   muestra solo el servidor y el nombre de la base, para confirmar dónde va a escribir. Sirve
//   la del usuario de la app (zenda_app) o la del dueño de la base: en las dos, Row-Level
//   Security limita el trabajo al negocio elegido.
// - Pide el NIT del negocio y el correo. Si el correo es nuevo en el negocio, pide el nombre y
//   la contraseña (sin mostrarla). Si ya tiene cuenta ahí, pregunta si la convierte: conserva
//   su contraseña y se le cierran las sesiones abiertas.
// - Pide confirmación antes de guardar, y el cambio queda en la auditoría del negocio.
// - Nunca imprime la URL completa ni contraseñas.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ACCIONES, registrarAuditoria } from '../src/lib/auditoria.js';
import { hashearContrasena } from '../src/lib/contrasenas.js';
import { esquemaContrasenaNueva } from '../src/lib/esquemas.js';
import { preguntar, preguntarOculto } from './terminal.js';

/** Para la auditoría: de dónde salió el cambio. */
const ORIGEN = 'scripts/crear-administrador-zenda.js';

const esquemaUrl = z.url({ protocol: /^postgres(ql)?$/ });
const esquemaNit = z.string().regex(/^\d{5,15}$/, 'el NIT lleva solo dígitos, sin puntos');
const esquemaCorreo = z.string().trim().toLowerCase().pipe(z.email('correo inválido'));
const esquemaNombre = z.string().trim().min(1, 'escribe el nombre').max(120);

/** @typedef {Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]} Transaccion */

/** Nombre legible de cada rol, para los mensajes. */
const NOMBRES_ROL = Object.freeze({
  administrador_zenda: 'administrador de Zenda',
  dueno: 'dueño',
  administrador: 'administrador',
  cajero: 'cajero',
  mesero: 'mesero',
  cocina: 'cocina',
  domiciliario: 'domiciliario',
});

/**
 * Valida un dato con su esquema; si no sirve, lanza el primer mensaje de error.
 * @template T
 * @param {z.ZodType<T>} esquema
 * @param {unknown} valor
 * @returns {T}
 */
function validar(esquema, valor) {
  const resultado = esquema.safeParse(valor);
  if (!resultado.success) throw new Error(resultado.error.issues[0].message);
  return resultado.data;
}

/**
 * Ejecuta `trabajo` como el negocio indicado, igual que la app (src/lib/negocio.js): en una
 * transacción con el negocio activo fijado, para que RLS solo deje ver y cambiar lo suyo.
 * @template T
 * @param {PrismaClient} prisma
 * @param {string} tenantId
 * @param {(tx: Transaccion) => Promise<T>} trabajo
 */
function comoNegocio(prisma, tenantId, trabajo) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return trabajo(tx);
  });
}

/** Pregunta la contraseña dos veces hasta que sea válida y coincida. */
async function preguntarContrasenaNueva() {
  for (;;) {
    const contrasena = await preguntarOculto('Contraseña (mínimo 8, con letras y números): ');
    const valida = esquemaContrasenaNueva.safeParse(contrasena);
    if (!valida.success) {
      console.log(`  La contraseña ${valida.error.issues[0].message}. Intenta otra.`);
      continue;
    }
    if ((await preguntarOculto('Repítela: ')) === contrasena) return contrasena;
    console.log('  No coinciden. Intenta de nuevo.');
  }
}

/**
 * @param {string} texto
 * @returns {Promise<boolean>}
 */
async function confirmar(texto) {
  return (await preguntar(`${texto} (s/n): `)).toLowerCase() === 's';
}

/**
 * Crea la cuenta nueva de administrador de Zenda en el negocio.
 * @param {PrismaClient} prisma
 * @param {{ id: string, nombre: string }} negocio
 * @param {string} email
 */
async function crearCuenta(prisma, negocio, email) {
  const nombre = validar(esquemaNombre, await preguntar('Tu nombre: '));
  const contrasena = await preguntarContrasenaNueva();
  if (!(await confirmar(`\n¿Crear la cuenta de ${nombre} (${email}) en ${negocio.nombre}?`))) {
    console.log('No se creó nada.');
    return;
  }

  // El hash va fuera de la transacción: argon2 es lento a propósito.
  const passwordHash = await hashearContrasena(contrasena);
  await comoNegocio(prisma, negocio.id, async (tx) => {
    const creada = await tx.usuario.create({
      data: { tenantId: negocio.id, nombre, email, passwordHash, rol: 'administrador_zenda' },
    });
    await registrarAuditoria(
      tx,
      { tenantId: negocio.id, usuarioId: creada.id, rol: 'administrador_zenda' },
      {
        accion: ACCIONES.CREAR_USUARIO,
        entidad: 'usuarios',
        entidadId: creada.id,
        detalle: { nombre, email, rol: 'administrador_zenda', origen: ORIGEN },
      },
    );
  });
  console.log(`\nListo: ${nombre} ya es administrador de Zenda en ${negocio.nombre}.`);
}

/**
 * Convierte en administrador de Zenda una cuenta que ya está en el negocio.
 * @param {PrismaClient} prisma
 * @param {{ id: string, nombre: string }} negocio
 * @param {{ id: string, nombre: string, rol: keyof typeof NOMBRES_ROL, activo: boolean }} cuenta
 */
async function convertirCuenta(prisma, negocio, cuenta) {
  // 1. Lo que no se convierte.
  if (cuenta.rol === 'administrador_zenda') {
    console.log('\nEsa cuenta ya es de administrador de Zenda: no hay nada que cambiar.');
    return;
  }
  if (cuenta.rol === 'domiciliario') {
    throw new Error('es la cuenta de un domiciliario. Usa otro correo');
  }

  // 2. Avisar si el negocio se queda sin dueño.
  console.log(
    `\nEse correo ya tiene cuenta en el negocio: ${cuenta.nombre} (${NOMBRES_ROL[cuenta.rol]}).`,
  );
  if (cuenta.rol === 'dueno') {
    const otrosDuenos = await comoNegocio(prisma, negocio.id, (tx) =>
      tx.usuario.count({ where: { rol: 'dueno', activo: true, id: { not: cuenta.id } } }),
    );
    if (otrosDuenos === 0) {
      console.log(
        'Es el único dueño: el negocio quedará sin dueño hasta que lo crees desde Usuarios.',
      );
    }
  }
  const pregunta =
    '¿Convertirla en administrador de Zenda? Conserva su contraseña y se cierran sus sesiones abiertas.';
  if (!(await confirmar(pregunta))) {
    console.log('No se cambió nada.');
    return;
  }

  // 3. Cambiar el rol (y activarla, si estaba inactiva), cerrar sus sesiones y auditarlo.
  await comoNegocio(prisma, negocio.id, async (tx) => {
    await tx.usuario.update({
      where: { id: cuenta.id },
      data: { rol: 'administrador_zenda', activo: true },
    });
    await tx.sesionUsuario.updateMany({
      where: { usuarioId: cuenta.id, revocadaEn: null },
      data: { revocadaEn: new Date() },
    });
    /** @type {Record<string, { antes: unknown, despues: unknown }>} */
    const cambios = { rol: { antes: cuenta.rol, despues: 'administrador_zenda' } };
    if (!cuenta.activo) cambios.activo = { antes: false, despues: true };
    await registrarAuditoria(
      tx,
      { tenantId: negocio.id, usuarioId: cuenta.id, rol: 'administrador_zenda' },
      {
        accion: ACCIONES.EDITAR_USUARIO,
        entidad: 'usuarios',
        entidadId: cuenta.id,
        detalle: { usuario: cuenta.nombre, cambios, origen: ORIGEN },
      },
    );
  });
  console.log(`\nListo: ${cuenta.nombre} ya es administrador de Zenda en ${negocio.nombre}.`);
  console.log('Vuelve a iniciar sesión en Zenda para entrar con el rol nuevo.');
}

/**
 * @param {string} url
 */
async function crearAdministradorZenda(url) {
  // 1. Conectarse y mostrar dónde (sin usuario ni contraseña).
  const { hostname, port, pathname } = new URL(validar(esquemaUrl, url));
  console.log(`Base: ${hostname}${port ? `:${port}` : ''}${pathname}`);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

  try {
    // 2. El negocio, por su NIT (el mismo con el que se inicia sesión).
    const nit = validar(esquemaNit, await preguntar('NIT del negocio (solo números): '));
    const negocio = await prisma.tenant.findUnique({
      where: { nit },
      select: { id: true, nombre: true },
    });
    if (!negocio) throw new Error(`no hay un negocio con el NIT ${nit}`);
    console.log(`Negocio: ${negocio.nombre}\n`);

    // 3. Crear la cuenta, o convertir la que ya tiene ese correo.
    const email = validar(esquemaCorreo, await preguntar('Tu correo: '));
    const existente = await comoNegocio(prisma, negocio.id, (tx) =>
      tx.usuario.findFirst({
        where: { email },
        select: { id: true, nombre: true, rol: true, activo: true },
      }),
    );
    if (existente) await convertirCuenta(prisma, negocio, existente);
    else await crearCuenta(prisma, negocio, email);
  } finally {
    await prisma.$disconnect();
  }
}

const url = process.env.DATABASE_URL || (await preguntarOculto('URL de la base: '));
try {
  await crearAdministradorZenda(url);
} catch (error) {
  // El mensaje nunca debe mostrar la URL ni su contraseña.
  let mensaje = error instanceof Error ? error.message : String(error);
  mensaje = mensaje.replaceAll(url, '[URL de la base]');
  const clave = URL.canParse(url) ? decodeURIComponent(new URL(url).password) : '';
  if (clave) mensaje = mensaje.replaceAll(clave, '***');
  console.error(`\nNo se pudo terminar: ${mensaje}`);
  process.exitCode = 1;
}
