// @ts-check
// Pruebas de las opciones de los productos con un backend simulado:
// - Administración: crear y editar grupos (término, adiciones), asignarlos a un producto y
//   ver la lista de grupos.
// - Pedido: elegirlas al agregar un plato, enviarlas al API y verlas en la cuenta y la cocina.
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FormularioGrupoOpciones from '~/components/admin/FormularioGrupoOpciones.vue';
import FormularioProducto from '~/components/admin/FormularioProducto.vue';
import GruposDeOpciones from '~/components/admin/GruposDeOpciones.vue';
import TarjetaComanda from '~/components/cocina/TarjetaComanda.vue';
import PersonalizarProducto from '~/components/pedidos/PersonalizarProducto.vue';
import ResumenCuenta from '~/components/pedidos/ResumenCuenta.vue';
import TarjetaProducto from '~/components/pedidos/TarjetaProducto.vue';
import { usePedidoEnCurso } from '~/composables/usePedidoEnCurso.js';
import { useSesionStore } from '~/stores/sesion.js';
import { PLANTILLAS_DE_GRUPO } from '~/utils/opciones.js';
import { simularBackend } from './ayudantes.js';

const { fetchFalso } = vi.hoisted(() => ({ fetchFalso: vi.fn() }));
mockNuxtImport('$fetch', () => fetchFalso);

const ESPACIO_FIJO = '\u00a0';
/** @param {string} valor Por ejemplo "12.960". */
const pesos = (valor) => `$${ESPACIO_FIJO}${valor}`;

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

// Los paneles se dibujan en el body (fuera del componente): se limpian entre pruebas.
afterEach(() => {
  document.body.querySelectorAll('[role="dialog"]').forEach((dialogo) => dialogo.remove());
});

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

describe('al tomar el pedido', () => {
  /** Hamburguesa como la entrega GET /menu: término obligatorio y adiciones con precio. */
  const HAMBURGUESA = {
    id: 'p1',
    nombre: 'IND Classic',
    descripcion: null,
    precio: '10800',
    grupos: [
      {
        id: 'g1',
        nombre: 'Término de la carne',
        minimo: 1,
        maximo: 1,
        opciones: [
          { id: 'o3', nombre: '3/4', precioExtra: '0' },
          { id: 'o4', nombre: 'Bien asado', precioExtra: '0' },
        ],
      },
      {
        id: 'g2',
        nombre: 'Adiciones',
        minimo: 0,
        maximo: null,
        opciones: [{ id: 'o1', nombre: 'Queso', precioExtra: '2160' }],
      },
    ],
  };
  const APARIENCIA = { icono: 'i-lucide-hamburger', fondo: '', texto: '' };

  /**
   * Botón del panel (se dibuja en el body) que contiene un texto.
   * @param {string} texto
   */
  const botonDelPanel = (texto) =>
    /** @type {HTMLButtonElement | undefined} */ (
      [...document.body.querySelectorAll('button')].find((boton) =>
        boton.textContent?.includes(texto),
      )
    );

  it('un plato con término obligatorio abre sus opciones en lugar de agregarse', async () => {
    const tarjeta = await mountSuspended(TarjetaProducto, {
      props: { producto: HAMBURGUESA, apariencia: APARIENCIA },
    });

    await tarjeta.findAll('button')[0]?.trigger('click');

    expect(tarjeta.emitted('agregar')).toBeUndefined();
    expect(tarjeta.emitted('personalizar')?.[0]).toEqual([HAMBURGUESA]);
    expect(tarjeta.text()).toContain('Elige opciones');
  });

  it('no deja agregar sin el término; con él, suma las adiciones al valor', async () => {
    const panel = await mountSuspended(PersonalizarProducto, {
      props: { producto: HAMBURGUESA, apariencia: APARIENCIA, abierto: true },
    });

    await vi.waitFor(() => expect(botonDelPanel('Elige: Término de la carne')).toBeDefined());
    expect(botonDelPanel('Elige: Término de la carne')?.disabled).toBe(true);
    expect(document.body.textContent).toContain('Obligatorio');

    // Cada toque espera a que la pantalla se actualice, como pasa con un dedo real.
    botonDelPanel('3/4')?.click();
    await nextTick();
    botonDelPanel('Queso')?.click();

    await vi.waitFor(() =>
      expect(botonDelPanel(`Agregar · ${pesos('12.960')}`)?.disabled).toBe(false),
    );
    expect(document.body.textContent).toContain('Listo');
    botonDelPanel('Agregar ·')?.click();

    expect(panel.emitted('agregar')?.[0]).toEqual([
      { producto: HAMBURGUESA, cantidad: 1, notas: '', opciones: ['o3', 'o1'] },
    ]);
  });

  it('las opciones elegidas viajan al API con el plato', async () => {
    simularBackend(fetchFalso, {
      'GET /mesas': () => [],
      'POST /pedidos': (opciones) => ({
        id: 'n1',
        estado: 'abierto',
        tipo: 'mostrador',
        total: '12960',
        abiertoEn: new Date().toISOString(),
        items: [],
        ...opciones.body,
      }),
    });
    /** @type {ReturnType<typeof usePedidoEnCurso> | undefined} */
    let pedidoEnCurso;
    const Envoltura = defineComponent({
      setup() {
        pedidoEnCurso = usePedidoEnCurso({ pedidoId: ref(''), mesaId: ref(''), alCrear: () => {} });
        return () => h('div');
      },
    });
    await mountSuspended(Envoltura);

    await pedidoEnCurso?.agregar(HAMBURGUESA, { opciones: ['o3', 'o1'] });

    expect(cuerpoEnviadoA('/pedidos').items).toEqual([
      { productoId: 'p1', cantidad: 1, opciones: ['o3', 'o1'] },
    ]);
  });

  /** Ítem del pedido con sus opciones, como lo entrega el API. */
  const ITEM = {
    id: 'i1',
    cantidad: '1',
    precioUnitario: '12960',
    notas: 'Salsa aparte',
    estadoCocina: 'pendiente',
    creadoEn: new Date().toISOString(),
    producto: { nombre: 'IND Classic' },
    opciones: [
      { id: 'x1', opcionId: 'o3', grupo: 'Término de la carne', nombre: '3/4', precioExtra: '0' },
      { id: 'x2', opcionId: 'o1', grupo: 'Adiciones', nombre: 'Queso', precioExtra: '2160' },
    ],
  };

  it('la cuenta muestra las opciones con el precio de las adiciones', async () => {
    const cuenta = await mountSuspended(ResumenCuenta, { props: { items: [ITEM] } });

    expect(cuenta.text()).toContain(`3/4 · Queso +${pesos('2.160')}`);
    expect(cuenta.text()).toContain(pesos('12.960'));
  });

  it('la cocina ve las opciones sin precios, aparte de las notas', async () => {
    const pedido = {
      id: 'n1',
      estado: 'enviado_a_cocina',
      mesa: { id: 'm1', nombre: 'Mesa 4' },
      mesaId: 'm1',
      total: '12960',
      abiertoEn: ITEM.creadoEn,
      items: [ITEM],
    };
    const tarjeta = await mountSuspended(TarjetaComanda, {
      props: { comanda: { pedido, items: pedido.items, minutos: 0 } },
    });

    expect(tarjeta.text()).toContain('3/4 · Queso');
    expect(tarjeta.text()).not.toContain('2.160');
    expect(tarjeta.text()).toContain('Salsa aparte');
  });
});
