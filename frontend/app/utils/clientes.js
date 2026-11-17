// @ts-check
// Lógica de la pantalla de clientes que no depende de la pantalla:
// - Cómo se escribe cada tipo de documento ("CC 1.234.567.890") y lo buscado resaltado en él.
// - La búsqueda (nombre, documento con o sin puntos, o correo) y el índice por letra.
// - Los enlaces para llamar o escribir por WhatsApp a un celular de Colombia.
// - Si un documento ya está registrado (para no crear el mismo cliente dos veces).
// Son funciones puras, sin Vue ni el API, para probarlas fácil (tests/unit/clientes.test.js).
import {
  coincideBusqueda,
  marcasDeBusqueda,
  normalizarTexto,
  partesSegunMarcas,
} from './busqueda.js';

/** @typedef {import('~/stores/clientes.js').Cliente} Cliente */
/** @typedef {Cliente['tipoDocumento']} TipoDocumento */

/**
 * Cada tipo de documento: su sigla, su nombre, su ícono y si es solo de números (los que se
 * escriben con puntos de miles).
 * @type {Readonly<Record<TipoDocumento, { sigla: string, nombre: string, icono: string, numerico: boolean }>>}
 */
export const TIPOS_DE_DOCUMENTO = Object.freeze({
  cc: { sigla: 'CC', nombre: 'Cédula de ciudadanía', icono: 'i-lucide-id-card', numerico: true },
  nit: { sigla: 'NIT', nombre: 'NIT', icono: 'i-lucide-building-2', numerico: true },
  ce: { sigla: 'CE', nombre: 'Cédula de extranjería', icono: 'i-lucide-globe', numerico: true },
  pasaporte: { sigla: 'PA', nombre: 'Pasaporte', icono: 'i-lucide-book-user', numerico: false },
  otro: { sigla: 'DOC', nombre: 'Otro', icono: 'i-lucide-file-text', numerico: false },
});

/** Los tipos de documento en el orden del formulario. */
export const ORDEN_TIPOS_DE_DOCUMENTO = /** @type {TipoDocumento[]} */ (
  Object.keys(TIPOS_DE_DOCUMENTO)
);

/**
 * Las posiciones del texto original que ocupa cada letra del número con puntos de miles:
 * "1234567" → "1.234.567" y [0, null, 1, 2, 3, null, 4, 5, 6] (null = un punto).
 * @param {string} numero Solo dígitos.
 */
function conPuntosDeMiles(numero) {
  let texto = '';
  /** @type {(number | null)[]} */
  const origen = [];
  for (let i = 0; i < numero.length; i += 1) {
    const faltan = numero.length - i;
    if (i > 0 && faltan % 3 === 0) {
      texto += '.';
      origen.push(null);
    }
    texto += numero[i];
    origen.push(i);
  }
  return { texto, origen };
}

/**
 * El número de un documento como se lee en Colombia: con puntos de miles si es solo de
 * números (cédula, NIT, cédula de extranjería) y en mayúsculas si lleva letras.
 * @param {TipoDocumento} tipo
 * @param {string} numero
 */
export function formatearDocumento(tipo, numero) {
  if (TIPOS_DE_DOCUMENTO[tipo]?.numerico && /^\d+$/.test(numero)) {
    return conPuntosDeMiles(numero).texto;
  }
  return numero.toUpperCase();
}

/**
 * El documento completo: "CC 1.234.567.890".
 * @param {Pick<Cliente, 'tipoDocumento' | 'numeroDocumento'>} cliente
 */
export function etiquetaDeDocumento(cliente) {
  const sigla = TIPOS_DE_DOCUMENTO[cliente.tipoDocumento]?.sigla ?? '';
  return `${sigla} ${formatearDocumento(cliente.tipoDocumento, cliente.numeroDocumento)}`.trim();
}

/**
 * El número del documento con puntos, partido en trozos para resaltar lo buscado. Se encuentra
 * igual si se buscó con puntos ("1.234") o sin ellos ("1234").
 * @param {TipoDocumento} tipo
 * @param {string} numero
 * @param {string} busqueda
 */
export function partesDelDocumento(tipo, numero, busqueda) {
  const texto = formatearDocumento(tipo, numero);
  // 1. Lo buscado tal cual, sobre el número con puntos.
  const marcas = marcasDeBusqueda(texto, busqueda);
  // 2. Lo buscado sin puntos, sobre el número original, llevado a sus posiciones con puntos
  //    (un punto se marca si los dígitos de ambos lados lo están).
  if (texto !== numero.toUpperCase()) {
    const sinPuntos = marcasDeBusqueda(numero, sinSeparadores(busqueda));
    const { origen } = conPuntosDeMiles(numero);
    origen.forEach((posicion, i) => {
      if (posicion !== null) marcas[i] ||= sinPuntos[posicion];
      else marcas[i] ||= sinPuntos[origen[i - 1] ?? -1] && sinPuntos[origen[i + 1] ?? -1];
    });
  }
  return partesSegunMarcas(texto, marcas);
}

/**
 * Quita los puntos y espacios que separan dígitos: "1.234.567" → "1234567", "300 123" →
 * "300123". Así se busca un documento como se escriba.
 * @param {string} texto
 */
export function sinSeparadores(texto) {
  return texto.replace(/(?<=\d)[.\s](?=\d)/g, '');
}

/**
 * La búsqueda encuentra al cliente por su nombre, su documento (con o sin puntos) o su correo.
 * @param {Cliente} cliente
 * @param {string} busqueda
 */
export function coincideCliente(cliente, busqueda) {
  const documento = formatearDocumento(cliente.tipoDocumento, cliente.numeroDocumento);
  const texto = `${cliente.nombre} ${cliente.numeroDocumento} ${documento} ${cliente.email ?? ''}`;
  return coincideBusqueda(texto, busqueda) || coincideBusqueda(texto, sinSeparadores(busqueda));
}

/**
 * Orden alfabético en español (sin importar tildes ni mayúsculas).
 * @param {Cliente} a
 * @param {Cliente} b
 */
export function compararClientes(a, b) {
  return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
}

/**
 * La letra del índice de un nombre: "Ángela" → "A", "Ñame" → "Ñ", "3 Hermanos" → "#".
 * @param {string} nombre
 */
export function letraDeIndice(nombre) {
  const primera = nombre.trim().charAt(0);
  if (/ñ/i.test(primera)) return 'Ñ';
  const letra = normalizarTexto(primera).toUpperCase();
  return /^[A-Z]$/.test(letra) ? letra : '#';
}

/**
 * Los clientes en orden alfabético, agrupados por la letra de su nombre.
 * @param {Cliente[]} clientes
 * @returns {{ letra: string, clientes: Cliente[] }[]}
 */
export function agruparPorLetra(clientes) {
  /** @type {{ letra: string, clientes: Cliente[] }[]} */
  const grupos = [];
  for (const cliente of [...clientes].sort(compararClientes)) {
    const letra = letraDeIndice(cliente.nombre);
    const grupo = grupos.find((otro) => otro.letra === letra);
    if (grupo) grupo.clientes.push(cliente);
    else grupos.push({ letra, clientes: [cliente] });
  }
  // "#" (nombres que empiezan con número o símbolo) va al final.
  return grupos.sort((a, b) => (a.letra === '#' ? 1 : b.letra === '#' ? -1 : 0));
}

/**
 * Los dígitos de un teléfono con el indicativo de Colombia (57) si es un número nacional de
 * 10 dígitos: "300 123 4567" → "573001234567"; "+1 555 123 4567" → "15551234567".
 * Da null si no parece un teléfono completo.
 * @param {string | null | undefined} telefono
 */
export function telefonoInternacional(telefono) {
  if (!telefono) return null;
  const digitos = telefono.replace(/\D/g, '');
  if (!telefono.trim().startsWith('+') && digitos.length === 10) return `57${digitos}`;
  return digitos.length >= 10 ? digitos : null;
}

/**
 * Un celular o fijo de Colombia como se lee: "300 123 4567" (si no, tal como se escribió).
 * @param {string} telefono
 */
export function formatearTelefono(telefono) {
  const digitos = telefono.replace(/\D/g, '');
  if (!telefono.trim().startsWith('+') && digitos.length === 10) {
    return `${digitos.slice(0, 3)} ${digitos.slice(3, 6)} ${digitos.slice(6)}`;
  }
  return telefono.trim();
}

/**
 * Enlace para llamar desde el celular, o null si no hay teléfono.
 * @param {string | null | undefined} telefono
 */
export function enlaceParaLlamar(telefono) {
  const completo = telefonoInternacional(telefono);
  if (completo) return `tel:+${completo}`;
  const digitos = telefono?.replace(/\D/g, '') ?? '';
  return digitos.length >= 7 ? `tel:${digitos}` : null;
}

/**
 * Enlace para escribirle por WhatsApp, o null si el teléfono no está completo (con
 * indicativo o de 10 dígitos).
 * @param {string | null | undefined} telefono
 */
export function enlaceDeWhatsApp(telefono) {
  const completo = telefonoInternacional(telefono);
  return completo ? `https://wa.me/${completo}` : null;
}

/**
 * Normaliza un número de documento escrito con puntos o espacios: "1.234.567" → "1234567".
 * @param {string} numero
 */
export function limpiarNumeroDeDocumento(numero) {
  return numero.trim().replace(/[.\s]/g, '');
}

/**
 * El cliente ya registrado con ese tipo y número de documento (el backend no deja repetirlo),
 * sin contar al que se está editando.
 * @param {Cliente[]} clientes
 * @param {{ tipoDocumento: TipoDocumento, numeroDocumento: string }} documento
 * @param {string | null} [idPropio]
 * @returns {Cliente | null}
 */
export function clienteConDocumento(clientes, { tipoDocumento, numeroDocumento }, idPropio = null) {
  const numero = limpiarNumeroDeDocumento(numeroDocumento).toUpperCase();
  if (!numero) return null;
  return (
    clientes.find(
      (cliente) =>
        cliente.id !== idPropio &&
        cliente.tipoDocumento === tipoDocumento &&
        cliente.numeroDocumento.toUpperCase() === numero,
    ) ?? null
  );
}
