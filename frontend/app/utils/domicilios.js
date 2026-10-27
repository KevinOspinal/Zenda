// @ts-check
// Domicilios en la caja: en qué etapa va cada uno, cuánto debe cobrar el domiciliario, qué
// cambio debe llevar y el mensaje de WhatsApp con los datos de la entrega.
// El dinero se cuenta con decimal.js; el valor que se cobra lo calcula el backend.
import { Decimal, aDecimal, formatearPesos } from './dinero.js';
import { nombreDelPedido } from './pedidos.js';

/** @typedef {'sin_enviar' | 'en_cocina' | 'listo_para_salir' | 'en_camino'} EtapaDomicilio */

/**
 * Apariencia de cada etapa de un domicilio sin entregar (color, ícono y texto).
 * @type {Readonly<Record<EtapaDomicilio, import('./estados.js').Apariencia>>}
 */
export const ETAPAS_DOMICILIO = Object.freeze({
  sin_enviar: { etiqueta: 'Sin enviar a cocina', color: 'neutral', icono: 'i-lucide-notebook-pen' },
  en_cocina: { etiqueta: 'En cocina', color: 'warning', icono: 'i-lucide-chef-hat' },
  listo_para_salir: {
    etiqueta: 'Listo para salir',
    color: 'info',
    icono: 'i-lucide-package-check',
  },
  en_camino: { etiqueta: 'En camino', color: 'primary', icono: 'i-lucide-bike' },
});

/**
 * Etapa de un domicilio sin entregar:
 * - En camino: ya salió con el domiciliario.
 * - Sin enviar a cocina: todavía se están tomando los productos.
 * - Listo para salir: ningún plato pendiente ni preparándose.
 * - En cocina: lo demás.
 * @param {any} pedido Domicilio con sus ítems y su entrega (forma del API).
 * @returns {EtapaDomicilio}
 */
export function etapaDelDomicilio(pedido) {
  if (pedido.entrega?.despachadoEn) return 'en_camino';
  if (!pedido.enviadoACocinaEn) return 'sin_enviar';
  const items = pedido.items ?? [];
  const enPreparacion = items.some(
    (/** @type {any} */ item) =>
      item.estadoCocina === 'pendiente' || item.estadoCocina === 'preparando',
  );
  return enPreparacion ? 'en_cocina' : 'listo_para_salir';
}

/**
 * Lo que el domiciliario debe cobrarle al cliente: el total si no se ha pagado; nada si ya
 * se pagó (por ejemplo, por transferencia).
 * @param {{ estado: string, total: string }} pedido
 */
export function porCobrarAlEntregar(pedido) {
  return pedido.estado === 'pagado' ? new Decimal(0) : aDecimal(pedido.total);
}

/**
 * Cambio que debe llevar el domiciliario: con cuánto paga el cliente menos lo que debe.
 * Null si no hay que llevar cambio.
 * @param {{ estado: string, total: string, entrega?: { pagaCon?: string | null } | null }} pedido
 */
export function cambioParaLlevar(pedido) {
  const pagaCon = pedido.entrega?.pagaCon;
  const debe = porCobrarAlEntregar(pedido);
  if (!pagaCon || debe.isZero()) return null;
  const cambio = aDecimal(pagaCon).minus(debe);
  return cambio.greaterThan(0) ? cambio : null;
}

/**
 * Número para WhatsApp: solo dígitos y con indicativo. Los celulares de Colombia tienen 10
 * dígitos y empiezan por 3: se les antepone el 57.
 * @param {string} telefono
 */
export function numeroDeWhatsApp(telefono) {
  const digitos = telefono.replace(/\D/g, '');
  return digitos.length === 10 && digitos.startsWith('3') ? `57${digitos}` : digitos;
}

/**
 * Mensaje para el domiciliario con lo necesario para llevar el pedido.
 * @param {any} pedido Domicilio con su entrega.
 */
export function mensajeParaDomiciliario(pedido) {
  const { entrega } = pedido;
  const debe = porCobrarAlEntregar(pedido);
  const cambio = cambioParaLlevar(pedido);
  return [
    `Domicilio ${nombreDelPedido(pedido)}`,
    `Dirección: ${entrega.direccion}`,
    entrega.indicaciones && `Indicaciones: ${entrega.indicaciones}`,
    `Teléfono del cliente: ${entrega.telefono}`,
    debe.isZero() ? 'Ya está pagado.' : `Cobrar: ${formatearPesos(debe)}`,
    cambio &&
      `Lleva cambio de ${formatearPesos(cambio)} (paga con ${formatearPesos(entrega.pagaCon)})`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Enlace que abre WhatsApp con el mensaje listo para enviar.
 * @param {string} telefono
 * @param {string} mensaje
 */
export function enlaceWhatsApp(telefono, mensaje) {
  return `https://wa.me/${numeroDeWhatsApp(telefono)}?text=${encodeURIComponent(mensaje)}`;
}
