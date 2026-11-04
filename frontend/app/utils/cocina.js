// @ts-check
// Reglas del tablero de cocina: en qué columna va cada comanda, cuánto lleva esperando y
// cuál es el siguiente paso de cada plato. También, qué cambios de un pedido se le avisan a
// la cocina (platos agregados a una comanda o un pedido anulado).
import { formatearCantidad } from './dinero.js';
import { minutosTranscurridos } from './fechas.js';

/** @typedef {'pendiente' | 'preparando' | 'listo' | 'entregado'} EstadoCocina */
/** @typedef {{ estadoCocina: EstadoCocina, creadoEn: string }} ItemDeComanda */

/** Orden de los estados de cocina: un plato solo avanza, nunca retrocede. */
export const ORDEN_COCINA = Object.freeze(['pendiente', 'preparando', 'listo', 'entregado']);

/** Un plato agregado a la comanda más de este tiempo después se marca como "Agregado". */
const AGREGADO_DESPUES_MS = 60_000;

/**
 * Siguiente estado de un plato al tocarlo en la cocina. Null si ya no avanza más.
 * @param {EstadoCocina} estado
 * @returns {EstadoCocina | null}
 */
export function siguienteEstadoCocina(estado) {
  const posicion = ORDEN_COCINA.indexOf(estado);
  if (posicion < 0 || posicion >= ORDEN_COCINA.length - 1) return null;
  return /** @type {EstadoCocina} */ (ORDEN_COCINA[posicion + 1]);
}

/**
 * Columna del tablero en la que va una comanda, según sus platos:
 * - Pendiente: hay platos sin empezar y ninguno en preparación.
 * - Preparando: la cocina ya empezó y aún falta algo.
 * - Listo: todo lo que falta entregar está listo.
 * Null si todos los platos se entregaron (la comanda sale del tablero).
 * @param {ItemDeComanda[]} items
 * @returns {'pendiente' | 'preparando' | 'listo' | null}
 */
export function columnaDeComanda(items) {
  const porEntregar = items.filter((item) => item.estadoCocina !== 'entregado');
  if (porEntregar.length === 0) return null;

  /** @param {EstadoCocina} estado */
  const hay = (estado) => porEntregar.some((item) => item.estadoCocina === estado);
  if (hay('pendiente') && !hay('preparando')) return 'pendiente';
  if (hay('pendiente') || hay('preparando')) return 'preparando';
  return 'listo';
}

/**
 * Minutos que lleva esperando una comanda: desde el plato más antiguo que todavía falta
 * (pendiente o en preparación). Si ya todo está listo, desde el primer plato.
 * @param {ItemDeComanda[]} items
 * @param {Date | string | number} [ahora]
 */
export function minutosDeEspera(items, ahora = new Date()) {
  const porHacer = items.filter(
    (item) => item.estadoCocina === 'pendiente' || item.estadoCocina === 'preparando',
  );
  const base = porHacer.length > 0 ? porHacer : items;
  if (base.length === 0) return 0;
  const masAntiguo = base.reduce(
    (antiguo, item) => (item.creadoEn < antiguo ? item.creadoEn : antiguo),
    base[0].creadoEn,
  );
  return minutosTranscurridos(masAntiguo, ahora);
}

/**
 * Indica si un plato se agregó después de que empezó la comanda (más de un minuto después
 * del primero). La cocina lo ve marcado para no pasarlo por alto.
 * @param {ItemDeComanda} item
 * @param {ItemDeComanda[]} items Todos los platos de la comanda.
 */
export function esAgregadoDespues(item, items) {
  const primero = items.reduce(
    (antiguo, otro) => (otro.creadoEn < antiguo ? otro.creadoEn : antiguo),
    item.creadoEn,
  );
  return new Date(item.creadoEn).getTime() - new Date(primero).getTime() > AGREGADO_DESPUES_MS;
}

/**
 * @typedef {object} ComandaDelTablero
 * @property {any} pedido Pedido con sus ítems (forma del API).
 * @property {any[]} items Platos por entregar, en el orden en que se pidieron.
 * @property {number} minutos Minutos de espera (ver minutosDeEspera).
 */

/**
 * Arma las tres columnas del tablero de cocina con los pedidos enviados a la cocina, también
 * los ya cobrados que tienen platos por entregar. En cada columna, la comanda que más lleva
 * esperando va primero.
 * @param {any[]} pedidos Comandas con sus ítems (ver `comandas` en el store de pedidos).
 * @param {Date | string | number} [ahora]
 * @returns {Record<'pendiente' | 'preparando' | 'listo', ComandaDelTablero[]>}
 */
export function armarTablero(pedidos, ahora = new Date()) {
  /** @type {Record<'pendiente' | 'preparando' | 'listo', ComandaDelTablero[]>} */
  const tablero = { pendiente: [], preparando: [], listo: [] };

  for (const pedido of pedidos) {
    if (pedido.estado !== 'enviado_a_cocina' && pedido.estado !== 'pagado') continue;
    const items = pedido.items ?? [];
    const columna = columnaDeComanda(items);
    if (!columna) continue;
    tablero[columna].push({
      pedido,
      items: items.filter((/** @type {any} */ item) => item.estadoCocina !== 'entregado'),
      minutos: minutosDeEspera(items, ahora),
    });
  }

  for (const comandas of Object.values(tablero)) comandas.sort((a, b) => b.minutos - a.minutos);
  return tablero;
}

/**
 * La comanda está en el tablero de la cocina: se envió (aunque ya esté cobrada) y le falta
 * algún plato por entregar.
 * @param {any} pedido Pedido con sus ítems (forma del API).
 */
export function estaEnElTablero(pedido) {
  const enviado =
    pedido.estado === 'enviado_a_cocina' ||
    (pedido.estado === 'pagado' && Boolean(pedido.enviadoACocinaEn));
  return enviado && columnaDeComanda(pedido.items ?? []) !== null;
}

/**
 * Platos que llegaron a una comanda que ya estaba en la cocina (se agregaron después de
 * enviarla): van directo al tablero, así que la cocina recibe un aviso. Vacío si el pedido no
 * estaba en la cocina o si no llegó nada nuevo (por ejemplo, si quitaron un plato).
 * @template {{ id: string }} Item
 * @param {any | null} anterior El pedido como lo tenía este dispositivo.
 * @param {{ items?: Item[] }} actualizado La comanda que llegó en vivo.
 * @returns {Item[]}
 */
export function platosAgregadosALaComanda(anterior, actualizado) {
  if (anterior?.estado !== 'enviado_a_cocina') return [];
  const yaEstaban = new Set((anterior.items ?? []).map((/** @type {any} */ item) => item.id));
  return (actualizado.items ?? []).filter((item) => !yaEstaban.has(item.id));
}

/**
 * Los platos en una línea, para un aviso: "2× Gaseosa personal · 1× Papas a la francesa".
 * @param {{ producto: string, cantidad: string | number }[]} items Platos como llegan en vivo.
 */
export function listaDePlatos(items) {
  return items.map((item) => `${formatearCantidad(item.cantidad)}× ${item.producto}`).join(' · ');
}
