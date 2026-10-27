// @ts-check
// Identificadores únicos generados en el dispositivo (por ejemplo, el uuidOffline de un
// pedido: si el mismo pedido llega dos veces, el backend no lo duplica).

/**
 * Genera un UUID v4.
 * crypto.randomUUID solo existe en conexiones seguras (https o localhost). Al abrir la app
 * desde el celular por la IP de la red local (http), no está: se arma con getRandomValues.
 * @returns {string}
 */
export function generarUuid() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  // Marca de versión 4 y variante RFC 4122.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
