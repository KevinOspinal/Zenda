// @ts-check
// Domicilios: en qué etapa va cada uno según su forma de pago, cuánto debe cobrar el
// domiciliario, qué cambio debe llevar, cómo llegar (Google Maps o Waze), el mensaje de
// WhatsApp con los datos de la entrega y lo que cada domiciliario tiene por liquidar.
// El dinero se cuenta con decimal.js; el valor que se cobra lo calcula el backend.
//
// Un domicilio se paga de una de dos formas, elegida al tomarlo:
// - Pago anticipado: se cobra antes de salir y solo sale pagado. Termina al entregarse.
// - Contra entrega: el domiciliario cobra al entregar. Queda "por liquidar" hasta que la caja
//   recibe el dinero.
import { Decimal, aDecimal, formatearPesos, sumar } from './dinero.js';
import { nombreDelPedido } from './pedidos.js';

/** @typedef {'anticipado' | 'contra_entrega'} FormaPagoDomicilio */

/** Cómo paga el cliente el domicilio. */
export const FORMAS_PAGO_DOMICILIO = Object.freeze({
  anticipado: {
    etiqueta: 'Pago anticipado',
    icono: 'i-lucide-wallet-cards',
    descripcion: 'Paga antes de que salga: en la caja o por transferencia.',
  },
  contra_entrega: {
    etiqueta: 'Contra entrega',
    icono: 'i-lucide-hand-coins',
    descripcion: 'Le paga al domiciliario al recibirlo.',
  },
});

/**
 * @typedef {'sin_enviar' | 'en_cocina' | 'por_cobrar' | 'listo_para_salir' | 'en_camino'
 *   | 'por_liquidar' | 'entregado'} EtapaDomicilio
 */

/**
 * Apariencia de cada etapa de un domicilio (color, ícono y texto).
 * @type {Readonly<Record<EtapaDomicilio, import('./estados.js').Apariencia>>}
 */
export const ETAPAS_DOMICILIO = Object.freeze({
  sin_enviar: { etiqueta: 'Sin enviar a cocina', color: 'neutral', icono: 'i-lucide-notebook-pen' },
  en_cocina: { etiqueta: 'En cocina', color: 'warning', icono: 'i-lucide-chef-hat' },
  por_cobrar: { etiqueta: 'Falta cobrar', color: 'warning', icono: 'i-lucide-wallet-cards' },
  listo_para_salir: {
    etiqueta: 'Listo para salir',
    color: 'info',
    icono: 'i-lucide-package-check',
  },
  en_camino: { etiqueta: 'En camino', color: 'primary', icono: 'i-lucide-bike' },
  por_liquidar: { etiqueta: 'Por liquidar', color: 'secondary', icono: 'i-lucide-hand-coins' },
  entregado: { etiqueta: 'Entregado', color: 'success', icono: 'i-lucide-circle-check' },
});

/**
 * Etapa de un domicilio, en el orden en que pasan:
 * - Sin enviar a cocina: todavía se están tomando los productos.
 * - En cocina: algún plato pendiente o preparándose.
 * - Falta cobrar: la cocina lo tiene listo, pero es de pago anticipado y no se ha cobrado
 *   (solo sale pagado).
 * - Listo para salir.
 * - En camino: salió con el domiciliario.
 * - Por liquidar: contra entrega, entregado y sin cobrar (el dinero aún no llega a la caja).
 * - Entregado: terminó.
 * @param {any} pedido Domicilio con sus ítems y su entrega (forma del API).
 * @returns {EtapaDomicilio}
 */
export function etapaDelDomicilio(pedido) {
  const { entrega } = pedido;
  if (entrega?.entregadoEn) return pedido.estado === 'pagado' ? 'entregado' : 'por_liquidar';
  if (entrega?.despachadoEn) return 'en_camino';
  if (!pedido.enviadoACocinaEn) return 'sin_enviar';
  const items = pedido.items ?? [];
  const enPreparacion = items.some(
    (/** @type {any} */ item) =>
      item.estadoCocina === 'pendiente' || item.estadoCocina === 'preparando',
  );
  if (enPreparacion) return 'en_cocina';
  if (entrega?.formaPago === 'anticipado' && pedido.estado !== 'pagado') return 'por_cobrar';
  return 'listo_para_salir';
}

/**
 * Un domicilio contra entrega que aún no sale: no se cobra en la caja, lo cobra el
 * domiciliario al entregarlo (si el cliente ya pagó, se cambia a pago anticipado).
 * @param {any} pedido
 */
export function seCobraAlEntregar(pedido) {
  return (
    pedido.tipo === 'domicilio' &&
    pedido.entrega?.formaPago === 'contra_entrega' &&
    !pedido.entrega?.despachadoEn
  );
}

/**
 * Si el domicilio sigue en curso: no se anuló ni terminó (un contra entrega por liquidar
 * sigue en curso hasta que la caja recibe el dinero).
 * @param {any} pedido
 */
export function estaEnCurso(pedido) {
  return pedido.estado !== 'anulado' && etapaDelDomicilio(pedido) !== 'entregado';
}

/**
 * Lo que tiene cada domiciliario por liquidar: sus domicilios contra entrega entregados y sin
 * cobrar, con el total que debe traer a la caja. El que más debe, primero.
 * @param {any[]} domicilios
 * @returns {{ domiciliario: { id: string, nombre: string }, pedidos: any[],
 *   total: import('./dinero.js').ValorDecimal }[]}
 */
export function porLiquidarPorDomiciliario(domicilios) {
  /** @type {Map<string, { domiciliario: { id: string, nombre: string }, pedidos: any[] }>} */
  const grupos = new Map();
  for (const pedido of domicilios) {
    const domiciliario = pedido.entrega?.domiciliario;
    if (etapaDelDomicilio(pedido) !== 'por_liquidar' || !domiciliario) continue;
    const grupo = grupos.get(domiciliario.id) ?? { domiciliario, pedidos: [] };
    grupo.pedidos.push(pedido);
    grupos.set(domiciliario.id, grupo);
  }
  return [...grupos.values()]
    .map((grupo) => ({ ...grupo, total: sumar(grupo.pedidos.map((pedido) => pedido.total)) }))
    .sort((a, b) => b.total.comparedTo(a.total));
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
 * Mensaje para el domiciliario con lo necesario para llevar el pedido, incluido el enlace para
 * llegar con Google Maps.
 * @param {any} pedido Domicilio con su entrega.
 * @param {string | null} [ciudad] Ciudad del negocio, para encontrar la dirección en el mapa.
 */
export function mensajeParaDomiciliario(pedido, ciudad) {
  const { entrega } = pedido;
  const debe = porCobrarAlEntregar(pedido);
  const cambio = cambioParaLlevar(pedido);
  return [
    `Domicilio ${nombreDelPedido(pedido)}`,
    `Dirección: ${entrega.direccion}`,
    entrega.indicaciones && `Indicaciones: ${entrega.indicaciones}`,
    `Cómo llegar: ${enlaceGoogleMaps(entrega, ciudad)}`,
    `Teléfono del cliente: ${entrega.telefono}`,
    debe.isZero()
      ? 'Ya está pagado: no cobres nada.'
      : `Contra entrega: cobra ${formatearPesos(debe)}`,
    cambio &&
      `Lleva cambio de ${formatearPesos(cambio)} (paga con ${formatearPesos(entrega.pagaCon)})`,
  ]
    .filter(Boolean)
    .join('\n');
}

// ───────────────────────────── Cómo llegar ─────────────────────────────

/**
 * Dirección completa para buscarla en el mapa, con la ciudad del negocio y el país:
 * "Calle 10 # 5-20" existe en muchas ciudades.
 * @param {{ direccion: string }} entrega
 * @param {string | null} [ciudad]
 */
export function direccionParaElMapa(entrega, ciudad) {
  return [entrega.direccion, ciudad, 'Colombia'].filter(Boolean).join(', ');
}

/**
 * Coordenadas que trae un enlace de mapa (?q=lat,lng, ?ll=lat,lng o @lat,lng), o null si no
 * trae (por ejemplo, un enlace corto de maps.app.goo.gl).
 * @param {string} enlace
 */
export function coordenadasDelEnlace(enlace) {
  let texto = enlace;
  try {
    texto = decodeURIComponent(enlace);
  } catch {
    // Un enlace mal codificado se revisa tal como llegó.
  }
  const numero = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
  const encontrado =
    texto.match(new RegExp(`[?&](?:q|ll|query|destination)=${numero},\\s*${numero}`)) ??
    texto.match(new RegExp(`@${numero},${numero}`));
  return encontrado ? { lat: encontrado[1], lng: encontrado[2] } : null;
}

/** @param {string} enlace */
const esDeWaze = (enlace) => /^https:\/\/(www\.|ul\.)?waze\.com\//.test(enlace);

/**
 * Enlace que abre Google Maps con la ruta al cliente: a la ubicación que mandó, si la hay; si
 * no, a la dirección escrita.
 * @param {{ direccion: string, ubicacionUrl?: string | null }} entrega
 * @param {string | null} [ciudad]
 */
export function enlaceGoogleMaps(entrega, ciudad) {
  const ubicacion = entrega.ubicacionUrl;
  const coordenadas = ubicacion ? coordenadasDelEnlace(ubicacion) : null;
  const destino = coordenadas
    ? `${coordenadas.lat},${coordenadas.lng}`
    : direccionParaElMapa(entrega, ciudad);
  // Un enlace de Google sin coordenadas (los cortos de WhatsApp) ya lleva al punto exacto.
  if (ubicacion && !coordenadas && !esDeWaze(ubicacion)) return ubicacion;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
}

/**
 * Enlace que abre Waze con la ruta al cliente: a la ubicación que mandó, si la hay; si no, a
 * la dirección escrita.
 * @param {{ direccion: string, ubicacionUrl?: string | null }} entrega
 * @param {string | null} [ciudad]
 */
export function enlaceWaze(entrega, ciudad) {
  const ubicacion = entrega.ubicacionUrl;
  if (ubicacion && esDeWaze(ubicacion)) return ubicacion;
  const coordenadas = ubicacion ? coordenadasDelEnlace(ubicacion) : null;
  if (coordenadas)
    return `https://waze.com/ul?ll=${coordenadas.lat},${coordenadas.lng}&navigate=yes`;
  return `https://waze.com/ul?q=${encodeURIComponent(direccionParaElMapa(entrega, ciudad))}&navigate=yes`;
}

/**
 * Enlace que abre WhatsApp con el mensaje listo para enviar.
 * @param {string} telefono
 * @param {string} mensaje
 */
export function enlaceWhatsApp(telefono, mensaje) {
  return `https://wa.me/${numeroDeWhatsApp(telefono)}?text=${encodeURIComponent(mensaje)}`;
}
