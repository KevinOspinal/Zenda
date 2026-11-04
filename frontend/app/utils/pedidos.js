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

/** @param {any} pedido */
function tienePlatosPorEntregar(pedido) {
  return (pedido.items ?? []).some((/** @type {any} */ item) => item.estadoCocina !== 'entregado');
}

/**
 * Se cobró sin pasar por la cocina y tiene productos por entregar: falta decidir si se envía a
 * la cocina o si no va a cocina (por ejemplo, unas gaseosas). Mientras tanto, si es de mesa, la
 * mesa sigue ocupada.
 * @param {any} pedido Pedido completo (forma del API).
 */
export function faltaDecidirCocina(pedido) {
  return pedido.estado === 'pagado' && !pedido.enviadoACocinaEn && tienePlatosPorEntregar(pedido);
}

/**
 * Se cobró con platos en la cocina que aún no se entregan (el cliente pagó antes de que
 * salieran): la cocina lo sigue viendo y, si es de mesa, la mesa sigue ocupada.
 * @param {any} pedido Pedido completo (forma del API).
 */
export function esCobradoEnCocina(pedido) {
  return (
    pedido.estado === 'pagado' && Boolean(pedido.enviadoACocinaEn) && tienePlatosPorEntregar(pedido)
  );
}

/**
 * @typedef {object} AvisoDelPedido
 * @property {'error' | 'warning' | 'info' | 'success'} color
 * @property {string} icono
 * @property {string} titulo
 * @property {string} descripcion
 */

/**
 * El aviso de un pedido ya cobrado o anulado: qué pasó y, si falta algo, qué hacer.
 * @param {any} pedido Pedido completo (forma del API).
 * @returns {AvisoDelPedido}
 */
export function avisoDelPedidoCerrado(pedido) {
  if (pedido.estado === 'anulado') {
    return {
      color: 'error',
      icono: 'i-lucide-ban',
      titulo: 'Pedido anulado',
      descripcion: 'No se cobró y ya no se le pueden hacer cambios.',
    };
  }
  if (faltaDecidirCocina(pedido)) {
    return {
      color: 'warning',
      icono: 'i-lucide-chef-hat',
      titulo: 'Falta enviarlo a la cocina',
      descripcion:
        tipoDelPedido(pedido) === 'domicilio'
          ? 'Ya se cobró, pero la cocina todavía no lo ha visto. Envíalo para que lo preparen; cuando esté listo, lo despachas.'
          : 'Ya se cobró, pero la cocina todavía no lo ha visto. Si no hay nada que preparar (por ejemplo, solo bebidas), elige «No va a cocina».',
    };
  }
  if (tipoDelPedido(pedido) === 'mesa' && esCobradoEnCocina(pedido)) {
    return {
      color: 'info',
      icono: 'i-lucide-utensils',
      titulo: 'Cobrado · faltan platos por llevar',
      descripcion:
        'La mesa sigue ocupada hasta que se entreguen todos. Si piden algo más, va en un pedido nuevo.',
    };
  }
  return {
    color: 'success',
    icono: 'i-lucide-circle-check',
    titulo: 'Pedido cobrado',
    descripcion: 'Ya no se le pueden agregar productos.',
  };
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
