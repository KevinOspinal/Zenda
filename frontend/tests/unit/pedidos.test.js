// @ts-check
// Pruebas de cómo se nombra y se reconoce un pedido según su tipo.
import { describe, expect, it } from 'vitest';
import {
  ORIGENES_PEDIDO,
  TIPOS_PEDIDO,
  nombreDelPedido,
  pasosDelPedido,
  tipoDelPedido,
} from '../../app/utils/pedidos.js';

describe('nombreDelPedido', () => {
  it('un pedido de mesa se llama como su mesa', () => {
    expect(nombreDelPedido({ tipo: 'mesa', mesa: { nombre: 'Mesa 4' }, numero: 7 })).toBe('Mesa 4');
  });

  it('sin mesa: el número del día y el nombre del cliente', () => {
    expect(nombreDelPedido({ tipo: 'domicilio', numero: 15, nombreCliente: 'Juan' })).toBe(
      '#15 · Juan',
    );
  });

  it('sin nombre del cliente: el número y el tipo', () => {
    expect(nombreDelPedido({ tipo: 'mostrador', numero: 16, nombreCliente: null })).toBe(
      '#16 · Mostrador',
    );
  });

  it('sin número (datos anteriores): solo el tipo', () => {
    expect(nombreDelPedido({ mesa: null })).toBe('Mostrador');
  });
});

describe('tipoDelPedido', () => {
  it('usa el tipo del API y, si no viene, lo deduce de la mesa', () => {
    expect(tipoDelPedido({ tipo: 'domicilio' })).toBe('domicilio');
    expect(tipoDelPedido({ mesa: { nombre: 'Mesa 1' } })).toBe('mesa');
    expect(tipoDelPedido({ mesa: null })).toBe('mostrador');
  });
});

describe('tablas de tipos y orígenes', () => {
  it('cubren los valores del API, con etiqueta e ícono', () => {
    expect(Object.keys(TIPOS_PEDIDO)).toEqual(['mesa', 'mostrador', 'domicilio']);
    expect(Object.keys(ORIGENES_PEDIDO)).toEqual(['local', 'whatsapp', 'telefono', 'otro']);
    for (const { etiqueta, icono } of [
      ...Object.values(TIPOS_PEDIDO),
      ...Object.values(ORIGENES_PEDIDO),
    ]) {
      expect(etiqueta).not.toBe('');
      expect(icono).toMatch(/^i-lucide-/);
    }
  });
});

describe('pasosDelPedido', () => {
  const ABIERTO = '2026-10-27T18:40:00.000Z';
  const COBRADO = '2026-10-27T18:52:00.000Z';
  const EN_COCINA = '2026-10-27T18:45:00.000Z';
  /** @param {ReturnType<typeof pasosDelPedido>} pasos */
  const resumen = (pasos) =>
    pasos.map((paso) => `${paso.id}:${paso.en ? 'hecho' : paso.siguiente ? 'siguiente' : 'falta'}`);

  it('un domicilio cobrado sin pasar por la cocina: lo siguiente es enviarlo', () => {
    const pasos = pasosDelPedido({
      tipo: 'domicilio',
      estado: 'pagado',
      abiertoEn: ABIERTO,
      cerradoEn: COBRADO,
      enviadoACocinaEn: null,
      entrega: { despachadoEn: null, entregadoEn: null },
    });

    expect(resumen(pasos)).toEqual([
      'registrado:hecho',
      'cobrado:hecho',
      'cocina:siguiente',
      'despachado:falta',
      'entregado:falta',
    ]);
  });

  it('una mesa cobrada que pasó por la cocina: todo hecho, en el orden en que pasó', () => {
    const pasos = pasosDelPedido({
      tipo: 'mesa',
      mesa: { nombre: 'Mesa 4' },
      estado: 'pagado',
      abiertoEn: ABIERTO,
      enviadoACocinaEn: EN_COCINA,
      cerradoEn: COBRADO,
    });

    expect(resumen(pasos)).toEqual(['registrado:hecho', 'cocina:hecho', 'cobrado:hecho']);
    expect(pasos[0]?.etiqueta).toBe('Pedido abierto');
  });

  it('una venta rápida cobrada sin cocina no pide cocina', () => {
    const pasos = pasosDelPedido({
      tipo: 'mostrador',
      estado: 'pagado',
      abiertoEn: ABIERTO,
      enviadoACocinaEn: null,
      cerradoEn: COBRADO,
    });

    expect(resumen(pasos)).toEqual(['registrado:hecho', 'cobrado:hecho']);
  });

  it('un pedido anulado termina ahí', () => {
    const pasos = pasosDelPedido({
      tipo: 'domicilio',
      estado: 'anulado',
      abiertoEn: ABIERTO,
      enviadoACocinaEn: null,
      cerradoEn: COBRADO,
    });

    expect(resumen(pasos)).toEqual(['registrado:hecho', 'anulado:hecho']);
  });
});
