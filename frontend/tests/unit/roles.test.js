// @ts-check
// Pruebas de lo que ve y puede hacer cada rol. Los permisos deben coincidir con el backend.
import { describe, expect, it } from 'vitest';
import {
  PERMISOS,
  ROLES,
  SECCIONES,
  inicioDe,
  puede,
  redireccionNecesaria,
  seccionesDe,
} from '../../app/utils/roles.js';

/** @param {import('../../app/utils/roles.js').Rol} rol */
const idsDeSecciones = (rol) => seccionesDe(rol).map((seccion) => seccion.id);

describe('secciones por rol', () => {
  it('el mesero ve solo lo de tomar pedidos', () => {
    expect(idsDeSecciones('mesero')).toEqual(['mesas', 'pedidos', 'avisos', 'perfil']);
  });

  it('el cajero ve la caja, las mesas, el mostrador y los clientes', () => {
    expect(idsDeSecciones('cajero')).toEqual(['caja', 'mesas', 'mostrador', 'clientes', 'perfil']);
  });

  it('el dueño y el administrador de Zenda ven configuración y auditoría; el administrador no', () => {
    for (const rol of /** @type {const} */ (['administrador_zenda', 'dueno'])) {
      expect(idsDeSecciones(rol)).toContain('configuracion');
      expect(idsDeSecciones(rol)).toContain('auditoria');
    }
    expect(idsDeSecciones('administrador')).not.toContain('configuracion');
    expect(idsDeSecciones('administrador')).not.toContain('auditoria');
  });

  it('todos los roles tienen perfil', () => {
    for (const rol of /** @type {import('../../app/utils/roles.js').Rol[]} */ (
      Object.keys(ROLES)
    )) {
      expect(idsDeSecciones(rol)).toContain('perfil');
    }
  });
});

describe('inicio por rol', () => {
  it('cada rol empieza donde más trabaja', () => {
    expect(inicioDe('mesero')).toBe('/mesas');
    expect(inicioDe('cajero')).toBe('/caja');
    expect(inicioDe('administrador')).toBe('/reportes');
    expect(inicioDe('dueno')).toBe('/reportes');
    expect(inicioDe('administrador_zenda')).toBe('/reportes');
    expect(inicioDe('cocina')).toBe('/cocina');
    expect(inicioDe('domiciliario')).toBe('/entregas');
  });
});

describe('domiciliarios', () => {
  it('solo el administrador de Zenda los registra; los demás no ven la sección', () => {
    expect(idsDeSecciones('administrador_zenda')).toContain('domiciliarios');
    for (const rol of /** @type {const} */ (['dueno', 'administrador', 'cajero'])) {
      expect(idsDeSecciones(rol)).not.toContain('domiciliarios');
      expect(puede(rol, 'gestionarDomiciliarios')).toBe(false);
    }
  });
});

describe('el domiciliario', () => {
  it('solo ve sus entregas y su perfil, ni siquiera un pedido', () => {
    const entrar = (/** @type {string} */ ruta, /** @type {string} */ seccion) =>
      redireccionNecesaria({ ruta, seccion, rol: 'domiciliario' });

    expect(idsDeSecciones('domiciliario')).toEqual(['entregas', 'perfil']);
    expect(entrar('/entregas', 'entregas')).toBeNull();
    expect(entrar('/perfil', 'perfil')).toBeNull();
    expect(entrar('/caja', 'caja')).toBe('/entregas');
    expect(redireccionNecesaria({ ruta: '/pedidos/abc', rol: 'domiciliario' })).toBe('/entregas');
  });

  it('nadie más ve sus entregas', () => {
    expect(redireccionNecesaria({ ruta: '/entregas', seccion: 'entregas', rol: 'cajero' })).toBe(
      '/caja',
    );
  });

  it('el administrador de Zenda le da acceso a Zenda; la caja lo liquida', () => {
    expect(puede('administrador_zenda', 'darAccesoDomiciliarios')).toBe(true);
    expect(puede('dueno', 'darAccesoDomiciliarios')).toBe(false);
    expect(puede('administrador', 'darAccesoDomiciliarios')).toBe(false);
    expect(puede('dueno', 'liquidarDomiciliarios')).toBe(true);
    expect(puede('cajero', 'liquidarDomiciliarios')).toBe(true);
    expect(puede('domiciliario', 'cobrar')).toBe(false);
    expect(puede('domiciliario', 'tomarPedidos')).toBe(false);
  });
});

describe('la cuenta de la cocina', () => {
  it('no tiene navegación: su tablero no aparece en ella y solo le queda el perfil', () => {
    expect(idsDeSecciones('cocina')).toEqual(['perfil']);
    expect(idsDeSecciones('dueno')).not.toContain('cocina');
  });

  it('solo entra a su tablero y a su perfil, ni siquiera a un pedido', () => {
    const entrar = (/** @type {string} */ ruta, /** @type {string} */ seccion) =>
      redireccionNecesaria({ ruta, seccion, rol: 'cocina' });
    expect(entrar('/cocina', 'cocina')).toBeNull();
    expect(entrar('/perfil', 'perfil')).toBeNull();
    expect(entrar('/mesas', 'mesas')).toBe('/cocina');
    expect(redireccionNecesaria({ ruta: '/pedidos/abc', rol: 'cocina' })).toBe('/cocina');
  });

  it('marca los platos, pero no toma pedidos ni cobra', () => {
    expect(puede('cocina', 'prepararPlatos')).toBe(true);
    expect(puede('cocina', 'tomarPedidos')).toBe(false);
    expect(puede('cocina', 'cobrar')).toBe(false);
  });

  it('el mesero no usa la pantalla de cocina; el cajero sí (en cafeterías también prepara)', () => {
    expect(puede('mesero', 'prepararPlatos')).toBe(false);
    expect(redireccionNecesaria({ ruta: '/cocina', seccion: 'cocina', rol: 'mesero' })).toBe(
      '/mesas',
    );
    expect(puede('cajero', 'prepararPlatos')).toBe(true);
    expect(redireccionNecesaria({ ruta: '/cocina', seccion: 'cocina', rol: 'cajero' })).toBeNull();
  });
});

describe('permisos (iguales a los del backend)', () => {
  it('el mesero toma pedidos, pero no cobra ni anula', () => {
    expect(puede('mesero', 'tomarPedidos')).toBe(true);
    expect(puede('mesero', 'cobrar')).toBe(false);
    expect(puede('mesero', 'anularPedidos')).toBe(false);
  });

  it('el cajero cobra y maneja la caja, pero no anula ni ve reportes', () => {
    expect(puede('cajero', 'cobrar')).toBe(true);
    expect(puede('cajero', 'manejarCaja')).toBe(true);
    expect(puede('cajero', 'anularPedidos')).toBe(false);
    expect(puede('cajero', 'verReportes')).toBe(false);
  });

  it('el administrador anula, pero no ve los usuarios ni configura el negocio', () => {
    expect(puede('administrador', 'anularPedidos')).toBe(true);
    expect(puede('administrador', 'verUsuarios')).toBe(false);
    expect(puede('administrador', 'gestionarUsuarios')).toBe(false);
    expect(puede('administrador', 'configurarNegocio')).toBe(false);
  });

  it('el dueño configura el negocio y ve la auditoría, pero no la facturación ni los usuarios', () => {
    expect(puede('dueno', 'configurarNegocio')).toBe(true);
    expect(puede('dueno', 'verAuditoria')).toBe(true);
    expect(puede('dueno', 'configurarFacturacion')).toBe(false);
    expect(puede('dueno', 'verUsuarios')).toBe(false);
    expect(puede('dueno', 'gestionarUsuarios')).toBe(false);
  });

  it('sin rol (sin sesión) no se puede nada', () => {
    expect(puede(null, 'tomarPedidos')).toBe(false);
  });
});

describe('el administrador de Zenda', () => {
  it('puede todo lo que puede el dueño', () => {
    for (const [accion, roles] of Object.entries(PERMISOS)) {
      if (roles.includes('dueno')) expect(roles, accion).toContain('administrador_zenda');
    }
    for (const seccion of SECCIONES) {
      if (seccion.roles.includes('dueno')) {
        expect(seccion.roles, seccion.id).toContain('administrador_zenda');
      }
    }
  });

  it('es el único que maneja los usuarios, los domiciliarios y la facturación', () => {
    for (const accion of /** @type {const} */ ([
      'verUsuarios',
      'gestionarUsuarios',
      'gestionarDomiciliarios',
      'darAccesoDomiciliarios',
      'configurarFacturacion',
    ])) {
      expect(PERMISOS[accion], accion).toEqual(['administrador_zenda']);
    }
  });

  it('el dueño ya no entra a Usuarios ni a Domiciliarios', () => {
    expect(idsDeSecciones('administrador_zenda')).toContain('usuarios');
    expect(idsDeSecciones('dueno')).not.toContain('usuarios');
    expect(
      redireccionNecesaria({ ruta: '/admin/usuarios', seccion: 'usuarios', rol: 'dueno' }),
    ).toBe('/reportes');
    expect(
      redireccionNecesaria({
        ruta: '/admin/domiciliarios',
        seccion: 'domiciliarios',
        rol: 'dueno',
      }),
    ).toBe('/reportes');
  });
});

describe('redireccionNecesaria (quién entra a cada página)', () => {
  it('sin sesión, solo deja ver las páginas públicas', () => {
    expect(redireccionNecesaria({ ruta: '/caja', seccion: 'caja', rol: null })).toBe('/ingresar');
    expect(redireccionNecesaria({ ruta: '/ingresar', publica: true, rol: null })).toBeNull();
  });

  it('con sesión, el ingreso y la raíz llevan al inicio del rol', () => {
    expect(redireccionNecesaria({ ruta: '/ingresar', publica: true, rol: 'mesero' })).toBe(
      '/mesas',
    );
    expect(redireccionNecesaria({ ruta: '/', rol: 'cajero' })).toBe('/caja');
  });

  it('una sección de otro rol lleva al inicio del propio rol', () => {
    expect(redireccionNecesaria({ ruta: '/reportes', seccion: 'reportes', rol: 'mesero' })).toBe(
      '/mesas',
    );
    expect(
      redireccionNecesaria({
        ruta: '/admin/auditoria',
        seccion: 'auditoria',
        rol: 'administrador',
      }),
    ).toBe('/reportes');
  });

  it('deja entrar a las secciones del propio rol y a páginas sin sección', () => {
    expect(redireccionNecesaria({ ruta: '/caja', seccion: 'caja', rol: 'cajero' })).toBeNull();
    expect(redireccionNecesaria({ ruta: '/pedidos/abc', rol: 'mesero' })).toBeNull();
  });
});
