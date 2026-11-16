// @ts-check
// Pruebas de la lógica de la pantalla de clientes: el documento con puntos y lo buscado
// resaltado en él, la búsqueda, el índice por letra, los enlaces para llamar y escribir por
// WhatsApp y el documento ya registrado.
import { describe, expect, it } from 'vitest';
import {
  agruparPorLetra,
  clienteConDocumento,
  coincideCliente,
  enlaceDeWhatsApp,
  enlaceParaLlamar,
  etiquetaDeDocumento,
  formatearDocumento,
  formatearTelefono,
  letraDeIndice,
  limpiarNumeroDeDocumento,
  partesDelDocumento,
} from '../../app/utils/clientes.js';

/**
 * @param {Partial<import('../../app/stores/clientes.js').Cliente>} datos
 * @returns {import('../../app/stores/clientes.js').Cliente}
 */
const cliente = (datos) => ({
  id: 'c1',
  tipoDocumento: 'cc',
  numeroDocumento: '1234567890',
  nombre: 'Pedro Gómez',
  email: null,
  telefono: null,
  ...datos,
});

/** Lo resaltado de unas partes, unido: [{ "1.2", true }, { "3", false }] → "1.2". */
const resaltado = (/** @type {{ texto: string, coincide: boolean }[]} */ partes) =>
  partes
    .filter((parte) => parte.coincide)
    .map((parte) => parte.texto)
    .join('|');

describe('documento', () => {
  it('la cédula, el NIT y la cédula de extranjería llevan puntos de miles', () => {
    expect(formatearDocumento('cc', '1234567890')).toBe('1.234.567.890');
    expect(formatearDocumento('nit', '900111222')).toBe('900.111.222');
    expect(formatearDocumento('ce', '123')).toBe('123');
    expect(formatearDocumento('pasaporte', 'ab123456')).toBe('AB123456');
    expect(etiquetaDeDocumento(cliente({}))).toBe('CC 1.234.567.890');
    expect(
      etiquetaDeDocumento(cliente({ tipoDocumento: 'pasaporte', numeroDocumento: 'x9' })),
    ).toBe('PA X9');
  });

  it('resalta lo buscado en el número con puntos, se busque con puntos o sin ellos', () => {
    expect(resaltado(partesDelDocumento('cc', '1234567890', '2345'))).toBe('234.5');
    expect(resaltado(partesDelDocumento('cc', '1234567890', '1.234'))).toBe('1.234');
    expect(resaltado(partesDelDocumento('cc', '1234567890', 'pedro'))).toBe('');
    expect(resaltado(partesDelDocumento('pasaporte', 'ab123', 'b12'))).toBe('B12');
  });

  it('limpia los puntos y espacios con que se escribió el número', () => {
    expect(limpiarNumeroDeDocumento(' 1.234.567 890 ')).toBe('1234567890');
  });
});

describe('búsqueda e índice', () => {
  it('encuentra por nombre sin tildes, por documento con o sin puntos y por correo', () => {
    const pedro = cliente({ email: 'pedro@correo.test' });
    expect(coincideCliente(pedro, 'gomez')).toBe(true);
    expect(coincideCliente(pedro, '1234567')).toBe(true);
    expect(coincideCliente(pedro, '1.234.567')).toBe(true);
    expect(coincideCliente(pedro, '1 234 567')).toBe(true);
    expect(coincideCliente(pedro, 'correo.test')).toBe(true);
    expect(coincideCliente(pedro, 'ana')).toBe(false);
  });

  it('la letra del índice ignora tildes, deja la Ñ aparte y junta lo que no es letra en #', () => {
    expect(letraDeIndice('Ángela')).toBe('A');
    expect(letraDeIndice('ñame')).toBe('Ñ');
    expect(letraDeIndice('3 Hermanos')).toBe('#');
  });

  it('agrupa por letra en orden alfabético, con # al final', () => {
    const clientes = [
      cliente({ id: '1', nombre: 'Pedro' }),
      cliente({ id: '2', nombre: '3 Hermanos SAS' }),
      cliente({ id: '3', nombre: 'Ángela' }),
      cliente({ id: '4', nombre: 'Andrés' }),
      cliente({ id: '5', nombre: 'pablo' }),
    ];
    expect(
      agruparPorLetra(clientes).map((g) => [g.letra, g.clientes.map((c) => c.nombre)]),
    ).toEqual([
      ['A', ['Andrés', 'Ángela']],
      ['P', ['pablo', 'Pedro']],
      ['#', ['3 Hermanos SAS']],
    ]);
  });
});

describe('teléfono', () => {
  it('un celular de Colombia se lee en grupos y se llama o escribe con el 57', () => {
    expect(formatearTelefono('3001234567')).toBe('300 123 4567');
    expect(enlaceParaLlamar('300 123 4567')).toBe('tel:+573001234567');
    expect(enlaceDeWhatsApp('300 123 4567')).toBe('https://wa.me/573001234567');
  });

  it('respeta el indicativo escrito y no arma WhatsApp con números incompletos', () => {
    expect(enlaceDeWhatsApp('+1 555 123 4567')).toBe('https://wa.me/15551234567');
    expect(formatearTelefono('+1 555 123 4567')).toBe('+1 555 123 4567');
    expect(enlaceDeWhatsApp('6012345')).toBeNull();
    expect(enlaceParaLlamar('6012345')).toBe('tel:6012345');
    expect(enlaceParaLlamar(null)).toBeNull();
  });
});

describe('clienteConDocumento', () => {
  const clientes = [
    cliente({ id: 'c1' }),
    cliente({ id: 'c2', tipoDocumento: 'nit', numeroDocumento: '900111222' }),
  ];

  it('encuentra al cliente con el mismo tipo y número, aunque se escriba con puntos', () => {
    expect(
      clienteConDocumento(clientes, { tipoDocumento: 'cc', numeroDocumento: '1.234.567.890' })?.id,
    ).toBe('c1');
    expect(
      clienteConDocumento(clientes, { tipoDocumento: 'nit', numeroDocumento: '1234567890' }),
    ).toBeNull();
  });

  it('no cuenta al cliente que se está editando', () => {
    expect(
      clienteConDocumento(clientes, { tipoDocumento: 'cc', numeroDocumento: '1234567890' }, 'c1'),
    ).toBeNull();
  });
});
