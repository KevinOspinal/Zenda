// @ts-check
// Pruebas de cómo se nombra y se reconoce un pedido según su tipo.
import { describe, expect, it } from 'vitest';
import {
  ORIGENES_PEDIDO,
  TIPOS_PEDIDO,
  nombreDelPedido,
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
