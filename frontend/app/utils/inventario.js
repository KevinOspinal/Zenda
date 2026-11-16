// @ts-check
// Lógica del inventario que no depende de la pantalla:
// - El estado del stock de cada producto (por revisar, agotado, bajo o con stock) y los
//   contadores del resumen, que también filtran.
// - El orden (lo que necesita atención va primero) y los grupos por categoría de la carta.
//   La búsqueda por nombre está en utils/busqueda.js (la comparten otras pantallas).
// - El historial de un producto: cuánto quedó después de cada movimiento, agrupado por día,
//   los puntos de la gráfica y lo que se vendió y compró en la última semana.
// Son funciones puras, sin Vue ni el API, para probarlas fácil (tests/unit/inventario.test.js).
import { aDecimal } from './dinero.js';
import { diaEnColombia, formatearFechaCorta } from './fechas.js';

/**
 * Producto del inventario tal como lo envía el API (GET /inventario).
 * @typedef {{ id: string, nombre: string, stock: string, activo: boolean }} ProductoDeInventario
 */
/**
 * Movimiento del inventario (GET /inventario/:id/movimientos). `cantidad` es positiva en las
 * entradas y negativa en las salidas. Un ajuste con pedido es la devolución de una anulación.
 * @typedef {{ id: string, tipo: 'venta' | 'compra' | 'ajuste', cantidad: string,
 *   fecha: string, pedidoId?: string | null }} MovimientoDeInventario
 */
/**
 * Categoría de la carta a la que pertenece un producto, con su ícono y su tono.
 * @typedef {{ id: string, nombre: string, posicion: number,
 *   apariencia: { icono: string, fondo: string, texto: string } }} CategoriaDeProducto
 */
/** @typedef {'revisar' | 'agotado' | 'bajo' | 'con_stock'} EstadoStock */
/**
 * @typedef {import('./estados.js').Apariencia & { plural: string, ayuda: string }} AparienciaStock
 */

/** Desde cuántas unidades (o menos) el stock se considera bajo. */
export const STOCK_BAJO = 5;

/** Cuántos movimientos devuelve el API como máximo (los más recientes). */
export const LIMITE_MOVIMIENTOS = 100;

const UN_DIA_MS = 24 * 60 * 60 * 1000;

// ───────────────────────────── Estado del stock ─────────────────────────────

/**
 * Apariencia de cada estado del stock, en orden de urgencia: la etiqueta del chip, la del
 * contador (`plural`) y qué hacer (`ayuda`). Agotado va en gris: el estante está vacío, pero
 * no hay nada mal registrado, como en un stock negativo.
 * @type {Readonly<Record<EstadoStock, AparienciaStock>>}
 */
export const ESTADOS_STOCK = Object.freeze({
  revisar: {
    etiqueta: 'Revisar',
    plural: 'Por revisar',
    color: 'error',
    icono: 'i-lucide-circle-alert',
    ayuda: 'Se vendió más de lo registrado. Cuenta lo que hay y haz un ajuste.',
  },
  agotado: {
    etiqueta: 'Agotado',
    plural: 'Agotados',
    color: 'neutral',
    icono: 'i-lucide-package-x',
    ayuda: 'No queda nada. Registra la compra cuando llegue.',
  },
  bajo: {
    etiqueta: 'Stock bajo',
    plural: 'Stock bajo',
    color: 'warning',
    icono: 'i-lucide-triangle-alert',
    ayuda: `Quedan ${STOCK_BAJO} o menos: es hora de pedir más.`,
  },
  con_stock: {
    etiqueta: 'Con stock',
    plural: 'Con stock',
    color: 'success',
    icono: 'i-lucide-circle-check',
    ayuda: '',
  },
});

/** Orden de urgencia de cada estado (0 es lo más urgente). */
const URGENCIA = Object.freeze({ revisar: 0, agotado: 1, bajo: 2, con_stock: 3 });

/**
 * Estado del stock de un producto.
 * @param {string | number} stock
 * @returns {EstadoStock}
 */
export function estadoDeStock(stock) {
  const valor = aDecimal(stock);
  // lessThan y no isNegative: un "-0" no es un stock negativo.
  if (valor.lessThan(0)) return 'revisar';
  if (valor.isZero()) return 'agotado';
  if (valor.lessThanOrEqualTo(STOCK_BAJO)) return 'bajo';
  return 'con_stock';
}

/**
 * Cuántos productos hay en cada estado (son los números de los contadores).
 * @param {ProductoDeInventario[]} productos
 * @returns {Record<EstadoStock, number>}
 */
export function conteoPorEstado(productos) {
  const conteo = { revisar: 0, agotado: 0, bajo: 0, con_stock: 0 };
  for (const producto of productos) conteo[estadoDeStock(producto.stock)] += 1;
  return conteo;
}

// ───────────────────────────── Búsqueda, orden y grupos ─────────────────────────────

/**
 * Orden del inventario: primero los productos activos; luego lo más urgente (por revisar,
 * agotados, bajos); dentro de cada estado, el de menos stock, y por último, por nombre.
 * @param {ProductoDeInventario} a
 * @param {ProductoDeInventario} b
 */
export function compararPorUrgencia(a, b) {
  return (
    Number(b.activo) - Number(a.activo) ||
    URGENCIA[estadoDeStock(a.stock)] - URGENCIA[estadoDeStock(b.stock)] ||
    aDecimal(a.stock).comparedTo(aDecimal(b.stock)) ||
    a.nombre.localeCompare(b.nombre, 'es')
  );
}

/**
 * Agrupa los productos por su categoría de la carta, en el orden de la carta. Los que no tienen
 * categoría conocida van al final, juntos. Cada grupo dice cuántos necesitan atención.
 * Conserva el orden en que llegan los productos dentro de cada grupo.
 * @param {ProductoDeInventario[]} productos
 * @param {Map<string, CategoriaDeProducto>} categoriaPorProducto
 * @param {string} sinCategoria Nombre del grupo de los que no tienen categoría.
 */
export function agruparPorCategoria(productos, categoriaPorProducto, sinCategoria) {
  /**
   * @type {Map<string, { clave: string, nombre: string, posicion: number,
   *   apariencia: CategoriaDeProducto['apariencia'] | null, productos: ProductoDeInventario[],
   *   porAtender: number }>}
   */
  const grupos = new Map();
  for (const producto of productos) {
    const categoria = categoriaPorProducto.get(producto.id);
    const clave = categoria?.id ?? '';
    let grupo = grupos.get(clave);
    if (!grupo) {
      grupo = {
        clave,
        nombre: categoria?.nombre ?? sinCategoria,
        posicion: categoria?.posicion ?? Number.MAX_SAFE_INTEGER,
        apariencia: categoria?.apariencia ?? null,
        productos: [],
        porAtender: 0,
      };
      grupos.set(clave, grupo);
    }
    grupo.productos.push(producto);
    if (estadoDeStock(producto.stock) !== 'con_stock') grupo.porAtender += 1;
  }
  return [...grupos.values()].sort((a, b) => a.posicion - b.posicion);
}

// ───────────────────────────── Historial de un producto ─────────────────────────────

/**
 * Cómo se muestra cada clase de movimiento en el historial.
 * @type {Readonly<Record<'venta' | 'compra' | 'ajuste' | 'anulacion',
 *   { etiqueta: string, icono: string, tono: string }>>}
 */
export const TIPOS_MOVIMIENTO = Object.freeze({
  venta: { etiqueta: 'Venta', icono: 'i-lucide-shopping-cart', tono: 'bg-elevated text-toned' },
  compra: { etiqueta: 'Compra', icono: 'i-lucide-truck', tono: 'bg-success/10 text-success' },
  ajuste: { etiqueta: 'Ajuste', icono: 'i-lucide-scale', tono: 'bg-warning/10 text-warning' },
  anulacion: { etiqueta: 'Anulación', icono: 'i-lucide-undo-2', tono: 'bg-info/10 text-info' },
});

/**
 * Clase de un movimiento para mostrarlo: un ajuste con pedido es la devolución de una venta
 * anulada.
 * @param {MovimientoDeInventario} movimiento
 * @returns {keyof typeof TIPOS_MOVIMIENTO}
 */
export function claseDeMovimiento(movimiento) {
  if (movimiento.tipo === 'ajuste' && movimiento.pedidoId) return 'anulacion';
  return movimiento.tipo;
}

/**
 * Los movimientos del más reciente al más antiguo, cada uno con el stock que quedó después de
 * él. Se calcula hacia atrás desde el stock actual: el stock es la suma de los movimientos, así
 * que lo que había antes de uno es lo que quedó menos su cantidad.
 * @param {MovimientoDeInventario[]} movimientos
 * @param {string | number} stockActual
 * @returns {(MovimientoDeInventario & { stockDespues: string })[]}
 */
export function historialConStock(movimientos, stockActual) {
  const recientesPrimero = [...movimientos].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  );
  let despues = aDecimal(stockActual);
  return recientesPrimero.map((movimiento) => {
    const fila = { ...movimiento, stockDespues: despues.toString() };
    despues = despues.minus(aDecimal(movimiento.cantidad));
    return fila;
  });
}

/**
 * Nombre del día de una fecha, en Colombia: "Hoy", "Ayer" o "lun 26 oct".
 * @param {string | Date} fecha
 * @param {string | Date} [ahora]
 */
export function etiquetaDeDia(fecha, ahora = new Date()) {
  const dia = diaEnColombia(fecha);
  const hoy = diaEnColombia(ahora);
  // Mediodía de hoy menos 24 horas siempre cae en el día anterior, aunque sea muy temprano.
  const ayer = diaEnColombia(new Date(new Date(`${hoy}T12:00:00-05:00`).getTime() - UN_DIA_MS));
  if (dia === hoy) return 'Hoy';
  if (dia === ayer) return 'Ayer';
  return formatearFechaCorta(fecha);
}

/**
 * Agrupa el historial por día, en el mismo orden en que llega (del más reciente al más antiguo).
 * @template {{ fecha: string }} T
 * @param {T[]} historial
 * @param {string | Date} [ahora]
 * @returns {{ dia: string, etiqueta: string, movimientos: T[] }[]}
 */
export function agruparPorDia(historial, ahora = new Date()) {
  /** @type {{ dia: string, etiqueta: string, movimientos: T[] }[]} */
  const dias = [];
  for (const movimiento of historial) {
    const dia = diaEnColombia(movimiento.fecha);
    let grupo = dias.at(-1);
    if (grupo?.dia !== dia) {
      grupo = { dia, etiqueta: etiquetaDeDia(movimiento.fecha, ahora), movimientos: [] };
      dias.push(grupo);
    }
    grupo.movimientos.push(movimiento);
  }
  return dias;
}

/**
 * Puntos de la gráfica del stock, del más antiguo al más reciente: el stock que quedó después
 * de cada movimiento y, al final, el de ahora. Los números son solo para dibujar.
 * @param {(MovimientoDeInventario & { stockDespues: string })[]} historial Ver historialConStock.
 * @param {string | number} stockActual
 * @param {string | Date} [ahora]
 * @returns {{ tiempo: number, stock: number }[]}
 */
export function puntosDeStock(historial, stockActual, ahora = new Date()) {
  if (!historial.length) return [];
  const puntos = [...historial].reverse().map((movimiento) => ({
    tiempo: new Date(movimiento.fecha).getTime(),
    stock: aDecimal(movimiento.stockDespues).toNumber(),
  }));
  const ultimo = /** @type {{ tiempo: number }} */ (puntos.at(-1));
  const tiempoAhora = Math.max(new Date(ahora).getTime(), ultimo.tiempo);
  puntos.push({ tiempo: tiempoAhora, stock: aDecimal(stockActual).toNumber() });
  return puntos;
}

/**
 * Lo que se vendió y se compró en los últimos 7 días. Si el API mandó el máximo de movimientos
 * y el más antiguo todavía es de esta semana, faltan movimientos: la cifra es "al menos".
 * Las ventas anuladas se descuentan de lo vendido.
 * @param {MovimientoDeInventario[]} movimientos
 * @param {string | Date} [ahora]
 * @returns {{ vendidas: string, compradas: string, incompleto: boolean }}
 */
export function resumenDeLaSemana(movimientos, ahora = new Date()) {
  const desde = new Date(ahora).getTime() - 7 * UN_DIA_MS;
  let vendidas = aDecimal(0);
  let compradas = aDecimal(0);
  let masAntiguo = Number.POSITIVE_INFINITY;
  for (const movimiento of movimientos) {
    const tiempo = new Date(movimiento.fecha).getTime();
    masAntiguo = Math.min(masAntiguo, tiempo);
    if (tiempo < desde) continue;
    const clase = claseDeMovimiento(movimiento);
    // Las ventas restan stock (cantidad negativa) y las anulaciones lo devuelven.
    if (clase === 'venta' || clase === 'anulacion') vendidas = vendidas.minus(movimiento.cantidad);
    if (clase === 'compra') compradas = compradas.plus(movimiento.cantidad);
  }
  return {
    vendidas: vendidas.toString(),
    compradas: compradas.toString(),
    incompleto: movimientos.length >= LIMITE_MOVIMIENTOS && masAntiguo >= desde,
  };
}
