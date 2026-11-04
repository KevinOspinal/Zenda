// @ts-check
// Pruebas del cobro por Bre-B: tipos de llave y su validación (igual que el backend), y el QR:
// lo que se dibuja se puede volver a leer con el mismo contenido.
import { encode } from 'uqr';
import { describe, expect, it } from 'vitest';
import {
  esLlaveValida,
  normalizarLlave,
  pareceQrDePago,
  tieneCobroBreB,
  tipoDeLlave,
} from '../../app/utils/breB.js';
import { dibujoDeQr, leerQrDePixeles } from '../../app/utils/qr.js';

/** Contenido de un QR de pago (formato EMVCo, el que usan los QR de los bancos). */
const QR_DEL_BANCO =
  '00020101021126360014CO.COM.BREB.LLA0112@laindustria5204581253031705802CO5912La Industria6004Cali6304AB12';

describe('llaves Bre-B', () => {
  it.each([
    ['3001234567', 'Celular'],
    ['0012345678', 'Código de comercio'],
    ['1234567890', 'Documento'],
    ['@laindustria', 'Llave @'],
    ['pagos@laindustria.co', 'Correo'],
  ])('reconoce %s como %s', (llave, etiqueta) => {
    expect(tipoDeLlave(llave)?.etiqueta).toBe(etiqueta);
  });

  it('la deja como la registran los bancos', () => {
    expect(normalizarLlave(' 300 123 4567 ')).toBe('3001234567');
    expect(normalizarLlave('1.234.567')).toBe('1234567');
    expect(normalizarLlave('Pagos@LaIndustria.co')).toBe('pagos@laindustria.co');
    expect(normalizarLlave('@LaIndustria')).toBe('@LaIndustria');
  });

  it('rechaza lo que no tiene forma de llave', () => {
    expect(esLlaveValida('laindustria')).toBe(false);
    expect(esLlaveValida('@la industria')).toBe(false);
    expect(esLlaveValida('pagos@laindustria')).toBe(false);
    expect(esLlaveValida('300 123 4567')).toBe(true);
  });

  it('sabe si el negocio puede cobrar por Bre-B', () => {
    expect(tieneCobroBreB({ llaveBreB: '@x', qrBreB: null })).toBe(true);
    expect(tieneCobroBreB({ llaveBreB: null, qrBreB: QR_DEL_BANCO })).toBe(true);
    expect(tieneCobroBreB({ llaveBreB: null, qrBreB: null })).toBe(false);
    expect(tieneCobroBreB(null)).toBe(false);
  });

  it('distingue un QR de pago de uno cualquiera', () => {
    expect(pareceQrDePago(QR_DEL_BANCO)).toBe(true);
    expect(pareceQrDePago('https://laindustria.co')).toBe(false);
  });
});

describe('QR', () => {
  it('el trazo cubre exactamente los cuadros negros del código', () => {
    const { data } = encode(QR_DEL_BANCO, { ecc: 'M', border: 2 });
    const negros = data.flat().filter(Boolean).length;

    const { tamano, trazo } = dibujoDeQr(QR_DEL_BANCO);
    // Cada tramo es "M<x> <y>h<largo>v1h-<largo>z": la suma de los largos son los cuadros negros.
    const cubiertos = [...trazo.matchAll(/h(\d+)v1/g)].reduce(
      (suma, [, largo]) => suma + Number(largo),
      0,
    );

    expect(tamano).toBe(data.length);
    expect(cubiertos).toBe(negros);
  });

  it('lo que se dibuja se vuelve a leer con el mismo contenido', async () => {
    // Se pinta el QR en píxeles (4 por cuadro), como quedaría en una captura de pantalla.
    const { data, size } = encode(QR_DEL_BANCO, { ecc: 'M', border: 4 });
    const escala = 4;
    const lado = size * escala;
    const pixeles = new Uint8ClampedArray(lado * lado * 4);
    for (let y = 0; y < lado; y += 1) {
      for (let x = 0; x < lado; x += 1) {
        const negro = data[Math.floor(y / escala)]?.[Math.floor(x / escala)];
        const i = (y * lado + x) * 4;
        pixeles.fill(negro ? 0 : 255, i, i + 3);
        pixeles[i + 3] = 255;
      }
    }

    expect(await leerQrDePixeles(pixeles, lado, lado)).toBe(QR_DEL_BANCO);
  });

  it('una imagen sin QR no da contenido', async () => {
    const blanco = new Uint8ClampedArray(100 * 100 * 4).fill(255);

    expect(await leerQrDePixeles(blanco, 100, 100)).toBeNull();
  });
});
