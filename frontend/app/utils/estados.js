// @ts-check
// Apariencia de cada estado del negocio: color, ícono y etiqueta.
//
// Es el único lugar donde se decide cómo se ve un estado. Los componentes lo leen de aquí
// para que "Preparando" sea siempre ámbar con una llama, en todas las pantallas.
// El color nunca va solo: siempre lo acompañan el ícono y la etiqueta (accesibilidad).
import { formatearPesos, aDecimal } from './dinero.js';

/** @typedef {'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'} ColorUi */
/** @typedef {{ etiqueta: string, color: ColorUi, icono: string }} Apariencia */

/** Desde cuántos minutos de espera una comanda pide atención, y desde cuántos es urgente. */
export const MINUTOS_ATENCION = 10;
export const MINUTOS_URGENTE = 20;

/**
 * Mesas. "con_platos_listos" no es un estado del API: es una mesa ocupada que tiene platos
 * listos para llevar, y se resalta para que el mesero lo vea de inmediato.
 * @type {Readonly<Record<'libre' | 'ocupada' | 'con_platos_listos', Apariencia>>}
 */
export const ESTADOS_MESA = Object.freeze({
  libre: { etiqueta: 'Libre', color: 'success', icono: 'i-lucide-armchair' },
  ocupada: { etiqueta: 'Ocupada', color: 'warning', icono: 'i-lucide-utensils' },
  con_platos_listos: { etiqueta: '¡Listo!', color: 'info', icono: 'i-lucide-bell-ring' },
});

/**
 * Estado de cocina de cada ítem: pendiente → preparando → listo → entregado.
 * @type {Readonly<Record<'pendiente' | 'preparando' | 'listo' | 'entregado', Apariencia>>}
 */
export const ESTADOS_COCINA = Object.freeze({
  pendiente: { etiqueta: 'Pendiente', color: 'neutral', icono: 'i-lucide-clock' },
  preparando: { etiqueta: 'Preparando', color: 'warning', icono: 'i-lucide-flame' },
  listo: { etiqueta: 'Listo', color: 'success', icono: 'i-lucide-bell-ring' },
  entregado: { etiqueta: 'Entregado', color: 'neutral', icono: 'i-lucide-check-check' },
});

/**
 * Estado del pedido: abierto → enviado_a_cocina → pagado, o anulado.
 * @type {Readonly<Record<'abierto' | 'enviado_a_cocina' | 'pagado' | 'anulado', Apariencia>>}
 */
export const ESTADOS_PEDIDO = Object.freeze({
  abierto: { etiqueta: 'Abierto', color: 'info', icono: 'i-lucide-notebook-pen' },
  enviado_a_cocina: { etiqueta: 'En cocina', color: 'warning', icono: 'i-lucide-chef-hat' },
  pagado: { etiqueta: 'Pagado', color: 'success', icono: 'i-lucide-circle-check' },
  anulado: { etiqueta: 'Anulado', color: 'error', icono: 'i-lucide-ban' },
});

/**
 * Cómo va en la cocina un pedido que ya se envió, según sus platos (ver aparienciaDelPedido).
 * @type {Readonly<Record<'listoMesa' | 'listoMostrador' | 'servido' | 'entregado', Apariencia>>}
 */
export const AVANCE_EN_COCINA = Object.freeze({
  listoMesa: { etiqueta: 'Listo para llevar', color: 'info', icono: 'i-lucide-bell-ring' },
  listoMostrador: { etiqueta: 'Listo para entregar', color: 'info', icono: 'i-lucide-bell-ring' },
  servido: { etiqueta: 'Servido', color: 'secondary', icono: 'i-lucide-check-check' },
  entregado: { etiqueta: 'Entregado', color: 'secondary', icono: 'i-lucide-check-check' },
});

/**
 * Lo que se muestra del estado de un pedido. El API lo deja en "enviado_a_cocina" hasta que
 * se cobra, aunque ya se hayan entregado todos sus platos; por eso, mientras tanto, se mira
 * cómo van sus platos:
 * - Alguno pendiente o preparándose: "En cocina".
 * - Ninguno en preparación y alguno listo: "Listo para llevar" (en mostrador, "para entregar").
 * - Todos entregados: "Servido" (en mostrador, "Entregado").
 * @param {{ estado: keyof typeof ESTADOS_PEDIDO, mesa?: object | null,
 *   items?: { estadoCocina: string }[] }} pedido
 * @returns {Apariencia}
 */
export function aparienciaDelPedido(pedido) {
  if (pedido.estado !== 'enviado_a_cocina') return ESTADOS_PEDIDO[pedido.estado];

  const items = pedido.items ?? [];
  /** @param {string} estado */
  const hay = (estado) => items.some((item) => item.estadoCocina === estado);
  if (!items.length || hay('pendiente') || hay('preparando')) {
    return ESTADOS_PEDIDO.enviado_a_cocina;
  }

  const enMesa = Boolean(pedido.mesa);
  if (hay('listo')) return enMesa ? AVANCE_EN_COCINA.listoMesa : AVANCE_EN_COCINA.listoMostrador;
  return enMesa ? AVANCE_EN_COCINA.servido : AVANCE_EN_COCINA.entregado;
}

/**
 * Métodos de pago. Transferencia incluye Nequi, Daviplata y bancos.
 * @type {Readonly<Record<'efectivo' | 'tarjeta' | 'transferencia' | 'otro', Apariencia>>}
 */
export const METODOS_PAGO = Object.freeze({
  efectivo: { etiqueta: 'Efectivo', color: 'success', icono: 'i-lucide-banknote' },
  tarjeta: { etiqueta: 'Tarjeta', color: 'info', icono: 'i-lucide-credit-card' },
  transferencia: { etiqueta: 'Transferencia', color: 'secondary', icono: 'i-lucide-smartphone' },
  otro: { etiqueta: 'Otro', color: 'neutral', icono: 'i-lucide-wallet' },
});

/**
 * Estado visual de una mesa: si está ocupada y tiene platos listos, se resalta.
 * @param {'libre' | 'ocupada'} estadoDelApi
 * @param {boolean} [tienePlatosListos]
 * @returns {keyof typeof ESTADOS_MESA}
 */
export function estadoVisualDeMesa(estadoDelApi, tienePlatosListos = false) {
  if (estadoDelApi === 'ocupada' && tienePlatosListos) return 'con_platos_listos';
  return estadoDelApi;
}

/**
 * Urgencia de una comanda según cuánto lleva esperando.
 * Menos de 10 min: normal; de 10 a 20: atención; más de 20: urgente (y la tarjeta late).
 * @param {number} minutos
 * @returns {{ nivel: 'normal' | 'atencion' | 'urgente', color: ColorUi, late: boolean }}
 */
export function urgenciaDeEspera(minutos) {
  if (minutos > MINUTOS_URGENTE) return { nivel: 'urgente', color: 'error', late: true };
  if (minutos >= MINUTOS_ATENCION) return { nivel: 'atencion', color: 'warning', late: false };
  return { nivel: 'normal', color: 'neutral', late: false };
}

/**
 * Resultado del arqueo de caja según la diferencia (contado − esperado).
 * @param {import('./dinero.js').ValorDinero} diferencia
 * @returns {Apariencia & { tipo: 'cuadra' | 'sobrante' | 'faltante' }}
 */
export function aparienciaDeArqueo(diferencia) {
  const valor = aDecimal(diferencia);
  const icono = 'i-lucide-scale';
  if (valor.isZero()) return { tipo: 'cuadra', etiqueta: 'Cuadra', color: 'success', icono };
  if (valor.isPositive()) {
    return { tipo: 'sobrante', etiqueta: `Sobran ${formatearPesos(valor)}`, color: 'info', icono };
  }
  return {
    tipo: 'faltante',
    etiqueta: `Faltan ${formatearPesos(valor.abs())}`,
    color: 'error',
    icono,
  };
}

/**
 * Acciones sensibles que guarda la auditoría (mismos nombres del backend).
 * @type {Readonly<Record<string, Apariencia>>}
 */
export const ACCIONES_AUDITORIA = Object.freeze({
  cambiar_precio: { etiqueta: 'Cambio de precio', color: 'warning', icono: 'i-lucide-tag' },
  anular_venta: { etiqueta: 'Venta anulada', color: 'error', icono: 'i-lucide-ban' },
  cerrar_caja: { etiqueta: 'Cierre de caja', color: 'info', icono: 'i-lucide-lock' },
  ajustar_inventario: {
    etiqueta: 'Ajuste de inventario',
    color: 'warning',
    icono: 'i-lucide-package',
  },
  crear_usuario: { etiqueta: 'Empleado creado', color: 'success', icono: 'i-lucide-user-plus' },
  editar_usuario: { etiqueta: 'Empleado editado', color: 'info', icono: 'i-lucide-user-pen' },
  restablecer_contrasena: {
    etiqueta: 'Contraseña restablecida',
    color: 'warning',
    icono: 'i-lucide-key-round',
  },
  cambiar_credenciales_facturacion: {
    etiqueta: 'Credenciales de facturación',
    color: 'warning',
    icono: 'i-lucide-file-key',
  },
  cambiar_propina_sugerida: {
    etiqueta: 'Propina sugerida',
    color: 'info',
    icono: 'i-lucide-hand-coins',
  },
});
