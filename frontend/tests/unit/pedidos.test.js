// @ts-check
// Pruebas de cómo se nombra y se reconoce un pedido según su tipo, su seguimiento y qué le
// falta a un pedido ya cobrado (decidir lo de la cocina o entregar sus platos).
import { describe, expect, it } from 'vitest';
import {
  ORIGENES_PEDIDO,
  TIPOS_PEDIDO,
  avisoDelPedidoCerrado,
  esCobradoEnCocina,
  faltaDecidirCocina,
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

describe('pedido ya cobrado: la cocina y sus platos', () => {
  const ENVIADO = '2026-11-04T12:00:00.000Z';
  /** @param {string} estadoCocina */
  const plato = (estadoCocina) => ({ estadoCocina });
  /**
   * Pedido de mesa cobrado sin pasar por la cocina, con un plato pendiente.
   * @param {Record<string, unknown>} [cambios]
   */
  const cobrado = (cambios = {}) => ({
    tipo: 'mesa',
    mesa: { nombre: 'Mesa 4' },
    estado: 'pagado',
    enviadoACocinaEn: null,
    items: [plato('pendiente')],
    ...cambios,
  });

  it('falta decidir lo de la cocina si se cobró sin enviarlo y tiene algo por entregar', () => {
    expect(faltaDecidirCocina(cobrado())).toBe(true);
    // Ya fue a la cocina, ya se entregó todo o no se ha cobrado: no falta nada.
    expect(faltaDecidirCocina(cobrado({ enviadoACocinaEn: ENVIADO }))).toBe(false);
    expect(faltaDecidirCocina(cobrado({ items: [plato('entregado')] }))).toBe(false);
    expect(faltaDecidirCocina(cobrado({ estado: 'abierto' }))).toBe(false);
  });

  it('un pedido cobrado sigue en la cocina mientras le falten platos por entregar', () => {
    const enCocina = cobrado({
      enviadoACocinaEn: ENVIADO,
      items: [plato('listo'), plato('entregado')],
    });

    expect(esCobradoEnCocina(enCocina)).toBe(true);
    expect(esCobradoEnCocina({ ...enCocina, items: [plato('entregado')] })).toBe(false);
    expect(esCobradoEnCocina(cobrado())).toBe(false);
  });

  it('el aviso dice qué falta: decidir lo de la cocina, llevar los platos o nada', () => {
    expect(avisoDelPedidoCerrado(cobrado())).toMatchObject({
      color: 'warning',
      titulo: 'Falta enviarlo a la cocina',
    });
    expect(avisoDelPedidoCerrado(cobrado()).descripcion).toContain('No va a cocina');
    // Un domicilio siempre va a la cocina: no se le ofrece otra salida.
    expect(
      avisoDelPedidoCerrado(cobrado({ tipo: 'domicilio', mesa: null })).descripcion,
    ).not.toContain('No va a cocina');
    expect(avisoDelPedidoCerrado(cobrado({ enviadoACocinaEn: ENVIADO }))).toMatchObject({
      color: 'info',
      titulo: 'Cobrado · faltan platos por llevar',
    });
    expect(
      avisoDelPedidoCerrado(cobrado({ enviadoACocinaEn: ENVIADO, items: [plato('entregado')] })),
    ).toMatchObject({ color: 'success', titulo: 'Pedido cobrado' });
    expect(avisoDelPedidoCerrado(cobrado({ estado: 'anulado' }))).toMatchObject({
      color: 'error',
      titulo: 'Pedido anulado',
    });
  });
});
