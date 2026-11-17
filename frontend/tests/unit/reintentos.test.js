// @ts-check
// Pruebas de los reintentos con mala señal: qué se repite, cuántas veces, cuánto se espera y
// cuándo se da por hecha una acción cuyo primer intento sí llegó.
import { describe, expect, it, vi } from 'vitest';
import { ErrorApi, crearErrorApi, crearErrorSinConexion } from '../../app/utils/errores.js';
import {
  LIMITE_DE_REINTENTOS_MS,
  YA_SE_HIZO,
  conReintentos,
  esFallaPasajera,
} from '../../app/utils/reintentos.js';

/**
 * Error del backend con su código.
 * @param {number} status
 * @param {string} code
 */
const errorDelApi = (status, code) =>
  crearErrorApi({ status, cuerpo: { error: { code, message: code } } });

/**
 * Un reloj falso: dormir no espera de verdad, solo adelanta la hora y anota cuánto se esperó.
 * @param {number} [cadaIntentoTardaMs] Lo que tarda cada intento en fallar (por ejemplo, 15 s
 *   si la petición se queda colgada hasta agotar el tiempo).
 */
function relojFalso(cadaIntentoTardaMs = 0) {
  let hora = 0;
  /** @type {number[]} */
  const esperado = [];
  return {
    esperado,
    ahora: () => hora,
    dormir: async (/** @type {number} */ ms) => {
      esperado.push(ms);
      hora += ms;
    },
    /** Lo que tarda un intento. */
    tardar: () => (hora += cadaIntentoTardaMs),
  };
}

/**
 * Lo que conReintentos usa del reloj falso.
 * @param {ReturnType<typeof relojFalso>} reloj
 */
const opcionesDe = (reloj) => ({ ahora: reloj.ahora, dormir: reloj.dormir });

describe('esFallaPasajera', () => {
  it('sin conexión y servidor que no responde (502, 503, 504) se pueden repetir', () => {
    expect(esFallaPasajera(crearErrorSinConexion())).toBe(true);
    expect(esFallaPasajera(errorDelApi(502, 'HTTP_502'))).toBe(true);
    expect(esFallaPasajera(errorDelApi(503, 'HTTP_503'))).toBe(true);
    expect(esFallaPasajera(errorDelApi(504, 'HTTP_504'))).toBe(true);
  });

  it('un error del negocio o del servidor no cambia con repetirlo', () => {
    expect(esFallaPasajera(errorDelApi(409, 'CAJA_CERRADA'))).toBe(false);
    expect(esFallaPasajera(errorDelApi(500, 'INTERNAL_ERROR'))).toBe(false);
    expect(esFallaPasajera(errorDelApi(429, 'DEMASIADAS_SOLICITUDES'))).toBe(false);
    expect(esFallaPasajera(new Error('otra cosa'))).toBe(false);
  });
});

describe('conReintentos', () => {
  it('si sale bien a la primera, no repite ni espera', async () => {
    const reloj = relojFalso();
    const operacion = vi.fn(async () => 'listo');

    expect(await conReintentos(operacion, opcionesDe(reloj))).toBe('listo');
    expect(operacion).toHaveBeenCalledTimes(1);
    expect(reloj.esperado).toEqual([]);
  });

  it('repite una falla de la señal con esperas cada vez más largas hasta que sale bien', async () => {
    const reloj = relojFalso();
    const alReintentar = vi.fn();
    let intentos = 0;
    const operacion = vi.fn(async () => {
      intentos += 1;
      if (intentos < 3) throw crearErrorSinConexion();
      return 'listo';
    });

    expect(await conReintentos(operacion, { ...opcionesDe(reloj), alReintentar })).toBe('listo');
    expect(operacion).toHaveBeenCalledTimes(3);
    expect(reloj.esperado).toEqual([1000, 2000]);
    // Avisa cada reintento: así la pantalla muestra "Enviando… sin señal".
    expect(alReintentar.mock.calls.map(([reintento]) => reintento)).toEqual([1, 2]);
  });

  it('un error del negocio no se repite', async () => {
    const reloj = relojFalso();
    const operacion = vi.fn(async () => {
      throw errorDelApi(409, 'CAJA_CERRADA');
    });

    await expect(conReintentos(operacion, opcionesDe(reloj))).rejects.toMatchObject({
      codigo: 'CAJA_CERRADA',
    });
    expect(operacion).toHaveBeenCalledTimes(1);
  });

  it('sin señal del todo, insiste unos 45 segundos y después lanza el error', async () => {
    const reloj = relojFalso();
    const operacion = vi.fn(async () => {
      throw crearErrorSinConexion();
    });

    await expect(conReintentos(operacion, opcionesDe(reloj))).rejects.toMatchObject({
      codigo: 'SIN_CONEXION',
    });
    // 1 + 2 + 4 + 8 + 15 + 15 = 45 s esperando, en 7 intentos.
    expect(reloj.esperado).toEqual([1000, 2000, 4000, 8000, 15_000, 15_000]);
    expect(operacion).toHaveBeenCalledTimes(7);
    expect(reloj.ahora()).toBeLessThanOrEqual(LIMITE_DE_REINTENTOS_MS);
  });

  it('si cada intento se queda colgado 15 s, el límite se cuenta con ese tiempo', async () => {
    const reloj = relojFalso(15_000);
    const operacion = vi.fn(async () => {
      reloj.tardar();
      throw crearErrorSinConexion();
    });

    await expect(conReintentos(operacion, opcionesDe(reloj))).rejects.toBeInstanceOf(ErrorApi);
    // Falla a los 15 s, reintenta a los 16; falla a los 31, reintenta a los 33; falla a los 48.
    expect(operacion).toHaveBeenCalledTimes(3);
    expect(reloj.esperado).toEqual([1000, 2000]);
  });

  it('en un reintento, "ya no existe" quiere decir que el primer intento sí llegó', async () => {
    const reloj = relojFalso();
    let intentos = 0;
    const operacion = vi.fn(async () => {
      intentos += 1;
      // El primero quitó el producto, pero su respuesta se perdió.
      if (intentos === 1) throw crearErrorSinConexion();
      throw errorDelApi(404, 'ITEM_NO_ENCONTRADO');
    });

    const resultado = await conReintentos(operacion, {
      ...opcionesDe(reloj),
      yaSeHizoSi: ['ITEM_NO_ENCONTRADO'],
    });

    expect(resultado).toBe(YA_SE_HIZO);
    expect(operacion).toHaveBeenCalledTimes(2);
  });

  it('en el primer intento, "ya no existe" sí es un error', async () => {
    const operacion = vi.fn(async () => {
      throw errorDelApi(404, 'ITEM_NO_ENCONTRADO');
    });

    await expect(
      conReintentos(operacion, { ...opcionesDe(relojFalso()), yaSeHizoSi: ['ITEM_NO_ENCONTRADO'] }),
    ).rejects.toMatchObject({ codigo: 'ITEM_NO_ENCONTRADO' });
  });
});
