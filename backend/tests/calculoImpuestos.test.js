// @ts-check
// Pruebas obligatorias de impuestos y totales.
// Los valores esperados están calculados a mano con el método de la DIAN:
// valor unitario = precio ÷ (1 + tasa), base = valor unitario × cantidad, impuesto = base × tasa.
import { describe, expect, it } from 'vitest';
import {
  calcularLinea,
  calcularTotalesPedido,
  obtenerTasaImpuesto,
} from '../src/modules/pedidos/calculoImpuestos.js';

/**
 * Convierte una línea calculada a texto para comparar fácilmente.
 * @param {import('../src/modules/pedidos/calculoImpuestos.js').LineaCalculada} linea
 */
function comoTexto(linea) {
  return {
    valorUnitario: linea.valorUnitario.toFixed(6),
    base: linea.base.toFixed(2),
    impuesto: linea.impuesto.toFixed(2),
    totalAPagar: linea.totalAPagar.toFixed(2),
  };
}

describe('obtenerTasaImpuesto', () => {
  it('un negocio responsable del INC cobra 8 % en productos con impoconsumo', () => {
    expect(obtenerTasaImpuesto('responsable_inc', 'impoconsumo').toFixed(2)).toBe('8.00');
  });

  it('un negocio bajo franquicia cobra IVA del 19 %', () => {
    expect(obtenerTasaImpuesto('franquicia_iva', 'iva').toFixed(2)).toBe('19.00');
  });

  it('un negocio no responsable no cobra impuesto en ningún producto', () => {
    expect(obtenerTasaImpuesto('no_responsable', 'impoconsumo').toFixed(2)).toBe('0.00');
    expect(obtenerTasaImpuesto('no_responsable', 'iva').toFixed(2)).toBe('0.00');
  });

  it('los productos exentos no causan impuesto en ningún régimen', () => {
    expect(obtenerTasaImpuesto('responsable_inc', 'exento').toFixed(2)).toBe('0.00');
    expect(obtenerTasaImpuesto('franquicia_iva', 'exento').toFixed(2)).toBe('0.00');
  });

  it('rechaza IVA en un negocio responsable del INC: los impuestos son excluyentes', () => {
    expect(() => obtenerTasaImpuesto('responsable_inc', 'iva')).toThrow(/no puede cobrar/);
    expect(() => obtenerTasaImpuesto('franquicia_iva', 'impoconsumo')).toThrow(/no puede cobrar/);
  });
});

describe('calcularLinea', () => {
  it('un tinto de $3.500 con INC 8 %', () => {
    const linea = calcularLinea({ precioConImpuesto: '3500', cantidad: '1', tasaImpuesto: '8' });

    // 3500 ÷ 1.08 = 3240.740740… → 3240.740741; × 0.08 = 259.2592 → 259.26
    expect(comoTexto(linea)).toEqual({
      valorUnitario: '3240.740741',
      base: '3240.74',
      impuesto: '259.26',
      totalAPagar: '3500.00',
    });
  });

  it('tres tintos: la base se calcula sobre la cantidad, no multiplicando la base unitaria redondeada', () => {
    const linea = calcularLinea({ precioConImpuesto: '3500', cantidad: '3', tasaImpuesto: '8' });

    // 3240.740741 × 3 = 9722.222223 → 9722.22; × 0.08 = 777.7776 → 777.78
    expect(comoTexto(linea)).toEqual({
      valorUnitario: '3240.740741',
      base: '9722.22',
      impuesto: '777.78',
      totalAPagar: '10500.00',
    });
  });

  it('dos almuerzos de $18.000 en un negocio con IVA 19 %', () => {
    const linea = calcularLinea({ precioConImpuesto: '18000', cantidad: '2', tasaImpuesto: '19' });

    // 18000 ÷ 1.19 = 15126.050420…; × 2 = 30252.10084 → 30252.10; × 0.19 = 5747.899 → 5747.90
    expect(comoTexto(linea)).toEqual({
      valorUnitario: '15126.050420',
      base: '30252.10',
      impuesto: '5747.90',
      totalAPagar: '36000.00',
    });
  });

  it('admite cantidades decimales (media porción)', () => {
    const linea = calcularLinea({ precioConImpuesto: '9000', cantidad: '0.5', tasaImpuesto: '8' });

    expect(comoTexto(linea)).toEqual({
      valorUnitario: '8333.333333',
      base: '4166.67',
      impuesto: '333.33',
      totalAPagar: '4500.00',
    });
  });

  it('un producto exento no tiene impuesto y su base es el precio', () => {
    const linea = calcularLinea({ precioConImpuesto: '2000', cantidad: '2', tasaImpuesto: '0' });

    expect(comoTexto(linea)).toEqual({
      valorUnitario: '2000.000000',
      base: '4000.00',
      impuesto: '0.00',
      totalAPagar: '4000.00',
    });
  });

  it('rechaza precio negativo, cantidad no positiva y tasas fuera de rango', () => {
    expect(() =>
      calcularLinea({ precioConImpuesto: '-1', cantidad: '1', tasaImpuesto: '8' }),
    ).toThrow(RangeError);
    expect(() =>
      calcularLinea({ precioConImpuesto: '1000', cantidad: '0', tasaImpuesto: '8' }),
    ).toThrow(RangeError);
    expect(() =>
      calcularLinea({ precioConImpuesto: '1000', cantidad: '1', tasaImpuesto: '101' }),
    ).toThrow(RangeError);
  });
});

describe('calcularTotalesPedido', () => {
  it('cuando el cálculo DIAN da un centavo menos, el ajuste lo completa', () => {
    // $2.500: base 2314.81 + INC 185.18 = 2499.99 → ajuste +0.01
    const linea = calcularLinea({ precioConImpuesto: '2500', cantidad: '1', tasaImpuesto: '8' });
    const totales = calcularTotalesPedido([linea]);

    expect(totales.subtotal.toFixed(2)).toBe('2314.81');
    expect(totales.impuestos.toFixed(2)).toBe('185.18');
    expect(totales.ajusteRedondeo.toFixed(2)).toBe('0.01');
    expect(totales.total.toFixed(2)).toBe('2500.00');
  });

  it('cuando el cálculo DIAN da un centavo más, el ajuste es negativo', () => {
    // $200: base 185.19 + INC 14.82 = 200.01 → ajuste −0.01
    const linea = calcularLinea({ precioConImpuesto: '200', cantidad: '1', tasaImpuesto: '8' });
    const totales = calcularTotalesPedido([linea]);

    expect(totales.ajusteRedondeo.toFixed(2)).toBe('-0.01');
    expect(totales.total.toFixed(2)).toBe('200.00');
  });

  it('un pedido mixto suma las líneas y agrupa los impuestos por tasa', () => {
    const lineas = [
      calcularLinea({ precioConImpuesto: '3500', cantidad: '2', tasaImpuesto: '8' }),
      calcularLinea({ precioConImpuesto: '2500', cantidad: '1', tasaImpuesto: '8' }),
      calcularLinea({ precioConImpuesto: '2000', cantidad: '1', tasaImpuesto: '0' }),
    ];
    const totales = calcularTotalesPedido(lineas);

    // Líneas: 6481.48 + 518.52 | 2314.81 + 185.18 | 2000.00 + 0.00
    expect(totales.subtotal.toFixed(2)).toBe('10796.29');
    expect(totales.impuestos.toFixed(2)).toBe('703.70');
    expect(totales.ajusteRedondeo.toFixed(2)).toBe('0.01');
    expect(totales.total.toFixed(2)).toBe('11500.00');

    const desglose = totales.impuestosPorTasa.map((grupo) => ({
      tasa: grupo.tasaImpuesto.toFixed(2),
      base: grupo.base.toFixed(2),
      impuesto: grupo.impuesto.toFixed(2),
    }));
    expect(desglose).toEqual([
      { tasa: '0.00', base: '2000.00', impuesto: '0.00' },
      { tasa: '8.00', base: '8796.29', impuesto: '703.70' },
    ]);
  });

  it('un pedido vacío tiene todos los totales en cero', () => {
    const totales = calcularTotalesPedido([]);

    expect(totales.total.toFixed(2)).toBe('0.00');
    expect(totales.impuestosPorTasa).toEqual([]);
  });

  it('en cualquier precio el cliente paga exactamente el menú y el ajuste es de máximo un centavo por línea', () => {
    // Barrido de precios típicos de una cafetería con varias cantidades y tasas.
    for (let precio = 100; precio <= 60000; precio += 100) {
      for (const cantidad of ['1', '2', '3', '0.5']) {
        for (const tasa of ['0', '8', '19']) {
          const linea = calcularLinea({
            precioConImpuesto: String(precio),
            cantidad,
            tasaImpuesto: tasa,
          });
          const totales = calcularTotalesPedido([linea]);

          // El total es exactamente precio × cantidad.
          expect(totales.total.equals(linea.totalAPagar)).toBe(true);
          // Siempre cuadra: subtotal + impuestos + ajuste = total.
          const suma = totales.subtotal.plus(totales.impuestos).plus(totales.ajusteRedondeo);
          expect(suma.equals(totales.total)).toBe(true);
          // El ajuste nunca pasa de un centavo por línea.
          expect(totales.ajusteRedondeo.abs().lessThanOrEqualTo('0.01')).toBe(true);
        }
      }
    }
  });
});
