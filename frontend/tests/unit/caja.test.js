// @ts-check
// Pruebas de las cuentas de la caja: cobro, cambio, montos rápidos y conteo del efectivo.
import { describe, expect, it } from 'vitest';
import {
  estadoDelCobro,
  montosRapidos,
  pagosParaApi,
  recibidoAlcanza,
  totalDelConteo,
} from '../../app/utils/caja.js';

describe('estadoDelCobro', () => {
  it('pago exacto en efectivo, con propina y billete grande: cuadra y calcula el cambio', () => {
    const estado = estadoDelCobro({
      total: '38000',
      propina: '4000',
      pagos: [{ metodo: 'efectivo', monto: '42000', recibido: '50000' }],
    });

    expect(estado.aPagar.toFixed(0)).toBe('42000');
    expect(estado.cuadra).toBe(true);
    expect(estado.cambio.toFixed(0)).toBe('8000');
  });

  it('pagos mixtos: dice cuánto falta mientras no cuadra', () => {
    const estado = estadoDelCobro({
      total: '38000',
      propina: '0',
      pagos: [
        { metodo: 'efectivo', monto: '30000' },
        { metodo: 'tarjeta', monto: '' },
      ],
    });

    expect(estado.cuadra).toBe(false);
    expect(estado.faltante.toFixed(0)).toBe('8000');
    expect(estado.sobrante.isZero()).toBe(true);
  });

  it('si se pasa, dice cuánto sobra y no cuadra', () => {
    const estado = estadoDelCobro({
      total: '10000',
      propina: '0',
      pagos: [{ metodo: 'tarjeta', monto: '12000' }],
    });

    expect(estado.cuadra).toBe(false);
    expect(estado.sobrante.toFixed(0)).toBe('2000');
  });

  it('un campo inválido cuenta como cero (no rompe la cuenta)', () => {
    const estado = estadoDelCobro({
      total: '10000',
      propina: '',
      pagos: [{ metodo: 'efectivo', monto: 'abc' }],
    });

    expect(estado.pagado.isZero()).toBe(true);
    expect(estado.cuadra).toBe(false);
  });
});

describe('recibidoAlcanza y pagosParaApi', () => {
  it('lo recibido en efectivo no puede ser menor que el monto', () => {
    expect(recibidoAlcanza({ metodo: 'efectivo', monto: '42000', recibido: '40000' })).toBe(false);
    expect(recibidoAlcanza({ metodo: 'efectivo', monto: '42000', recibido: '50000' })).toBe(true);
    expect(recibidoAlcanza({ metodo: 'efectivo', monto: '42000' })).toBe(true);
  });

  it('envía solo lo que el API acepta: recibido en efectivo y referencia en los demás', () => {
    expect(
      pagosParaApi([
        { metodo: 'efectivo', monto: '30000', recibido: '50000', referencia: 'x' },
        { metodo: 'tarjeta', monto: '8000', recibido: '9000', referencia: ' APROB-1 ' },
        { metodo: 'transferencia', monto: '' },
      ]),
    ).toEqual([
      { metodo: 'efectivo', monto: '30000', recibido: '50000' },
      { metodo: 'tarjeta', monto: '8000', referencia: 'APROB-1' },
    ]);
  });
});

describe('montosRapidos', () => {
  it('ofrece el exacto y los redondos por encima', () => {
    expect(montosRapidos('38000')).toEqual(['38000', '40000', '50000', '100000']);
    expect(montosRapidos('2000')).toEqual(['2000', '5000', '10000', '20000']);
  });

  it('sin nada que pagar, no ofrece montos', () => {
    expect(montosRapidos('0')).toEqual([]);
  });
});

describe('totalDelConteo', () => {
  it('suma billetes y monedas contados', () => {
    expect(totalDelConteo({ 50000: 2, 20000: 1, 1000: 3, 500: 1 }).toFixed(0)).toBe('123500');
  });

  it('ignora cantidades vacías o negativas', () => {
    expect(totalDelConteo({ 50000: Number.NaN, 2000: -1, 100: 4 }).toFixed(0)).toBe('400');
  });
});
