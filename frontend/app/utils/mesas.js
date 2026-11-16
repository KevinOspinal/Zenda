// @ts-check
// Lógica del mapa de mesas que no depende de la pantalla:
// - El dibujo de cada mesa vista desde arriba: su forma según los puestos y una silla por puesto.
// - Lo que el mapa cuenta de una mesa ocupada: cómo va la cocina, si falta enviar el pedido,
//   cuánto llevan esperando sus platos y quién la atiende.
// - Los filtros del resumen (libres, ocupadas, platos listos, esperando mucho) y las zonas.
// Son funciones puras, sin Vue ni el API, para probarlas fácil (tests/unit/mesas.test.js).
import { minutosDeEspera } from './cocina.js';
import { MINUTOS_URGENTE, urgenciaDeEspera } from './estados.js';
import { minutosTranscurridos } from './fechas.js';

// ───────────────────────────── Dibujo de la mesa ─────────────────────────────

/** Tamaño del dibujo de una mesa, en unidades del viewBox del SVG. */
export const LIENZO_MESA = Object.freeze({ ancho: 120, alto: 72 });

/** Más sillas no caben en el dibujo: las que sobran se indican con "+N". */
export const MAX_SILLAS_DIBUJADAS = 12;

/** Medidas de una silla y su distancia al borde de la mesa. */
const SILLA = Object.freeze({ largo: 14, corto: 9, separacion: 3, radio: 3 });

/** Espacio que ocupa cada silla a lo largo de una mesa rectangular, y el margen de los bordes. */
const PUESTO = 18;
const MARGEN_PUESTOS = 6;

const CENTRO_X = LIENZO_MESA.ancho / 2;
const CENTRO_Y = LIENZO_MESA.alto / 2;

/**
 * @typedef {{ x: number, y: number, ancho: number, alto: number, radio: number }} Rectangulo
 * @typedef {'arriba' | 'abajo' | 'izquierda' | 'derecha'} Lado
 * @typedef {{ forma: 'redonda' | 'cuadrada' | 'rectangular', mesa: Rectangulo,
 *   sillas: Rectangulo[], sillasDeMas: number }} FiguraMesa
 */

/**
 * Una silla pegada a un lado de la mesa, centrada en `centro` a lo largo de ese lado.
 * @param {Lado} lado
 * @param {Rectangulo} mesa
 * @param {number} centro Posición del centro de la silla (x arriba y abajo; y a los lados).
 * @returns {Rectangulo}
 */
function sillaAl(lado, mesa, centro) {
  const { largo, corto, separacion, radio } = SILLA;
  if (lado === 'arriba' || lado === 'abajo') {
    const y = lado === 'arriba' ? mesa.y - separacion - corto : mesa.y + mesa.alto + separacion;
    return { x: centro - largo / 2, y, ancho: largo, alto: corto, radio };
  }
  const x = lado === 'izquierda' ? mesa.x - separacion - corto : mesa.x + mesa.ancho + separacion;
  return { x, y: centro - largo / 2, ancho: corto, alto: largo, radio };
}

/**
 * Mesa redonda (1 o 2 puestos) o cuadrada (3 o 4), con las sillas en sus lados.
 * @param {number} sillas
 * @param {'redonda' | 'cuadrada'} forma
 */
function mesaPequena(sillas, forma) {
  const lado = 34;
  const mesa = {
    x: CENTRO_X - lado / 2,
    y: CENTRO_Y - lado / 2,
    ancho: lado,
    alto: lado,
    radio: forma === 'redonda' ? lado / 2 : 7,
  };
  // En el sentido de las agujas del reloj, para que se llenen dando la vuelta a la mesa.
  /** @type {Record<number, Lado[]>} */
  const ladosPorPuestos = {
    1: ['izquierda'],
    2: ['derecha', 'izquierda'],
    3: ['arriba', 'derecha', 'izquierda'],
    4: ['arriba', 'derecha', 'abajo', 'izquierda'],
  };
  const lados = ladosPorPuestos[sillas];
  return {
    mesa,
    sillas: lados.map((ladoSilla) =>
      sillaAl(
        ladoSilla,
        mesa,
        ladoSilla === 'arriba' || ladoSilla === 'abajo' ? CENTRO_X : CENTRO_Y,
      ),
    ),
  };
}

/**
 * Mesa rectangular (5 puestos o más): una silla en cada cabecera y las demás repartidas
 * arriba y abajo. La mesa se alarga según cuántas sillas van en el lado largo.
 * @param {number} sillas
 */
function mesaRectangular(sillas) {
  const resto = sillas - 2;
  const arriba = Math.ceil(resto / 2);
  const abajo = resto - arriba;
  const ancho = arriba * PUESTO + MARGEN_PUESTOS;
  const alto = 30;
  const mesa = { x: CENTRO_X - ancho / 2, y: CENTRO_Y - alto / 2, ancho, alto, radio: 7 };

  /**
   * Centros de `cantidad` sillas en el lado largo, centradas si son menos que las de arriba.
   * @param {number} cantidad
   */
  const centros = (cantidad) =>
    Array.from(
      { length: cantidad },
      (_, i) =>
        mesa.x + MARGEN_PUESTOS / 2 + PUESTO / 2 + ((arriba - cantidad) * PUESTO) / 2 + i * PUESTO,
    );

  // En el sentido de las agujas del reloj: arriba de izquierda a derecha, la cabecera derecha,
  // abajo de derecha a izquierda y la cabecera izquierda.
  return {
    mesa,
    sillas: [
      ...centros(arriba).map((centro) => sillaAl('arriba', mesa, centro)),
      sillaAl('derecha', mesa, CENTRO_Y),
      ...centros(abajo)
        .reverse()
        .map((centro) => sillaAl('abajo', mesa, centro)),
      sillaAl('izquierda', mesa, CENTRO_Y),
    ],
  };
}

/**
 * Dibujo de una mesa vista desde arriba: redonda para 1 o 2 puestos, cuadrada para 3 o 4 y
 * rectangular desde 5, con una silla por puesto alrededor (hasta MAX_SILLAS_DIBUJADAS).
 * @param {number} capacidad Puestos de la mesa.
 * @returns {FiguraMesa}
 */
export function figuraDeMesa(capacidad) {
  const puestos = Math.max(1, Math.floor(Number(capacidad) || 1));
  const sillas = Math.min(puestos, MAX_SILLAS_DIBUJADAS);
  const sillasDeMas = puestos - sillas;
  if (sillas <= 2) return { forma: 'redonda', ...mesaPequena(sillas, 'redonda'), sillasDeMas };
  if (sillas <= 4) return { forma: 'cuadrada', ...mesaPequena(sillas, 'cuadrada'), sillasDeMas };
  return { forma: 'rectangular', ...mesaRectangular(sillas), sillasDeMas };
}

// ───────────────────────────── La mesa ocupada ─────────────────────────────

/**
 * @typedef {{ pendiente: number, preparando: number, listo: number, entregado: number,
 *   total: number }} AvanceDeCocina
 */

/**
 * Cuántos platos del pedido hay en cada paso de la cocina. Cuenta los productos del pedido
 * (2 × hamburguesa es uno), como los avisos del mesero ("3 platos listos").
 * @param {{ estadoCocina: string }[]} items
 * @returns {AvanceDeCocina}
 */
export function avanceDeCocina(items) {
  const avance = { pendiente: 0, preparando: 0, listo: 0, entregado: 0, total: 0 };
  for (const { estadoCocina } of items) {
    if (!['pendiente', 'preparando', 'listo', 'entregado'].includes(estadoCocina)) continue;
    avance[/** @type {'pendiente' | 'preparando' | 'listo' | 'entregado'} */ (estadoCocina)] += 1;
    avance.total += 1;
  }
  return avance;
}

/**
 * El pedido tiene productos que todavía no se han enviado a la cocina (se abrió y no se
 * envió): conviene que se note para que no se quede olvidado.
 * @param {{ estado: string, items?: unknown[] } | null} pedido
 */
export function faltaEnviarACocina(pedido) {
  return Boolean(pedido) && pedido?.estado === 'abierto' && (pedido.items?.length ?? 0) > 0;
}

/**
 * Minutos que llevan esperando la cocina los platos de un pedido ya enviado: desde el plato
 * más antiguo que falta (pendiente o en preparación), como en la pantalla de la cocina.
 * Null si el pedido no se ha enviado o ya no le falta nada.
 *
 * Solo cuenta los platos que traen su hora (`creadoEn`): uno recién agregado en este dispositivo
 * puede no traerla todavía, y una fecha que falta no debe tumbar todo el mapa.
 * @param {{ estado: string, items?: { estadoCocina: string, creadoEn?: string }[] } | null} pedido
 * @param {Date | string | number} [ahora]
 */
export function minutosEsperandoCocina(pedido, ahora = new Date()) {
  if (!pedido || pedido.estado === 'abierto') return null;
  const faltan = (pedido.items ?? []).filter(
    (item) =>
      (item.estadoCocina === 'pendiente' || item.estadoCocina === 'preparando') &&
      Boolean(item.creadoEn) &&
      !Number.isNaN(new Date(/** @type {string} */ (item.creadoEn)).getTime()),
  );
  return faltan.length > 0
    ? minutosDeEspera(/** @type {import('./cocina.js').ItemDeComanda[]} */ (faltan), ahora)
    : null;
}

/**
 * La espera ya es urgente (más de MINUTOS_URGENTE): la mesa entra en "Esperan +20 min".
 * @param {number | null} minutos
 */
export function esperaMucho(minutos) {
  return minutos !== null && urgenciaDeEspera(minutos).nivel === 'urgente';
}

/**
 * @typedef {object} DatosDeMesa Lo que el mapa muestra de una mesa.
 * @property {any} pedido Su pedido activo o, si ya pagó y espera platos, el cobrado.
 * @property {boolean} pagada Ya se cobró: sigue ocupada hasta que le entreguen los platos.
 * @property {boolean} platosListos Tiene platos listos para llevar.
 * @property {number | null} minutos Desde que se abrió el pedido.
 * @property {string | null} total Total por cobrar (texto del API). Null si ya se pagó.
 * @property {AvanceDeCocina | null} avance
 * @property {number | null} minutosEsperando Ver minutosEsperandoCocina.
 * @property {boolean} sinEnviar Ver faltaEnviarACocina.
 * @property {string | null} mesero Quién tomó el pedido.
 */

/**
 * Lo que el mapa muestra de una mesa a partir de su pedido.
 * @param {any} pedido El activo o, si ya pagó y espera platos, el cobrado. Null si no tiene.
 * @param {{ pagada: boolean, platosListos: boolean }} estado
 * @param {Date | string | number} [ahora]
 * @returns {DatosDeMesa}
 */
export function datosDeMesa(pedido, { pagada, platosListos }, ahora = new Date()) {
  if (!pedido) {
    return {
      pedido: null,
      pagada: false,
      platosListos: false,
      minutos: null,
      total: null,
      avance: null,
      minutosEsperando: null,
      sinEnviar: false,
      mesero: null,
    };
  }
  return {
    pedido,
    pagada,
    platosListos,
    minutos: minutosTranscurridos(pedido.abiertoEn, ahora),
    total: pagada ? null : (pedido.total ?? null),
    avance: avanceDeCocina(pedido.items ?? []),
    minutosEsperando: minutosEsperandoCocina(pedido, ahora),
    sinEnviar: faltaEnviarACocina(pedido),
    mesero: pedido.mesero?.nombre ?? null,
  };
}

// ───────────────────────────── Filtros y zonas ─────────────────────────────

/**
 * Filtros del resumen del mapa, en el orden en que se muestran. Cada uno es también un
 * contador ("5 libres").
 */
export const FILTROS_MESAS = Object.freeze({
  libres: { etiqueta: 'Libres', icono: 'i-lucide-armchair', color: 'success' },
  ocupadas: { etiqueta: 'Ocupadas', icono: 'i-lucide-utensils', color: 'warning' },
  listos: { etiqueta: 'Platos listos', icono: 'i-lucide-bell-ring', color: 'info' },
  esperando: {
    // Espacio que no se parte: si no cabe en una línea, baja «+20 min» completo.
    etiqueta: `Esperan +${MINUTOS_URGENTE}\u00a0min`,
    icono: 'i-lucide-alarm-clock',
    color: 'error',
  },
});

/** @typedef {keyof typeof FILTROS_MESAS} FiltroMesas */

/**
 * La mesa entra en un filtro del resumen.
 * @param {FiltroMesas} filtro
 * @param {{ estado: string }} mesa
 * @param {Pick<DatosDeMesa, 'platosListos' | 'minutosEsperando'> | undefined} datos
 */
export function cumpleFiltro(filtro, mesa, datos) {
  if (filtro === 'libres') return mesa.estado === 'libre';
  if (filtro === 'ocupadas') return mesa.estado === 'ocupada';
  if (filtro === 'listos') return Boolean(datos?.platosListos);
  return esperaMucho(datos?.minutosEsperando ?? null);
}

/**
 * Cuántas mesas entran en cada filtro del resumen.
 * @param {{ id: string, estado: string }[]} mesas
 * @param {Map<string, Pick<DatosDeMesa, 'platosListos' | 'minutosEsperando'>>} datosPorMesa
 * @returns {Record<FiltroMesas, number>}
 */
export function conteoPorFiltro(mesas, datosPorMesa) {
  const filtros = /** @type {FiltroMesas[]} */ (Object.keys(FILTROS_MESAS));
  const conteo = /** @type {Record<FiltroMesas, number>} */ (
    Object.fromEntries(filtros.map((filtro) => [filtro, 0]))
  );
  for (const mesa of mesas) {
    for (const filtro of filtros) {
      if (cumpleFiltro(filtro, mesa, datosPorMesa.get(mesa.id))) conteo[filtro] += 1;
    }
  }
  return conteo;
}

/**
 * Agrupa las mesas por zona, en el orden en que aparece cada zona, sin grupos vacíos.
 * @template {{ zona?: string | null }} M
 * @param {M[]} mesas
 * @param {string} sinZona Nombre del grupo de las mesas sin zona.
 * @returns {{ zona: string, mesas: M[] }[]}
 */
export function agruparPorZona(mesas, sinZona) {
  /** @type {Map<string, M[]>} */
  const grupos = new Map();
  for (const mesa of mesas) {
    const zona = mesa.zona || sinZona;
    grupos.set(zona, [...(grupos.get(zona) ?? []), mesa]);
  }
  return [...grupos].map(([zona, mesasDeLaZona]) => ({ zona, mesas: mesasDeLaZona }));
}
