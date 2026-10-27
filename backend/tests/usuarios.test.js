// @ts-check
// Pruebas de la gestión de usuarios: crear empleados, permisos, cambio de rol y
// desactivación (que cierran sesiones), protección de la cuenta del dueño,
// restablecer y cambiar contraseña, auditoría y aislamiento entre negocios.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { conNegocio } from '../src/lib/negocio.js';
import { crearNegocioDePrueba } from './ayudantes.js';

const app = createApp();
const NIT = '780000001';
const CONTRASENA = 'Inicial2026';

/** @type {import('./ayudantes.js').NegocioDePrueba} */
let negocio;
/** @type {import('./ayudantes.js').NegocioDePrueba} */
let otroNegocio;

beforeAll(async () => {
  negocio = await crearNegocioDePrueba(NIT);
  otroNegocio = await crearNegocioDePrueba('780000002');
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * Petición autenticada con el rol indicado.
 * @param {'get' | 'post' | 'patch'} metodo
 * @param {string} ruta
 * @param {'dueno' | 'administrador' | 'cajero' | 'mesero'} rol
 * @param {Record<string, unknown>} [cuerpo]
 */
function llamar(metodo, ruta, rol, cuerpo) {
  const peticion = request(app)[metodo](ruta).set('Authorization', negocio.encabezados[rol]);
  return cuerpo ? peticion.send(cuerpo) : peticion;
}

/**
 * @param {string} email
 * @param {string} [password]
 */
function login(email, password = CONTRASENA) {
  return request(app).post('/auth/login').send({ nit: NIT, email, password });
}

/**
 * Crea un empleado como dueño.
 * @param {string} email
 * @param {'administrador' | 'cajero' | 'mesero'} rol
 */
async function crearEmpleado(email, rol = 'mesero') {
  const res = await llamar('post', '/usuarios', 'dueno', {
    nombre: `Empleado ${email}`,
    email,
    rol,
    contrasena: CONTRASENA,
  });
  return res.body;
}

describe('crear y consultar empleados', () => {
  it('el dueño crea un empleado que ya puede iniciar sesión', async () => {
    const res = await llamar('post', '/usuarios', 'dueno', {
      nombre: 'Sofía Martínez',
      email: 'Sofia@Negocio.TEST',
      rol: 'mesero',
      contrasena: CONTRASENA,
    });
    const sesion = await login('sofia@negocio.test');

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      nombre: 'Sofía Martínez',
      email: 'sofia@negocio.test',
      rol: 'mesero',
      activo: true,
      bloqueado: false,
    });
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(sesion.status).toBe(200);
  });

  it('valida la contraseña, el rol y el correo repetido', async () => {
    const corta = await llamar('post', '/usuarios', 'dueno', {
      nombre: 'X',
      email: 'x@negocio.test',
      rol: 'mesero',
      contrasena: 'abc12',
    });
    const sinNumeros = await llamar('post', '/usuarios', 'dueno', {
      nombre: 'X',
      email: 'x@negocio.test',
      rol: 'mesero',
      contrasena: 'soloLetras',
    });
    const otroDueno = await llamar('post', '/usuarios', 'dueno', {
      nombre: 'X',
      email: 'x@negocio.test',
      rol: 'dueno',
      contrasena: CONTRASENA,
    });
    const repetido = await llamar('post', '/usuarios', 'dueno', {
      nombre: 'Otra Sofía',
      email: 'sofia@negocio.test',
      rol: 'cajero',
      contrasena: CONTRASENA,
    });

    expect(corta.status).toBe(400);
    expect(sinNumeros.status).toBe(400);
    expect(otroDueno.status).toBe(400);
    expect(repetido.status).toBe(409);
  });

  it('el administrador consulta pero no crea; cajero y mesero no acceden', async () => {
    const lista = await llamar('get', '/usuarios', 'administrador');
    const crear = await llamar('post', '/usuarios', 'administrador', {
      nombre: 'X',
      email: 'y@negocio.test',
      rol: 'mesero',
      contrasena: CONTRASENA,
    });
    const cajero = await llamar('get', '/usuarios', 'cajero');
    const mesero = await llamar('get', '/usuarios', 'mesero');

    expect(lista.status).toBe(200);
    expect(lista.body.every((/** @type {object} */ u) => !('passwordHash' in u))).toBe(true);
    expect(crear.status).toBe(403);
    expect(cajero.status).toBe(403);
    expect(mesero.status).toBe(403);
  });

  it('crear un empleado queda en la auditoría', async () => {
    const empleado = await crearEmpleado('auditado@negocio.test');
    const registro = await conNegocio(negocio.tenantId, (tx) =>
      tx.auditoria.findFirst({ where: { accion: 'crear_usuario', entidadId: empleado.id } }),
    );

    expect(registro?.detalle).toMatchObject({ email: 'auditado@negocio.test', rol: 'mesero' });
  });
});

describe('editar, cambiar rol y desactivar', () => {
  it('cambiar el rol cierra las sesiones del empleado y queda auditado con antes y después', async () => {
    const empleado = await crearEmpleado('ascenso@negocio.test', 'mesero');
    const { body: sesion } = await login('ascenso@negocio.test');

    const res = await llamar('patch', `/usuarios/${empleado.id}`, 'dueno', { rol: 'cajero' });
    const renovar = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: sesion.refreshToken });
    const registro = await conNegocio(negocio.tenantId, (tx) =>
      tx.auditoria.findFirst({ where: { accion: 'editar_usuario', entidadId: empleado.id } }),
    );

    expect(res.status).toBe(200);
    expect(res.body.rol).toBe('cajero');
    expect(renovar.status).toBe(401);
    expect(registro?.detalle).toMatchObject({
      cambios: { rol: { antes: 'mesero', despues: 'cajero' } },
    });
  });

  it('un empleado desactivado no puede iniciar sesión; al reactivarlo sí', async () => {
    const empleado = await crearEmpleado('retirado@negocio.test');

    await llamar('patch', `/usuarios/${empleado.id}`, 'dueno', { activo: false });
    const desactivado = await login('retirado@negocio.test');
    await llamar('patch', `/usuarios/${empleado.id}`, 'dueno', { activo: true });
    const reactivado = await login('retirado@negocio.test');

    expect(desactivado.status).toBe(401);
    expect(reactivado.status).toBe(200);
  });

  it('la cuenta del dueño no se puede desactivar ni cambiar de rol', async () => {
    const desactivar = await llamar('patch', `/usuarios/${negocio.usuarios.dueno}`, 'dueno', {
      activo: false,
    });
    const cambiarRol = await llamar('patch', `/usuarios/${negocio.usuarios.dueno}`, 'dueno', {
      rol: 'mesero',
    });
    const cambiarNombre = await llamar('patch', `/usuarios/${negocio.usuarios.dueno}`, 'dueno', {
      nombre: 'Andrés Gómez',
    });

    expect(desactivar.status).toBe(422);
    expect(desactivar.body.error.code).toBe('DUENO_PROTEGIDO');
    expect(cambiarRol.status).toBe(422);
    expect(cambiarNombre.status).toBe(200);
  });

  it('no se pueden ver ni editar empleados de otro negocio', async () => {
    const ver = await llamar('get', `/usuarios/${otroNegocio.usuarios.cajero}`, 'dueno');
    const editar = await llamar('patch', `/usuarios/${otroNegocio.usuarios.cajero}`, 'dueno', {
      activo: false,
    });

    expect(ver.status).toBe(404);
    expect(editar.status).toBe(404);
  });
});

describe('contraseñas', () => {
  it('el dueño restablece la contraseña: quita el bloqueo, cierra sesiones y la nueva funciona', async () => {
    const empleado = await crearEmpleado('olvido@negocio.test');
    const { body: sesion } = await login('olvido@negocio.test');
    for (let intento = 0; intento < 5; intento++) await login('olvido@negocio.test', 'mala1234');

    const bloqueado = await llamar('get', `/usuarios/${empleado.id}`, 'dueno');
    const res = await llamar('post', `/usuarios/${empleado.id}/restablecer-contrasena`, 'dueno', {
      contrasenaNueva: 'Nueva2026',
    });
    const conVieja = await login('olvido@negocio.test');
    const conNueva = await login('olvido@negocio.test', 'Nueva2026');
    const renovar = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: sesion.refreshToken });

    expect(bloqueado.body.bloqueado).toBe(true);
    expect(res.status).toBe(204);
    expect(conVieja.status).toBe(401);
    expect(conNueva.status).toBe(200);
    expect(renovar.status).toBe(401);
  });

  it('cada usuario cambia su propia contraseña y recibe una sesión nueva', async () => {
    await crearEmpleado('propia@negocio.test');
    const { body: sesion } = await login('propia@negocio.test');
    const autorizacion = `Bearer ${sesion.tokenAcceso}`;

    const incorrecta = await request(app)
      .post('/auth/cambiar-contrasena')
      .set('Authorization', autorizacion)
      .send({ contrasenaActual: 'equivocada1', contrasenaNueva: 'MiClave2026' });
    const repetida = await request(app)
      .post('/auth/cambiar-contrasena')
      .set('Authorization', autorizacion)
      .send({ contrasenaActual: CONTRASENA, contrasenaNueva: CONTRASENA });
    const cambio = await request(app)
      .post('/auth/cambiar-contrasena')
      .set('Authorization', autorizacion)
      .send({ contrasenaActual: CONTRASENA, contrasenaNueva: 'MiClave2026' });

    const refreshViejo = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: sesion.refreshToken });
    const refreshNuevo = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: cambio.body.refreshToken });

    expect(incorrecta.status).toBe(401);
    expect(incorrecta.body.error.code).toBe('CONTRASENA_INCORRECTA');
    expect(repetida.status).toBe(422);
    expect(cambio.status).toBe(200);
    expect(cambio.body.tokenAcceso).toEqual(expect.any(String));
    expect((await login('propia@negocio.test')).status).toBe(401);
    expect((await login('propia@negocio.test', 'MiClave2026')).status).toBe(200);
    // Las sesiones anteriores se cerraron; la nueva funciona.
    expect(refreshViejo.status).toBe(401);
    expect(refreshNuevo.status).toBe(200);
  });
});
