// @ts-check
// Cobro por Bre-B (transferencias inmediatas entre bancos): tipos de llave y su validación,
// igual que en el backend. La validación aquí solo da respuesta inmediata en el formulario;
// la que manda es la del API.

/**
 * Formatos de las llaves Bre-B, según el Banco de la República. El orden importa: un número de
 * 10 dígitos que empieza en 3 se toma como celular aunque también pueda ser un documento.
 */
const TIPOS_DE_LLAVE = Object.freeze([
  { tipo: 'celular', etiqueta: 'Celular', formato: /^3\d{9}$/ },
  { tipo: 'comercio', etiqueta: 'Código de comercio', formato: /^00\d{8}$/ },
  { tipo: 'documento', etiqueta: 'Documento', formato: /^(?=.*\d)[A-Za-z0-9]{5,18}$/ },
  { tipo: 'alfanumerica', etiqueta: 'Llave @', formato: /^@[A-Za-z0-9._-]{1,40}$/ },
  { tipo: 'correo', etiqueta: 'Correo', formato: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
]);

/**
 * Deja la llave como la registran los bancos (igual que el backend): los números sin espacios,
 * puntos ni guiones ("300 123 4567" → "3001234567") y el correo en minúsculas.
 * @param {string} llave
 */
export function normalizarLlave(llave) {
  const limpia = llave.trim();
  const soloNumeros = limpia.replace(/[\s.-]/g, '');
  if (/^\d+$/.test(soloNumeros)) return soloNumeros;
  if (limpia.includes('@') && !limpia.startsWith('@')) return limpia.toLowerCase();
  return limpia;
}

/**
 * Qué tipo de llave es, para mostrarlo junto a ella ("Celular", "Llave @"...).
 * @param {string} llave Llave ya normalizada.
 * @returns {{ tipo: string, etiqueta: string } | null} null si no tiene forma de llave Bre-B.
 */
export function tipoDeLlave(llave) {
  const encontrado = TIPOS_DE_LLAVE.find(({ formato }) => formato.test(llave));
  return encontrado ? { tipo: encontrado.tipo, etiqueta: encontrado.etiqueta } : null;
}

/** @param {string} llave */
export function esLlaveValida(llave) {
  return llave.length <= 100 && tipoDeLlave(normalizarLlave(llave)) !== null;
}

/**
 * Los QR de pago de los bancos (formato EMVCo) siempre empiezan por "000201". Si el QR que
 * sube el negocio no, probablemente no es el de cobro (por ejemplo, el de una página web).
 * @param {string} contenido
 */
export function pareceQrDePago(contenido) {
  return contenido.startsWith('000201');
}

/**
 * Si el negocio tiene con qué cobrar por Bre-B.
 * @param {{ llaveBreB?: string | null, qrBreB?: string | null } | null | undefined} negocio
 */
export function tieneCobroBreB(negocio) {
  return Boolean(negocio?.llaveBreB || negocio?.qrBreB);
}
