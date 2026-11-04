// @ts-check
// Pruebas de las opciones de los productos con un backend simulado: crear y editar grupos
// (término, adiciones), asignarlos a un producto y ver la lista de grupos.
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FormularioGrupoOpciones from '~/components/admin/FormularioGrupoOpciones.vue';
import FormularioProducto from '~/components/admin/FormularioProducto.vue';
import GruposDeOpciones from '~/components/admin/GruposDeOpciones.vue';
import { useSesionStore } from '~/stores/sesion.js';
import { PLANTILLAS_DE_GRUPO } from '~/utils/opciones.js';
import { simularBackend } from './ayudantes.js';

const { fetchFalso } = vi.hoisted(() => ({ fetchFalso: vi.fn() }));
mockNuxtImport('$fetch', () => fetchFalso);

const ESPACIO_FIJO = ' ';

/**
 * Cuerpo enviado en la primera llamada a una ruta.
 * @param {string} ruta
 */
const cuerpoEnviadoA = (ruta) => fetchFalso.mock.calls.find(([r]) => r === ruta)?.[1]?.body;

const ADICIONES = {
  id: 'g2',
  nombre: 'Adiciones',
  minimo: 0,
  maximo: null,
  orden: 1,
  productos: 2,
  opciones: [
    { id: 'o1', nombre: 'Queso', precioExtra: '2160', tipoImpuesto: 'impoconsumo', activo: true },
    { id: 'o2', nombre: 'Tocineta', precioExtra: '3000', tipoImpuesto: 'exento', activo: false },
  ],
};
const TERMINO = {
  id: 'g1',
  nombre: 'Término de la carne',
  minimo: 1,
  maximo: 1,
  orden: 0,
  productos: 0,
  opciones: [
    { id: 'o3', nombre: '3/4', precioExtra: '0', tipoImpuesto: 'impoconsumo', activo: true },
  ],
};

beforeEach(() => {
  fetchFalso.mockReset();
  const sesion = useSesionStore();
  sesion.usuario = { id: 'u1', nombre: 'Andrés', email: 'a@x.test', rol: 'dueno' };
  sesion.negocio = {
    id: 'n1',
    nombre: 'La Industria',
    nit: '900111222',
    regimenImpuesto: 'responsable_inc',
  };
});

describe('grupos de opciones', () => {
  it('crea el término de la carne desde la plantilla: elige 1, obligatorio, sin precio', async () => {
    simularBackend(fetchFalso, {
      'POST /grupos-opciones': (opciones) => ({ id: 'g9', productos: 0, ...opciones.body }),
    });
    const formulario = await mountSuspended(FormularioGrupoOpciones, {
      props: { plantilla: PLANTILLAS_DE_GRUPO[0], ordenNuevo: 2 },
    });

    await formulario.find('form').trigger('submit');

    await vi.waitFor(() => expect(formulario.emitted('guardado')).toHaveLength(1));
    expect(cuerpoEnviadoA('/grupos-opciones')).toEqual({
      nombre: 'Término de la carne',
      minimo: 1,
      maximo: 1,
      orden: 2,
      opciones: ['Azul', 'Término medio', '3/4', 'Bien asado'].map((nombre) => ({
        nombre,
        precioExtra: '0',
        tipoImpuesto: 'impoconsumo',
        activo: true,
      })),
    });
  });

  it('al editar, conserva los ids, avisa del cambio de precio y envía el grupo completo', async () => {
    simularBackend(fetchFalso, {
      'PUT /grupos-opciones/g2': (opciones) => ({ ...ADICIONES, ...opciones.body }),
    });
    const formulario = await mountSuspended(FormularioGrupoOpciones, {
      props: { grupo: ADICIONES },
    });

    const precioQueso = formulario.find('input[aria-label="Precio extra de Queso"]');
    await precioQueso.setValue('2.700');
    await vi.waitFor(() => expect(formulario.text()).toContain('queda registrado en la auditoría'));
    await formulario.find('form').trigger('submit');

    await vi.waitFor(() => expect(formulario.emitted('guardado')).toHaveLength(1));
    expect(cuerpoEnviadoA('/grupos-opciones/g2')).toEqual({
      nombre: 'Adiciones',
      minimo: 0,
      maximo: null,
      orden: 1,
      opciones: [
        {
          id: 'o1',
          nombre: 'Queso',
          precioExtra: '2700',
          tipoImpuesto: 'impoconsumo',
          activo: true,
        },
        {
          id: 'o2',
          nombre: 'Tocineta',
          precioExtra: '3000',
          tipoImpuesto: 'exento',
          activo: false,
        },
      ],
    });
  });

  it('no envía un grupo con nombres repetidos', async () => {
    const formulario = await mountSuspended(FormularioGrupoOpciones, {
      props: {
        plantilla: { nombre: 'Salsas', minimo: 0, maximo: null, opciones: ['Rosada', 'rosada'] },
      },
    });

    await formulario.find('form').trigger('submit');

    await vi.waitFor(() =>
      expect(formulario.text()).toContain('Ya hay otra opción con este nombre'),
    );
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('pide confirmar antes de eliminar un grupo que usan los productos', async () => {
    simularBackend(fetchFalso, { 'DELETE /grupos-opciones/g2': () => undefined });
    const formulario = await mountSuspended(FormularioGrupoOpciones, {
      props: { grupo: ADICIONES },
    });
    const botonEliminar = () =>
      formulario.findAll('button').find((boton) => boton.text().includes('liminar'));

    await botonEliminar()?.trigger('click');
    expect(formulario.text()).toContain('Se quitará de 2 productos');
    expect(fetchFalso).not.toHaveBeenCalled();

    await botonEliminar()?.trigger('click');
    await vi.waitFor(() => expect(formulario.emitted('eliminado')).toHaveLength(1));
  });

  it('la lista muestra la regla, el precio de cada opción y dónde se usa', async () => {
    const lista = await mountSuspended(GruposDeOpciones, {
      props: { grupos: [TERMINO, ADICIONES] },
    });
    const texto = lista.text();

    expect(texto).toContain('Obligatorio');
    expect(texto).toContain('Elige 1');
    expect(texto).toContain(`Queso +$${ESPACIO_FIJO}2.160`);
    expect(texto).toContain('Elige las que quieras');
    expect(texto).toContain('En 2 productos');
    expect(texto).toContain('Aún no está en ningún producto');
  });

  it('sin grupos, ofrece las plantillas para empezar', async () => {
    const lista = await mountSuspended(GruposDeOpciones, { props: { grupos: [] } });

    for (const plantilla of PLANTILLAS_DE_GRUPO) expect(lista.text()).toContain(plantilla.nombre);
  });
});

describe('opciones del producto', () => {
  it('el producto lleva los grupos elegidos, en el orden de la lista', async () => {
    simularBackend(fetchFalso, {
      'PATCH /productos/p1': (opciones) => ({ id: 'p1', ...opciones.body }),
    });
    const formulario = await mountSuspended(FormularioProducto, {
      props: {
        categorias: [{ id: 'c1', nombre: 'Hamburguesas' }],
        grupos: [TERMINO, ADICIONES],
        producto: {
          id: 'p1',
          categoriaId: 'c1',
          nombre: 'IND Classic',
          descripcion: null,
          precio: '10800',
          tipoImpuesto: 'impoconsumo',
          controlaStock: false,
          activo: true,
          gruposOpciones: ['g2'],
        },
      },
    });
    expect(formulario.text()).toContain('Obligatorio · Elige 1');

    // Se marca el término, que va primero en la lista (las adiciones ya estaban marcadas).
    const [casillaTermino, casillaAdiciones] = formulario.findAll('button[role="checkbox"]');
    expect(casillaAdiciones?.attributes('aria-checked')).toBe('true');
    await casillaTermino?.trigger('click');
    await formulario.find('form').trigger('submit');

    await vi.waitFor(() => expect(formulario.emitted('guardado')).toHaveLength(1));
    expect(cuerpoEnviadoA('/productos/p1').gruposOpciones).toEqual(['g1', 'g2']);
  });
});
