// @ts-check
// Pruebas de qué impuesto puede llevar un producto según el régimen del negocio.
import { describe, expect, it } from 'vitest';
import {
  OPCIONES_REGIMEN,
  facturaElectronica,
  impuestosPermitidos,
} from '../../app/utils/impuestos.js';

describe('impuestosPermitidos', () => {
  it('cada régimen permite su impuesto o exento, como el backend', () => {
    expect(impuestosPermitidos('responsable_inc')).toEqual(['impoconsumo', 'exento']);
    expect(impuestosPermitidos('franquicia_iva')).toEqual(['iva', 'exento']);
    expect(impuestosPermitidos('no_responsable')).toEqual(['exento']);
  });
});

describe('facturaElectronica', () => {
  it('factura electrónicamente salvo el negocio no responsable', () => {
    expect(facturaElectronica('responsable_inc')).toBe(true);
    expect(facturaElectronica('franquicia_iva')).toBe(true);
    expect(facturaElectronica('no_responsable')).toBe(false);
  });

  it('las opciones del registro y la configuración cubren los tres regímenes', () => {
    expect(OPCIONES_REGIMEN.map((opcion) => opcion.value)).toEqual([
      'responsable_inc',
      'franquicia_iva',
      'no_responsable',
    ]);
  });
});
