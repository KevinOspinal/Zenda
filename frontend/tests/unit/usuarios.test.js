// @ts-check
// Pruebas de la lógica de la pantalla de usuarios: el estado de cada cuenta (y el bloqueo que
// se vence solo), los contadores, el orden por rol, la búsqueda, las pantallas de cada rol,
// qué se puede hacer con cada cuenta y los avatares sin foto.
import { describe, expect, it } from 'vitest';
import { inicialesDe, tonoDeTexto } from '../../app/utils/avatares.js';
import { TONOS_DE_CATEGORIA } from '../../app/utils/categorias.js';
import {
  coincideCuenta,
  compararCuentas,
  conteoDeCuentas,
  conteoPorRol,
  estadoDeCuenta,
  finDelBloqueo,
  pantallasDeRol,
  permisosSobreCuenta,
} from '../../app/utils/usuarios.js';

const AHORA = new Date('2026-11-16T20:00:00Z');
const EN_10_MIN = '2026-11-16T20:10:00Z';
const HACE_5_MIN = '2026-11-16T19:55:00Z';

/**
 * @param {Partial<import('../../app/utils/usuarios.js').Cuenta>} datos
 * @returns {import('../../app/utils/usuarios.js').Cuenta}
 */
const cuenta = (datos) => ({
  id: 'u1',
  nombre: 'Laura',
  email: 'laura@x.test',
  rol: 'mesero',
  activo: true,
  bloqueado: false,
  bloqueadoHasta: null,
  ...datos,
});

describe('estado de una cuenta', () => {
  it('inactiva, bloqueada por intentos fallidos o activa', () => {
    expect(estadoDeCuenta(cuenta({ activo: false, bloqueado: true }), AHORA)).toBe('inactivo');
    expect(estadoDeCuenta(cuenta({ bloqueado: true, bloqueadoHasta: EN_10_MIN }), AHORA)).toBe(
      'bloqueado',
    );
    expect(estadoDeCuenta(cuenta({}), AHORA)).toBe('activo');
  });

  it('el bloqueo se vence solo con el tiempo, aunque el backend lo haya dicho antes', () => {
    const bloqueada = cuenta({ bloqueado: true, bloqueadoHasta: HACE_5_MIN });
    expect(estadoDeCuenta(bloqueada, AHORA)).toBe('activo');
    expect(finDelBloqueo(bloqueada, AHORA)).toBeNull();
    expect(finDelBloqueo(cuenta({ bloqueado: true, bloqueadoHasta: EN_10_MIN }), AHORA)).toEqual(
      new Date(EN_10_MIN),
    );
  });

  it('sin la hora del fin, se cree lo que dijo el backend', () => {
    expect(estadoDeCuenta(cuenta({ bloqueado: true }), AHORA)).toBe('bloqueado');
  });

  it('cuenta cuántas hay en cada estado', () => {
    const cuentas = [
      cuenta({ id: 'a' }),
      cuenta({ id: 'b' }),
      cuenta({ id: 'c', bloqueado: true, bloqueadoHasta: EN_10_MIN }),
      cuenta({ id: 'd', activo: false }),
    ];
    expect(conteoDeCuentas(cuentas, AHORA)).toEqual({ activo: 2, bloqueado: 1, inactivo: 1 });
  });
});

describe('orden por rol y búsqueda', () => {
  const cuentas = [
    cuenta({ id: 'a', nombre: 'Pedro', rol: 'mesero', activo: false }),
    cuenta({ id: 'b', nombre: 'Ana', rol: 'mesero' }),
    cuenta({ id: 'c', nombre: 'Marta Ruiz', email: 'marta@laindustria.test', rol: 'dueno' }),
    cuenta({ id: 'd', nombre: 'Óscar', rol: 'mesero' }),
  ];

  it('ordena por rol; dentro de cada rol, primero los activos y por nombre', () => {
    expect([...cuentas].sort(compararCuentas).map((c) => c.nombre)).toEqual([
      'Marta Ruiz',
      'Ana',
      'Óscar',
      'Pedro',
    ]);
  });

  it('cuenta las personas de cada rol, solo de los roles que tienen alguna', () => {
    expect(conteoPorRol(cuentas)).toEqual([
      { rol: 'dueno', cantidad: 1 },
      { rol: 'mesero', cantidad: 3 },
    ]);
  });

  it('busca por nombre o por correo', () => {
    expect(coincideCuenta(cuentas[2], 'ruiz')).toBe(true);
    expect(coincideCuenta(cuentas[2], 'laindustria')).toBe(true);
    expect(coincideCuenta(cuentas[2], 'pedro')).toBe(false);
  });
});

describe('pantallasDeRol', () => {
  it('dice a qué pantallas entra cada rol, sin Perfil', () => {
    expect(pantallasDeRol('mesero').map((p) => p.etiqueta)).toEqual(['Mesas', 'Pedidos', 'Avisos']);
    // La pantalla de la cocina se abre por otro camino, pero es la de su rol.
    expect(pantallasDeRol('cocina').map((p) => p.etiqueta)).toEqual(['Cocina']);
  });
});

describe('permisosSobreCuenta', () => {
  const contexto = { idPropia: 'yo', duenosActivos: 2 };

  it('con la cuenta propia no hace nada aquí: se maneja en Perfil', () => {
    expect(permisosSobreCuenta(cuenta({ id: 'yo' }), contexto)).toEqual({
      editar: false,
      restablecer: false,
      cambiarAcceso: false,
      motivo: 'propia',
    });
  });

  it('a un domiciliario solo le restablece la contraseña', () => {
    expect(permisosSobreCuenta(cuenta({ rol: 'domiciliario' }), contexto)).toMatchObject({
      editar: false,
      restablecer: true,
      cambiarAcceso: false,
      motivo: 'domiciliario',
    });
  });

  it('no le quita el acceso a otra cuenta de Zenda ni al único dueño activo', () => {
    expect(permisosSobreCuenta(cuenta({ rol: 'administrador_zenda' }), contexto)).toMatchObject({
      editar: true,
      cambiarAcceso: false,
      motivo: 'zenda',
    });
    const dueno = cuenta({ rol: 'dueno' });
    expect(permisosSobreCuenta(dueno, { idPropia: 'yo', duenosActivos: 1 })).toMatchObject({
      cambiarAcceso: false,
      motivo: 'unico_dueno',
    });
    expect(permisosSobreCuenta(dueno, contexto).cambiarAcceso).toBe(true);
    // Un dueño inactivo sí se puede activar, aunque haya otro activo.
    const inactivo = cuenta({ rol: 'dueno', activo: false });
    expect(permisosSobreCuenta(inactivo, { idPropia: 'yo', duenosActivos: 1 }).cambiarAcceso).toBe(
      true,
    );
  });

  it('con las demás cuentas hace todo', () => {
    expect(permisosSobreCuenta(cuenta({}), contexto)).toEqual({
      editar: true,
      restablecer: true,
      cambiarAcceso: true,
      motivo: null,
    });
  });
});

describe('avatares sin foto', () => {
  it('toma las iniciales de las dos primeras palabras', () => {
    expect(inicialesDe('Marta Ruiz')).toBe('MR');
    expect(inicialesDe('  ángela   maría pérez ')).toBe('ÁM');
    expect(inicialesDe('Andrés')).toBe('A');
    expect(inicialesDe('(Cocina) Turno 2')).toBe('T2');
    expect(inicialesDe('')).toBe('');
  });

  it('el mismo texto siempre tiene el mismo tono, y los tonos se reparten', () => {
    expect(tonoDeTexto('cliente-1')).toBe(tonoDeTexto('cliente-1'));
    const tonos = new Set(Array.from({ length: 40 }, (_, i) => tonoDeTexto(`cliente-${i}`)));
    expect(tonos.size).toBeGreaterThan(TONOS_DE_CATEGORIA.length / 2);
  });
});
