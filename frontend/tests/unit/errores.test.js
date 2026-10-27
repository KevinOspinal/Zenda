// @ts-check
// Pruebas de la traducción de errores del API a mensajes amables.
import { describe, expect, it } from 'vitest';
import {
  ErrorApi,
  MENSAJE_ERROR_GENERICO,
  crearErrorApi,
  crearErrorSinConexion,
  mensajeDeError,
  requiereIniciarSesion,
} from '../../app/utils/errores.js';

/**
 * Cuerpo de error tal como lo envía el backend.
 * @param {string} code
 * @param {string} message
 */
const cuerpoDelApi = (code, message) => ({ error: { code, message } });

describe('crearErrorApi', () => {
  it('traduce un código conocido y guarda el mensaje técnico aparte', () => {
    const error = crearErrorApi({
      status: 422,
      cuerpo: cuerpoDelApi('PAGO_NO_CUADRA', 'Los pagos suman 28000.00 y deben sumar 31000.00'),
    });

    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.status).toBe(422);
    expect(error.codigo).toBe('PAGO_NO_CUADRA');
    expect(error.message).toBe('Los pagos no suman el total por cobrar. Revisa los valores.');
    expect(error.mensajeTecnico).toContain('28000.00');
  });

  it('usa el mensaje del backend en un 4xx sin traducción (ya está en español)', () => {
    const error = crearErrorApi({
      status: 422,
      cuerpo: cuerpoDelApi('DIVISION_INVALIDA', 'El ítem tiene 2 unidad(es); no se pueden pasar 3'),
    });

    expect(error.message).toBe('El ítem tiene 2 unidad(es); no se pueden pasar 3');
  });

  it('nunca muestra el detalle de un error del servidor (5xx)', () => {
    const error = crearErrorApi({
      status: 500,
      cuerpo: cuerpoDelApi('ALGO_INTERNO', 'connection refused at 10.0.0.3'),
    });

    expect(error.message).toBe(MENSAJE_ERROR_GENERICO);
  });

  it('funciona aunque la respuesta no traiga el formato de error del API', () => {
    const error = crearErrorApi({ status: 502, cuerpo: '<html>Bad Gateway</html>' });

    expect(error.codigo).toBe('HTTP_502');
    expect(error.message).toBe(MENSAJE_ERROR_GENERICO);
  });

  it('en un 429 dice cuántos segundos esperar', () => {
    const error = crearErrorApi({
      status: 429,
      cuerpo: cuerpoDelApi('DEMASIADAS_SOLICITUDES', 'Demasiados intentos'),
      reintentarEnSegundos: 60,
    });

    expect(error.message).toBe('Demasiados intentos. Espera 60 segundos e intenta de nuevo.');
    expect(error.reintentarEnSegundos).toBe(60);
  });
});

describe('mensajeDeError', () => {
  it('cubre los errores frecuentes de la operación', () => {
    expect(mensajeDeError({ status: 401, codigo: 'CREDENCIALES_INVALIDAS' })).toBe(
      'NIT, correo o contraseña incorrectos.',
    );
    expect(mensajeDeError({ status: 409, codigo: 'CAJA_CERRADA' })).toContain('caja está cerrada');
    expect(mensajeDeError({ status: 409, codigo: 'MESA_OCUPADA' })).toBe(
      'Esta mesa ya tiene un pedido abierto.',
    );
    expect(mensajeDeError({ status: 403, codigo: 'SIN_PERMISO' })).toBe(
      'Tu rol no permite esta acción.',
    );
  });

  it('sin código ni mensaje, da el mensaje genérico', () => {
    expect(mensajeDeError({ status: 400 })).toBe(MENSAJE_ERROR_GENERICO);
  });
});

describe('sin conexión y fin de la sesión', () => {
  it('crea un error de conexión con mensaje claro', () => {
    const error = crearErrorSinConexion();

    expect(error.status).toBe(0);
    expect(error.codigo).toBe('SIN_CONEXION');
    expect(error.message).toContain('No hay conexión');
  });

  it('detecta los errores que obligan a ingresar de nuevo', () => {
    const terminada = crearErrorApi({ status: 401, cuerpo: cuerpoDelApi('REFRESH_INVALIDO', '') });
    const expirado = crearErrorApi({ status: 401, cuerpo: cuerpoDelApi('TOKEN_EXPIRADO', '') });

    expect(requiereIniciarSesion(terminada)).toBe(true);
    // Un token vencido se renueva en silencio: no obliga a ingresar de nuevo.
    expect(requiereIniciarSesion(expirado)).toBe(false);
    expect(requiereIniciarSesion(new Error('otro error'))).toBe(false);
  });
});
