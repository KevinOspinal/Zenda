// @ts-check
// Pruebas de qué impuesto puede llevar un producto según el régimen del negocio.
import { describe, expect, it } from 'vitest';
import { impuestosPermitidos } from '../../app/utils/impuestos.js';

describe('impuestosPermitidos', () => {
  it('cada régimen permite su impuesto o exento, como el backend', () => {
    expect(impuestosPermitidos('responsable_inc')).toEqual(['impoconsumo', 'exento']);
    expect(impuestosPermitidos('franquicia_iva')).toEqual(['iva', 'exento']);
    expect(impuestosPermitidos('no_responsable')).toEqual(['exento']);
  });
});
