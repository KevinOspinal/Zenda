// @ts-check
// Prueba de humo del entorno Nuxt: la app de prueba arranca con la configuración real
// y el tema de Zenda.
import { useAppConfig, useRuntimeConfig } from '#imports';
import { describe, expect, it } from 'vitest';

describe('configuración de la app', () => {
  it('apunta al API local por defecto', () => {
    expect(useRuntimeConfig().public.apiUrl).toBe('http://localhost:3000');
  });

  it('usa el tema de la marca: índigo con grises fríos', () => {
    expect(useAppConfig().ui.colors).toMatchObject({ primary: 'indigo', neutral: 'slate' });
  });
});
