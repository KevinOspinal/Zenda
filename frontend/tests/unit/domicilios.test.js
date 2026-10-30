// @ts-check
// Pruebas de los domicilios: etapa según la forma de pago, cobro, cambio, mensaje para el
// domiciliario, cómo llegar (Google Maps y Waze) y lo que cada domiciliario tiene por liquidar.
import { describe, expect, it } from 'vitest';
import {
  cambioParaLlevar,
  coordenadasDelEnlace,
  enlaceGoogleMaps,
  enlaceWaze,
  enlaceWhatsApp,
  estaEnCurso,
  etapaDelDomicilio,
  mensajeParaDomiciliario,
  numeroDeWhatsApp,
  porCobrarAlEntregar,
  porLiquidarPorDomiciliario,
  seCobraAlEntregar,
} from '../../app/utils/domicilios.js';

const ESPACIO_FIJO = '\u00a0';
/** @param {string} valor */
const pesos = (valor) => `$${ESPACIO_FIJO}${valor}`;

/**
 * Domicilio de $15.000 sin cobrar, enviado a cocina, con un plato en ese estado.
 * @param {Record<string, unknown>} [cambios]
 * @param {Record<string, unknown>} [entrega]
 */
const domicilio = (cambios = {}, entrega = {}) => ({
  tipo: 'domicilio',
  numero: 15,
  nombreCliente: 'Juan',
  estado: 'enviado_a_cocina',
  total: '15000',
  enviadoACocinaEn: '2026-10-27T18:00:00.000Z',
  items: [{ estadoCocina: 'preparando' }],
  entrega: {
    direccion: 'Calle 10 # 5-20',
    indicaciones: 'Apto 302',
    telefono: '3109876543',
    formaPago: 'contra_entrega',
    pagaCon: '50000',
    despachadoEn: null,
    entregadoEn: null,
    ...entrega,
  },
  ...cambios,
});

describe('etapaDelDomicilio', () => {
  it('sin enviar a cocina, en cocina, listo para salir y en camino', () => {
    expect(etapaDelDomicilio(domicilio({ enviadoACocinaEn: null }))).toBe('sin_enviar');
    expect(etapaDelDomicilio(domicilio())).toBe('en_cocina');
    expect(etapaDelDomicilio(domicilio({ items: [{ estadoCocina: 'listo' }] }))).toBe(
      'listo_para_salir',
    );
    expect(etapaDelDomicilio(domicilio({}, { despachadoEn: '2026-10-27T18:30:00.000Z' }))).toBe(
      'en_camino',
    );
  });

  it('pago anticipado: listo pero sin cobrar, falta cobrar (solo sale pagado)', () => {
    const anticipado = domicilio(
      { items: [{ estadoCocina: 'listo' }] },
      { formaPago: 'anticipado' },
    );

    expect(etapaDelDomicilio(anticipado)).toBe('por_cobrar');
    expect(etapaDelDomicilio({ ...anticipado, estado: 'pagado' })).toBe('listo_para_salir');
  });

  it('entregado: contra entrega sin cobrar queda por liquidar; cobrado, termina', () => {
    const entregado = {
      despachadoEn: '2026-10-27T18:30:00.000Z',
      entregadoEn: '2026-10-27T19:00:00.000Z',
    };

    expect(etapaDelDomicilio(domicilio({}, entregado))).toBe('por_liquidar');
    expect(etapaDelDomicilio(domicilio({ estado: 'pagado' }, entregado))).toBe('entregado');
    expect(estaEnCurso(domicilio({}, entregado))).toBe(true);
    expect(estaEnCurso(domicilio({ estado: 'pagado' }, entregado))).toBe(false);
    expect(estaEnCurso(domicilio({ estado: 'anulado' }))).toBe(false);
  });

  it('contra entrega se cobra al entregar: no antes de que salga', () => {
    expect(seCobraAlEntregar(domicilio())).toBe(true);
    expect(seCobraAlEntregar(domicilio({}, { despachadoEn: '2026-10-27T18:30:00.000Z' }))).toBe(
      false,
    );
    expect(seCobraAlEntregar(domicilio({}, { formaPago: 'anticipado' }))).toBe(false);
  });
});

describe('por liquidar', () => {
  it('agrupa por domiciliario lo que trae, el que más debe primero', () => {
    const entregadoPor = (/** @type {string} */ id, /** @type {string} */ nombre) => ({
      despachadoEn: '2026-10-27T18:30:00.000Z',
      entregadoEn: '2026-10-27T19:00:00.000Z',
      domiciliario: { id, nombre },
    });
    const grupos = porLiquidarPorDomiciliario([
      domicilio({ total: '15000' }, entregadoPor('p', 'Pedro')),
      domicilio({ total: '20000' }, entregadoPor('a', 'Ana')),
      domicilio({ total: '12000' }, entregadoPor('p', 'Pedro')),
      // En camino o ya liquidado: no cuentan.
      domicilio({ total: '9000' }, { despachadoEn: '2026-10-27T18:30:00.000Z' }),
      domicilio({ total: '9000', estado: 'pagado' }, entregadoPor('a', 'Ana')),
    ]);

    expect(
      grupos.map((g) => [g.domiciliario.nombre, g.pedidos.length, g.total.toFixed(0)]),
    ).toEqual([
      ['Pedro', 2, '27000'],
      ['Ana', 1, '20000'],
    ]);
  });
});

describe('cómo llegar', () => {
  const entrega = { direccion: 'Calle 10 # 5-20' };

  it('sin ubicación, busca la dirección con la ciudad del negocio', () => {
    expect(enlaceGoogleMaps(entrega, 'El Cerrito')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Calle%2010%20%23%205-20%2C%20El%20Cerrito%2C%20Colombia',
    );
    expect(enlaceWaze(entrega, 'El Cerrito')).toBe(
      'https://waze.com/ul?q=Calle%2010%20%23%205-20%2C%20El%20Cerrito%2C%20Colombia&navigate=yes',
    );
  });

  it('con la ubicación que mandó el cliente, va al punto exacto', () => {
    const conPunto = { ...entrega, ubicacionUrl: 'https://maps.google.com/?q=3.6587,-76.2455' };

    expect(enlaceGoogleMaps(conPunto, 'Cali')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=3.6587%2C-76.2455',
    );
    expect(enlaceWaze(conPunto, 'Cali')).toBe(
      'https://waze.com/ul?ll=3.6587,-76.2455&navigate=yes',
    );
  });

  it('un enlace corto de WhatsApp se abre tal cual en Google Maps; uno de Waze, en Waze', () => {
    const corto = { ...entrega, ubicacionUrl: 'https://maps.app.goo.gl/AbC123' };
    const deWaze = { ...entrega, ubicacionUrl: 'https://waze.com/ul?ll=3.65,-76.24' };

    expect(enlaceGoogleMaps(corto, 'Cali')).toBe('https://maps.app.goo.gl/AbC123');
    expect(enlaceWaze(deWaze, 'Cali')).toBe('https://waze.com/ul?ll=3.65,-76.24');
    // Waze no abre un enlace corto de Google: usa la dirección escrita.
    expect(enlaceWaze(corto, 'Cali')).toContain('q=Calle%2010');
  });

  it('lee las coordenadas de los enlaces más comunes', () => {
    expect(
      coordenadasDelEnlace('https://www.google.com/maps/place/X/@3.6587,-76.2455,17z'),
    ).toEqual({ lat: '3.6587', lng: '-76.2455' });
    expect(coordenadasDelEnlace('https://www.google.com/maps?q=4.6%2C%20-74.08')).toEqual({
      lat: '4.6',
      lng: '-74.08',
    });
    expect(coordenadasDelEnlace('https://maps.app.goo.gl/AbC123')).toBeNull();
  });
});

describe('cobro y cambio', () => {
  it('sin cobrar, el domiciliario cobra el total y lleva el cambio', () => {
    expect(porCobrarAlEntregar(domicilio()).toFixed(0)).toBe('15000');
    expect(cambioParaLlevar(domicilio())?.toFixed(0)).toBe('35000');
  });

  it('ya pagado (por transferencia) no cobra ni lleva cambio', () => {
    const pagado = domicilio({ estado: 'pagado' });
    expect(porCobrarAlEntregar(pagado).isZero()).toBe(true);
    expect(cambioParaLlevar(pagado)).toBeNull();
  });

  it('si paga justo o no dijo con cuánto, no lleva cambio', () => {
    expect(cambioParaLlevar(domicilio({}, { pagaCon: '15000' }))).toBeNull();
    expect(cambioParaLlevar(domicilio({}, { pagaCon: null }))).toBeNull();
  });
});

describe('WhatsApp', () => {
  it('a los celulares de Colombia les antepone el 57', () => {
    expect(numeroDeWhatsApp('310 987 6543')).toBe('573109876543');
    expect(numeroDeWhatsApp('+57 310 987 6543')).toBe('573109876543');
    // Un fijo con indicativo ya viene completo.
    expect(numeroDeWhatsApp('6012345678')).toBe('6012345678');
  });

  it('el mensaje trae lo necesario para llevar el pedido, con el enlace para llegar', () => {
    expect(mensajeParaDomiciliario(domicilio(), 'Cali')).toBe(
      [
        'Domicilio #15 · Juan',
        'Dirección: Calle 10 # 5-20',
        'Indicaciones: Apto 302',
        'Cómo llegar: https://www.google.com/maps/dir/?api=1&destination=Calle%2010%20%23%205-20%2C%20Cali%2C%20Colombia',
        'Teléfono del cliente: 3109876543',
        `Contra entrega: cobra ${pesos('15.000')}`,
        `Lleva cambio de ${pesos('35.000')} (paga con ${pesos('50.000')})`,
      ].join('\n'),
    );
    expect(mensajeParaDomiciliario(domicilio({ estado: 'pagado' }))).toContain(
      'Ya está pagado: no cobres nada.',
    );
  });

  it('el enlace abre el chat del domiciliario con el mensaje listo', () => {
    expect(enlaceWhatsApp('3001234567', 'Hola mundo')).toBe(
      'https://wa.me/573001234567?text=Hola%20mundo',
    );
  });
});
