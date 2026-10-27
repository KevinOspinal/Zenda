// @ts-check
// Cómo se nombra y se reconoce un pedido según su tipo: de mesa, de mostrador o a domicilio.
// Los que no tienen mesa se identifican con su número del día y el nombre del cliente.

/** @typedef {'mesa' | 'mostrador' | 'domicilio'} TipoPedido */
/** @typedef {'local' | 'whatsapp' | 'telefono' | 'otro'} OrigenPedido */

/** @type {Readonly<Record<TipoPedido, { etiqueta: string, icono: string }>>} */
export const TIPOS_PEDIDO = Object.freeze({
  mesa: { etiqueta: 'Mesa', icono: 'i-lucide-armchair' },
  mostrador: { etiqueta: 'Mostrador', icono: 'i-lucide-shopping-bag' },
  domicilio: { etiqueta: 'Domicilio', icono: 'i-lucide-bike' },
});

/** Por dónde llegó el pedido. @type {Readonly<Record<OrigenPedido, { etiqueta: string, icono: string }>>} */
export const ORIGENES_PEDIDO = Object.freeze({
  local: { etiqueta: 'En el local', icono: 'i-lucide-store' },
  whatsapp: { etiqueta: 'WhatsApp', icono: 'i-lucide-message-circle' },
  telefono: { etiqueta: 'Teléfono', icono: 'i-lucide-phone' },
  otro: { etiqueta: 'Otro', icono: 'i-lucide-globe' },
});

/**
 * Tipo de un pedido. Los que vienen sin tipo (datos anteriores) se deducen de la mesa.
 * @param {{ tipo?: TipoPedido, mesa?: object | null }} pedido
 * @returns {TipoPedido}
 */
export function tipoDelPedido(pedido) {
  return pedido.tipo ?? (pedido.mesa ? 'mesa' : 'mostrador');
}

/**
 * Nombre con el que se reconoce un pedido: la mesa, o el número del día y el cliente.
 * Por ejemplo: "Mesa 4", "#15 · Juan" o "#16 · Mostrador".
 * @param {{ tipo?: TipoPedido, mesa?: { nombre: string } | null, numero?: number,
 *   nombreCliente?: string | null }} pedido
 */
export function nombreDelPedido(pedido) {
  if (pedido.mesa) return pedido.mesa.nombre;
  const quien = pedido.nombreCliente || TIPOS_PEDIDO[tipoDelPedido(pedido)].etiqueta;
  return pedido.numero ? `#${pedido.numero} · ${quien}` : quien;
}

/**
 * @typedef {object} PasoDelPedido
 * @property {string} id
 * @property {string} etiqueta
 * @property {string} icono
 * @property {string | null} en Cuándo pasó; null si falta.
 * @property {boolean} siguiente Es lo que sigue ahora.
 */

/**
 * Pasos de un pedido para su seguimiento: los que ya pasaron, con su hora y en orden, y los
 * que faltan, en el orden en que deben pasar (el primero es el siguiente).
 * - Un domicilio debe pasar por la cocina, salir con el domiciliario y entregarse.
 * - En mesa y mostrador, la cocina solo aparece si el pedido pasó por ella (una venta rápida
 *   de bebidas puede cobrarse sin cocina).
 * - Un pedido anulado termina ahí: solo se ve lo que alcanzó a pasar.
 * @param {any} pedido Pedido completo (forma del API).
 * @returns {PasoDelPedido[]}
 */
export function pasosDelPedido(pedido) {
  const tipo = tipoDelPedido(pedido);
  const anulado = pedido.estado === 'anulado';
  const esDomicilio = tipo === 'domicilio';

  /** @type {Omit<PasoDelPedido, 'siguiente'>[]} */
  const posibles = [
    {
      id: 'registrado',
      etiqueta: tipo === 'mesa' ? 'Pedido abierto' : 'Pedido registrado',
      icono: 'i-lucide-notebook-pen',
      en: pedido.abiertoEn,
    },
  ];
  if (pedido.enviadoACocinaEn || (esDomicilio && !anulado)) {
    posibles.push({
      id: 'cocina',
      etiqueta: 'Enviado a cocina',
      icono: 'i-lucide-chef-hat',
      en: pedido.enviadoACocinaEn ?? null,
    });
  }
  if (anulado) {
    posibles.push({
      id: 'anulado',
      etiqueta: 'Anulado',
      icono: 'i-lucide-ban',
      en: pedido.cerradoEn,
    });
  } else {
    posibles.push({
      id: 'cobrado',
      etiqueta: 'Cobrado',
      icono: 'i-lucide-banknote',
      en: pedido.estado === 'pagado' ? pedido.cerradoEn : null,
    });
  }
  if (esDomicilio && !anulado) {
    posibles.push(
      {
        id: 'despachado',
        etiqueta: 'Salió con el domiciliario',
        icono: 'i-lucide-bike',
        en: pedido.entrega?.despachadoEn ?? null,
      },
      {
        id: 'entregado',
        etiqueta: 'Entregado',
        icono: 'i-lucide-check-check',
        en: pedido.entrega?.entregadoEn ?? null,
      },
    );
  }

  const hechos = posibles
    .filter((paso) => paso.en)
    .sort((a, b) => String(a.en).localeCompare(String(b.en)));
  const faltan = posibles.filter((paso) => !paso.en);
  return [
    ...hechos.map((paso) => ({ ...paso, siguiente: false })),
    ...faltan.map((paso, posicion) => ({ ...paso, en: null, siguiente: posicion === 0 })),
  ];
}
