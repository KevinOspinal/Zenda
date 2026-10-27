// @ts-check
// Pruebas de los componentes que usarán las pantallas reales: tarjetas de mesa y de
// producto, la cuenta y el valor animado.
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import CifraAnimada from '~/components/comunes/CifraAnimada.vue';
import TarjetaMesa from '~/components/mesas/TarjetaMesa.vue';
import ResumenCuenta from '~/components/pedidos/ResumenCuenta.vue';
import TarjetaProducto from '~/components/pedidos/TarjetaProducto.vue';

// Intl separa el signo $ del número con un espacio que no se parte entre líneas.
const ESPACIO_FIJO = '\u00a0';
/** @param {string} valor Por ejemplo "38.000". */
const pesos = (valor) => `$${ESPACIO_FIJO}${valor}`;

describe('TarjetaMesa', () => {
  const mesaLibre = { id: 'm1', nombre: 'Mesa 1', capacidad: 4, estado: 'libre' };
  const mesaOcupada = { id: 'm4', nombre: 'Mesa 4', capacidad: 6, estado: 'ocupada' };

  it('una mesa libre muestra su estado con texto, no solo con color', async () => {
    const tarjeta = await mountSuspended(TarjetaMesa, { props: { mesa: mesaLibre } });

    expect(tarjeta.text()).toContain('Libre');
    expect(tarjeta.attributes('aria-label')).toBe('Mesa 1, Libre');
  });

  it('una mesa ocupada resume su tiempo y su total para lectores de pantalla', async () => {
    const tarjeta = await mountSuspended(TarjetaMesa, {
      props: { mesa: mesaOcupada, minutosAbierta: 32, total: '38000' },
    });

    expect(tarjeta.attributes('aria-label')).toBe(`Mesa 4, Ocupada, 32 min, ${pesos('38.000')}`);
  });

  it('se resalta cuando tiene platos listos para llevar', async () => {
    const tarjeta = await mountSuspended(TarjetaMesa, {
      props: { mesa: mesaOcupada, tienePlatosListos: true },
    });

    expect(tarjeta.text()).toContain('¡Listo!');
  });

  it('al tocarla avisa cuál mesa se eligió', async () => {
    const tarjeta = await mountSuspended(TarjetaMesa, { props: { mesa: mesaLibre } });

    await tarjeta.trigger('click');

    expect(tarjeta.emitted('seleccionar')?.[0]).toEqual([mesaLibre]);
  });
});

describe('TarjetaProducto', () => {
  const producto = { id: 'p1', nombre: 'IND Classic Artesanal', precio: '12000' };
  const apariencia = { icono: 'i-lucide-hamburger', fondo: '', texto: '' };

  it('muestra el nombre y el precio en pesos', async () => {
    const tarjeta = await mountSuspended(TarjetaProducto, { props: { producto, apariencia } });

    expect(tarjeta.text()).toContain('IND Classic Artesanal');
    expect(tarjeta.text()).toContain(pesos('12.000'));
  });

  it('tocar la tarjeta agrega el producto; el botón de nota abre las opciones', async () => {
    const tarjeta = await mountSuspended(TarjetaProducto, { props: { producto, apariencia } });
    const [botonAgregar, botonNota] = tarjeta.findAll('button');

    await botonAgregar?.trigger('click');
    await botonNota?.trigger('click');

    expect(tarjeta.emitted('agregar')?.[0]).toEqual([producto]);
    expect(tarjeta.emitted('personalizar')?.[0]).toEqual([producto]);
  });

  it('muestra cuántas unidades van en el pedido', async () => {
    const tarjeta = await mountSuspended(TarjetaProducto, {
      props: { producto, apariencia, cantidad: 2 },
    });

    expect(tarjeta.text()).toContain('×2');
  });
});

describe('ResumenCuenta', () => {
  const items = [
    {
      id: 'i1',
      cantidad: '2',
      precioUnitario: '12000',
      notas: 'Sin cebolla',
      estadoCocina: 'pendiente',
      producto: { nombre: 'IND Classic Artesanal' },
    },
    {
      id: 'i2',
      cantidad: '1',
      precioUnitario: '4000',
      notas: null,
      estadoCocina: 'preparando',
      producto: { nombre: 'Gaseosa personal 400 ml' },
    },
  ];

  it('muestra cada línea con su valor, sus notas y su estado de cocina', async () => {
    const cuenta = await mountSuspended(ResumenCuenta, { props: { items } });

    expect(cuenta.text()).toContain(pesos('24.000'));
    expect(cuenta.text()).toContain('Sin cebolla');
    expect(cuenta.text()).toContain('Pendiente');
    expect(cuenta.text()).toContain('Preparando');
  });

  it('solo deja quitar lo que la cocina todavía no empieza', async () => {
    const cuenta = await mountSuspended(ResumenCuenta, { props: { items } });
    const botonesQuitar = cuenta.findAll('button[aria-label^="Quitar"]');

    expect(botonesQuitar).toHaveLength(1);
    await botonesQuitar[0]?.trigger('click');
    expect(cuenta.emitted('quitar')?.[0]).toEqual([items[0]]);
  });
});

describe('CifraAnimada', () => {
  it('muestra el valor exacto y, al cambiar, termina en el nuevo valor exacto', async () => {
    const cifra = await mountSuspended(CifraAnimada, { props: { valor: '38000' } });
    expect(cifra.text()).toContain(pesos('38.000'));

    await cifra.setProps({ valor: '50000.50' });
    // El lector de pantalla recibe el valor final de inmediato.
    expect(cifra.find('.sr-only').text()).toBe(pesos('50.000,50'));
    // Lo visible termina en el valor exacto, con centavos, cuando acaba la animación.
    await new Promise((resolver) => setTimeout(resolver, 700));
    expect(cifra.find('[aria-hidden="true"]').text()).toBe(pesos('50.000,50'));
  });
});
