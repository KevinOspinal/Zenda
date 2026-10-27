// @ts-check
// Pruebas de la apariencia de los estados: mesas, cocina, urgencia y arqueo.
import { describe, expect, it } from 'vitest';
import {
  ESTADOS_COCINA,
  ESTADOS_MESA,
  ESTADOS_PEDIDO,
  METODOS_PAGO,
  aparienciaDeArqueo,
  estadoVisualDeMesa,
  urgenciaDeEspera,
} from '../../app/utils/estados.js';

const ESPACIO_FIJO = '\u00a0';

describe('tablas de estados', () => {
  it('cubre todos los estados que envía el API', () => {
    expect(Object.keys(ESTADOS_COCINA)).toEqual(['pendiente', 'preparando', 'listo', 'entregado']);
    expect(Object.keys(ESTADOS_PEDIDO)).toEqual([
      'abierto',
      'enviado_a_cocina',
      'pagado',
      'anulado',
    ]);
    expect(Object.keys(METODOS_PAGO)).toEqual(['efectivo', 'tarjeta', 'transferencia', 'otro']);
  });

  it('todo estado tiene etiqueta e ícono además del color (accesibilidad)', () => {
    const todas = [ESTADOS_MESA, ESTADOS_COCINA, ESTADOS_PEDIDO, METODOS_PAGO].flatMap((tabla) =>
      Object.values(tabla),
    );
    for (const apariencia of todas) {
      expect(apariencia.etiqueta).not.toBe('');
      expect(apariencia.icono).toMatch(/^i-lucide-/);
    }
  });
});

describe('estadoVisualDeMesa', () => {
  it('resalta la mesa ocupada que tiene platos listos', () => {
    expect(estadoVisualDeMesa('ocupada', true)).toBe('con_platos_listos');
    expect(estadoVisualDeMesa('ocupada', false)).toBe('ocupada');
    expect(estadoVisualDeMesa('libre')).toBe('libre');
  });
});

describe('urgenciaDeEspera', () => {
  it('menos de 10 min es normal', () => {
    expect(urgenciaDeEspera(9)).toMatchObject({ nivel: 'normal', late: false });
  });

  it('de 10 a 20 min pide atención', () => {
    expect(urgenciaDeEspera(10)).toMatchObject({ nivel: 'atencion', color: 'warning' });
    expect(urgenciaDeEspera(20)).toMatchObject({ nivel: 'atencion' });
  });

  it('más de 20 min es urgente y la tarjeta late', () => {
    expect(urgenciaDeEspera(21)).toMatchObject({ nivel: 'urgente', color: 'error', late: true });
  });
});

describe('aparienciaDeArqueo', () => {
  it('diferencia cero: la caja cuadra', () => {
    expect(aparienciaDeArqueo('0.00')).toMatchObject({ tipo: 'cuadra', color: 'success' });
  });

  it('diferencia positiva: sobra dinero', () => {
    expect(aparienciaDeArqueo('2000')).toMatchObject({
      tipo: 'sobrante',
      etiqueta: `Sobran $${ESPACIO_FIJO}2.000`,
    });
  });

  it('diferencia negativa: falta dinero (se muestra en positivo)', () => {
    expect(aparienciaDeArqueo('-500.00')).toMatchObject({
      tipo: 'faltante',
      etiqueta: `Faltan $${ESPACIO_FIJO}500`,
      color: 'error',
    });
  });
});
