// @ts-check
// Prueba de humo del entorno Nuxt: la app de prueba arranca con la configuración real,
// el tema de Zenda y los componentes de Nuxt UI.
import { useAppConfig, useRuntimeConfig } from '#imports';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import PaginaInicio from '~/pages/index.vue';

describe('configuración de la app', () => {
  it('apunta al API local por defecto', () => {
    expect(useRuntimeConfig().public.apiUrl).toBe('http://localhost:3000');
  });

  it('usa el tema fresco y natural: esmeralda con grises cálidos', () => {
    expect(useAppConfig().ui.colors).toMatchObject({ primary: 'emerald', neutral: 'stone' });
  });
});

describe('página de inicio provisional', () => {
  it('muestra el nombre de la app', async () => {
    const pagina = await mountSuspended(PaginaInicio);

    expect(pagina.text()).toContain('Zenda');
    expect(pagina.text()).toContain('Administración para restaurantes y cafeterías');
  });
});
