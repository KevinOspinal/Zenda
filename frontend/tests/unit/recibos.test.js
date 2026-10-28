// @ts-check
// Pruebas de los datos del recibo de venta: número, líneas, cambio y total pagado.
import { describe, expect, it } from 'vitest';
import {
  lineasDelRecibo,
  numeroDeRecibo,
  pagosDelRecibo,
  totalPagadoDelRecibo,
} from '../../app/utils/recibos.js';

const PEDIDO = {
  total: '28000',
  propina: '2000',
  items: [
    {
      id: 'i1',
      cantidad: '2',
      precioUnitario: '12000',
      notas: 'Sin cebolla',
      producto: { nombre: 'IND Classic' },
    },
    { id: 'i2', cantidad: '1', precioUnitario: '4000', producto: { nombre: 'Gaseosa' } },
  ],
  pagos: [
    { id: 'p1', metodo: 'efectivo', monto: '20000', recibido: '50000' },
    { id: 'p2', metodo: 'tarjeta', monto: '10000', recibido: null },
  ],
};

describe('recibo de venta', () => {
  it('el número va con seis cifras', () => {
    expect(numeroDeRecibo(7)).toBe('000007');
    expect(numeroDeRecibo(123456)).toBe('123456');
  });

  it('cada línea vale cantidad por precio', () => {
    expect(
      lineasDelRecibo(PEDIDO).map((linea) => [linea.nombre, linea.valor.toFixed(0), linea.notas]),
    ).toEqual([
      ['IND Classic', '24000', 'Sin cebolla'],
      ['Gaseosa', '4000', null],
    ]);
  });

  it('el cambio sale solo del efectivo, cuando el cliente entregó más', () => {
    expect(pagosDelRecibo(PEDIDO).map((pago) => pago.cambio?.toFixed(0) ?? null)).toEqual([
      '30000',
      null,
    ]);
  });

  it('el total pagado suma la propina voluntaria', () => {
    expect(totalPagadoDelRecibo(PEDIDO).toFixed(0)).toBe('30000');
  });
});
