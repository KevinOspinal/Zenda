// @ts-check
// Pruebas de la pantalla de inventario con un backend simulado: tarjetas por categoría con lo
// urgente primero, contadores que filtran, búsqueda, vista rápida (PC) y hoja de abajo
// (celular) con el historial, registrar una compra y la recarga en vivo al cobrar.
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PaginaInventario from '~/pages/admin/inventario.vue';
import { useInventarioStore } from '~/stores/inventario.js';
import { useSesionStore } from '~/stores/sesion.js';
import { simularBackend } from './ayudantes.js';

const { fetchFalso } = vi.hoisted(() => ({ fetchFalso: vi.fn() }));
mockNuxtImport('$fetch', () => fetchFalso);

const INVENTARIO = [
  { id: 'agua', nombre: 'Agua', stock: '-24', activo: true },
  { id: 'gaseosa', nombre: 'Gaseosa personal', stock: '5', activo: true },
  { id: 'club', nombre: 'Club Colombia', stock: '30', activo: true },
  { id: 'jugo', nombre: 'Jugo Hit', stock: '0', activo: true },
];
const CATEGORIAS = [
  { id: 'c1', nombre: 'Cervezas', orden: 0 },
  { id: 'c2', nombre: 'Bebidas', orden: 1 },
];
const PRODUCTOS = [
  { id: 'agua', categoriaId: 'c2' },
  { id: 'gaseosa', categoriaId: 'c2' },
  { id: 'club', categoriaId: 'c1' },
  { id: 'jugo', categoriaId: 'c2' },
];
const hace = (/** @type {number} */ minutos) =>
  new Date(Date.now() - minutos * 60_000).toISOString();
/** Movimientos del agua, del más reciente al más antiguo: -24 = 6 - 30. */
const MOVIMIENTOS_AGUA = [
  { id: 'v2', tipo: 'venta', cantidad: '-12', fecha: hace(10) },
  { id: 'v1', tipo: 'venta', cantidad: '-18', fecha: hace(90) },
  { id: 'c1', tipo: 'compra', cantidad: '6', fecha: hace(600) },
];

/**
 * El backend simulado del inventario, con lo que se le pase encima.
 * @param {Record<string, (opciones: any) => any>} [extra]
 */
function backend(extra = {}) {
  return simularBackend(fetchFalso, {
    // Copias: registrar una compra cambia el producto en el store y no debe tocar los datos de
    // las otras pruebas.
    'GET /inventario': () => structuredClone(INVENTARIO),
    'GET /categorias': () => CATEGORIAS,
    'GET /productos': () => PRODUCTOS,
    'GET /inventario/agua/movimientos': () => MOVIMIENTOS_AGUA,
    ...extra,
  });
}

/** @param {'dueno' | 'cajero'} rol */
function sesionComo(rol) {
  useSesionStore().usuario = { id: 'u1', nombre: 'Marta', email: 'm@x.test', rol };
}

/**
 * Cambia el tamaño de la pantalla simulada: desde 1024 px, la vista rápida va al lado.
 * @param {number} width
 * @param {number} height
 */
function pantalla(width, height) {
  const ventana =
    /** @type {{ happyDOM: { setViewport: (tamano: { width: number, height: number }) => void } }} */ (
      /** @type {unknown} */ (window)
    );
  ventana.happyDOM.setViewport({ width, height });
}

/**
 * Texto que leen los lectores de pantalla en un contador (el número final, sin la animación).
 * @param {import('@vue/test-utils').VueWrapper} pagina
 * @param {string} etiqueta
 */
const contador = (pagina, etiqueta) =>
  pagina
    .findAll('[aria-label="Filtrar el inventario"] button')
    .find((boton) => boton.text().includes(etiqueta));

/**
 * Nombres de los productos en pantalla, en orden.
 * @param {import('@vue/test-utils').VueWrapper} pagina
 */
const nombresEnPantalla = (pagina) => pagina.findAll('button.principal').map((b) => b.text());

beforeEach(() => {
  fetchFalso.mockReset();
  document.body.querySelectorAll('[role="dialog"]').forEach((dialogo) => dialogo.remove());
  sesionComo('dueno');
  // El store vive entre pruebas: cada una empieza con el inventario sin cargar.
  const inventario = useInventarioStore();
  inventario.productos = [];
  inventario.estadoCarga = 'sin_cargar';
  inventario.resaltados.clear();
});
afterEach(() => pantalla(1024, 768));

describe('inventario', () => {
  it('agrupa por categoría de la carta, con lo urgente primero, y cuenta cada estado', async () => {
    backend();
    const pagina = await mountSuspended(PaginaInventario);

    await vi.waitFor(() => expect(pagina.text()).toContain('Club Colombia'));
    // Cervezas va primero en la carta; en Bebidas: negativo, agotado y bajo.
    expect(pagina.findAll('h2').map((titulo) => titulo.text())).toEqual([
      expect.stringContaining('Cervezas'),
      expect.stringContaining('Bebidas'),
    ]);
    expect(pagina.findAll('h2')[1].text()).toContain('3 por atender');
    expect(nombresEnPantalla(pagina)).toEqual([
      'Club Colombia',
      'Agua',
      'Jugo Hit',
      'Gaseosa personal',
    ]);
    for (const [etiqueta, cuantos] of [
      ['Por revisar', '1'],
      ['Agotados', '1'],
      ['Stock bajo', '1'],
      ['Con stock', '1'],
    ]) {
      expect(contador(pagina, etiqueta)?.find('.sr-only').text()).toBe(cuantos);
    }
    expect(pagina.text()).toContain('24 vendidas sin stock registrado');
  });

  it('los contadores filtran y el buscador encuentra sin importar tildes ni mayúsculas', async () => {
    backend();
    const pagina = await mountSuspended(PaginaInventario);
    await vi.waitFor(() => expect(pagina.text()).toContain('Agua'));

    await contador(pagina, 'Por revisar')?.trigger('click');
    await vi.waitFor(() => expect(nombresEnPantalla(pagina)).toEqual(['Agua']));
    expect(contador(pagina, 'Por revisar')?.attributes('aria-pressed')).toBe('true');

    // Tocarlo otra vez muestra todo de nuevo.
    await contador(pagina, 'Por revisar')?.trigger('click');
    await vi.waitFor(() => expect(nombresEnPantalla(pagina)).toHaveLength(4));

    await pagina.find('input[type="search"]').setValue('JUGÓ');
    await vi.waitFor(() => expect(nombresEnPantalla(pagina)).toEqual(['Jugo Hit']));
    expect(pagina.text()).toContain('1 de 4 productos');
  });

  it('en tablet y PC, un producto abre la vista rápida con su historial y ahí se registra una compra', async () => {
    pantalla(1280, 800);
    /** @type {unknown[]} */
    const compras = [];
    backend({
      'POST /inventario/movimientos': (opciones) => {
        compras.push(opciones.body);
        return { productoId: 'agua', nombre: 'Agua', stock: '-12' };
      },
    });
    const pagina = await mountSuspended(PaginaInventario);
    await vi.waitFor(() => expect(pagina.text()).toContain('Agua'));

    await pagina.find('button.principal[aria-label^="Agua"]').trigger('click');

    const vistaRapida = () => pagina.find('aside[aria-label="Vista rápida de Agua"]');
    await vi.waitFor(() => expect(vistaRapida().text()).toContain('Movimientos'));
    // Hoy: dos ventas; cada una con cuánto quedó (calculado hacia atrás desde -24).
    expect(vistaRapida().text()).toContain('Vendidas en 7 días');
    expect(vistaRapida().text()).toContain('quedó -24');
    expect(vistaRapida().text()).toContain('quedó -12');
    expect(vistaRapida().text()).toContain('quedó 6');
    expect(vistaRapida().find('[role="img"]').attributes('aria-label')).toContain(
      'ahora va en -24',
    );

    // Compra de 12 desde la vista rápida.
    await vistaRapida()
      .findAll('button')
      .find((boton) => boton.text() === 'Compra')
      ?.trigger('click');
    const dialogo = await vi.waitFor(() => {
      const encontrado = document.body.querySelector('[role="dialog"]');
      expect(encontrado?.textContent).toContain('Compra de Agua');
      return /** @type {HTMLElement} */ (encontrado);
    });
    const cantidad = /** @type {HTMLInputElement} */ (dialogo.querySelector('input'));
    cantidad.value = '12';
    cantidad.dispatchEvent(new Event('input', { bubbles: true }));
    cantidad.dispatchEvent(new Event('blur'));
    await vi.waitFor(() => expect(dialogo.textContent).toContain('Stock: -24 →'));
    const registrar = [...dialogo.querySelectorAll('button')].find((boton) =>
      boton.textContent?.includes('Registrar compra'),
    );
    registrar?.click();

    await vi.waitFor(() =>
      expect(compras).toEqual([{ tipo: 'compra', productoId: 'agua', cantidad: 12 }]),
    );
    // El stock nuevo es el que respondió el API.
    await vi.waitFor(() =>
      expect(useInventarioStore().productos.find((p) => p.id === 'agua')?.stock).toBe('-12'),
    );
  });

  it('en el celular, un producto abre su detalle en una hoja desde abajo', async () => {
    pantalla(390, 844);
    backend();
    const pagina = await mountSuspended(PaginaInventario);
    await vi.waitFor(() => expect(pagina.text()).toContain('Agua'));

    await pagina.find('button.principal[aria-label^="Agua"]').trigger('click');

    await vi.waitFor(() => {
      const hoja = document.body.querySelector('[role="dialog"]');
      expect(hoja?.textContent).toContain('Stock actual');
      expect(hoja?.textContent).toContain('quedó -12');
    });
    expect(pagina.find('aside').exists()).toBe(false);
  });

  it('quien solo consulta (cajero) ve el inventario sin Compra ni Ajustar', async () => {
    sesionComo('cajero');
    backend();
    const pagina = await mountSuspended(PaginaInventario);
    await vi.waitFor(() => expect(pagina.text()).toContain('Agua'));

    const botones = pagina.findAll('button').map((boton) => boton.text());
    expect(botones).not.toContain('Compra');
    expect(botones).not.toContain('Ajustar');
  });

  it('en vivo: al cobrar un pedido se vuelve a traer y el producto que cambió se resalta', async () => {
    let stockDelAgua = '-24';
    backend({
      'GET /inventario': () =>
        structuredClone(INVENTARIO).map((p) =>
          p.id === 'agua' ? { ...p, stock: stockDelAgua } : p,
        ),
    });
    const pagina = await mountSuspended(PaginaInventario);
    await vi.waitFor(() => expect(pagina.text()).toContain('Agua'));
    expect(pagina.find('[class*="animate-onda"]').exists()).toBe(false);

    // Se cobró un pedido con 2 aguas (el plugin de eventos llama a alCambiarVentas).
    stockDelAgua = '-26';
    useInventarioStore().alCambiarVentas();

    await vi.waitFor(() => expect(pagina.text()).toContain('26 vendidas sin stock registrado'));
    expect(pagina.find('[class*="animate-onda"]').exists()).toBe(true);
  });
});
