// @ts-check
// Pruebas de lo que ve y puede hacer cada rol. Los permisos deben coincidir con el backend.
import { describe, expect, it } from 'vitest';
import { inicioDe, puede, seccionesDe } from '../../app/utils/roles.js';

/** @param {import('../../app/utils/roles.js').Rol} rol */
const idsDeSecciones = (rol) => seccionesDe(rol).map((seccion) => seccion.id);

describe('secciones por rol', () => {
  it('el mesero ve solo lo de tomar pedidos', () => {
    expect(idsDeSecciones('mesero')).toEqual(['mesas', 'pedidos', 'avisos', 'perfil']);
  });

  it('el cajero ve la caja, las mesas, el mostrador y los clientes', () => {
    expect(idsDeSecciones('cajero')).toEqual(['caja', 'mesas', 'mostrador', 'clientes', 'perfil']);
  });

  it('solo el dueño ve configuración y auditoría', () => {
    expect(idsDeSecciones('dueno')).toContain('configuracion');
    expect(idsDeSecciones('dueno')).toContain('auditoria');
    expect(idsDeSecciones('administrador')).not.toContain('configuracion');
    expect(idsDeSecciones('administrador')).not.toContain('auditoria');
  });

  it('todos los roles tienen perfil', () => {
    for (const rol of /** @type {const} */ (['dueno', 'administrador', 'cajero', 'mesero'])) {
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

  it('el administrador anula, pero no gestiona usuarios ni configura el negocio', () => {
    expect(puede('administrador', 'anularPedidos')).toBe(true);
    expect(puede('administrador', 'verUsuarios')).toBe(true);
    expect(puede('administrador', 'gestionarUsuarios')).toBe(false);
    expect(puede('administrador', 'configurarNegocio')).toBe(false);
  });

  it('sin rol (sin sesión) no se puede nada', () => {
    expect(puede(null, 'tomarPedidos')).toBe(false);
  });
});
