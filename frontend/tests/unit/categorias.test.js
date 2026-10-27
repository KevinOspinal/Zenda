// @ts-check
// Pruebas del ícono y el tono de las categorías del menú.
import { describe, expect, it } from 'vitest';
import {
  ICONO_CATEGORIA_GENERICA,
  TONOS_DE_CATEGORIA,
  aparienciaDeCategoria,
  iconoDeCategoria,
} from '../../app/utils/categorias.js';

describe('iconoDeCategoria', () => {
  it('reconoce las categorías del menú de La Industria', () => {
    expect(iconoDeCategoria('Hamburguesas Artesanal')).toBe('i-lucide-hamburger');
    expect(iconoDeCategoria('Hamburguesas Angus')).toBe('i-lucide-hamburger');
    expect(iconoDeCategoria('Salchipapas 1P')).toBe('i-lucide-popcorn');
    expect(iconoDeCategoria('Perros')).toBe('i-lucide-sandwich');
    expect(iconoDeCategoria('Asados')).toBe('i-lucide-beef');
    expect(iconoDeCategoria('Combos')).toBe('i-lucide-layers');
    expect(iconoDeCategoria('Promociones')).toBe('i-lucide-badge-percent');
    expect(iconoDeCategoria('Adiciones')).toBe('i-lucide-circle-plus');
    expect(iconoDeCategoria('Bebidas')).toBe('i-lucide-cup-soda');
  });

  it('no le importan las tildes ni las mayúsculas', () => {
    expect(iconoDeCategoria('CAFÉ Y TINTOS')).toBe('i-lucide-coffee');
  });

  it('no confunde un vino tinto con un tinto (café)', () => {
    expect(iconoDeCategoria('Vinos tintos')).toBe('i-lucide-wine');
  });

  it('usa un ícono genérico si no reconoce la categoría', () => {
    expect(iconoDeCategoria('Especiales de la casa')).toBe(ICONO_CATEGORIA_GENERICA);
  });
});

describe('aparienciaDeCategoria', () => {
  it('categorías vecinas tienen tonos distintos', () => {
    const primera = aparienciaDeCategoria('Hamburguesas', 0);
    const segunda = aparienciaDeCategoria('Bebidas', 1);

    expect(primera.fondo).not.toBe(segunda.fondo);
  });

  it('los tonos se repiten en ciclo cuando hay más categorías que tonos', () => {
    const total = TONOS_DE_CATEGORIA.length;

    expect(aparienciaDeCategoria('A', total).fondo).toBe(aparienciaDeCategoria('B', 0).fondo);
  });
});
