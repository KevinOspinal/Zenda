// @ts-check
// Pruebas de los domicilios en la caja: etapa, cobro, cambio y mensaje para el domiciliario.
import { describe, expect, it } from 'vitest';
import {
  cambioParaLlevar,
  enlaceWhatsApp,
  etapaDelDomicilio,
  mensajeParaDomiciliario,
  numeroDeWhatsApp,
  porCobrarAlEntregar,
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
    pagaCon: '50000',
    despachadoEn: null,
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

  it('el mensaje trae lo necesario para llevar el pedido', () => {
    expect(mensajeParaDomiciliario(domicilio())).toBe(
      [
        'Domicilio #15 · Juan',
        'Dirección: Calle 10 # 5-20',
        'Indicaciones: Apto 302',
        'Teléfono del cliente: 3109876543',
        `Cobrar: ${pesos('15.000')}`,
        `Lleva cambio de ${pesos('35.000')} (paga con ${pesos('50.000')})`,
      ].join('\n'),
    );
    expect(mensajeParaDomiciliario(domicilio({ estado: 'pagado' }))).toContain('Ya está pagado.');
  });

  it('el enlace abre el chat del domiciliario con el mensaje listo', () => {
    expect(enlaceWhatsApp('3001234567', 'Hola mundo')).toBe(
      'https://wa.me/573001234567?text=Hola%20mundo',
    );
  });
});
