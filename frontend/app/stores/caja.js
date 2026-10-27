// @ts-check
// La caja: si está abierta (para todos los roles, sin montos) y, para quien la maneja, el
// turno abierto con su resumen de ventas, la apertura y el cierre con arqueo.
// Se mantiene al día con los eventos caja:abierta, caja:cerrada, pedido:pagado y
// pedido:anulado (ver plugins/02.eventos-en-vivo.client.js).

/**
 * @typedef {object} ResumenTurno
 * @property {Record<'efectivo' | 'tarjeta' | 'transferencia' | 'otro', string>} ventasPorMetodo
 * @property {string} totalCobrado Todos los pagos (ventas + propinas).
 * @property {string} totalVendido Lo vendido por el negocio, sin propinas.
 * @property {string} propinas
 * @property {string} efectivoEsperado Monto inicial + pagos en efectivo.
 * @property {{ pagados: number, abiertos: number, anulados: number }} pedidos
 */

export const useCajaStore = defineStore('caja', () => {
  /** null mientras no se sabe (por ejemplo, antes de la primera consulta). */
  const abierta = ref(/** @type {boolean | null} */ (null));
  /** Turno abierto con su resumen (solo para quien maneja la caja). */
  const turno = ref(/** @type {any} */ (null));
  /** sin_cargar · cargando · listo · error */
  const estadoTurno = ref('sin_cargar');
  const errorTurno = ref('');

  /** Si la caja está abierta, sin montos (GET /caja/estado, todos los roles). */
  async function cargarEstado() {
    try {
      abierta.value = (await useApi().get('/caja/estado')).abierta;
    } catch {
      // Sin conexión se conserva lo último que se supo; el evento en vivo lo corrige.
    }
  }

  /** Turno abierto con su resumen (GET /caja/actual). Sin turno, queda en null. */
  async function cargarTurno() {
    if (estadoTurno.value !== 'listo') estadoTurno.value = 'cargando';
    try {
      turno.value = await useApi().get('/caja/actual');
      abierta.value = true;
      estadoTurno.value = 'listo';
      errorTurno.value = '';
    } catch (error) {
      if (error instanceof ErrorApi && error.codigo === 'SIN_TURNO_ABIERTO') {
        turno.value = null;
        abierta.value = false;
        estadoTurno.value = 'listo';
        return;
      }
      errorTurno.value = error instanceof Error ? error.message : MENSAJE_ERROR_GENERICO;
      if (estadoTurno.value !== 'listo') estadoTurno.value = 'error';
    }
  }

  /**
   * Abre la caja con el efectivo inicial.
   * @param {string} montoInicial
   */
  async function abrir(montoInicial) {
    await useApi().post('/caja/abrir', { montoInicial });
    abierta.value = true;
    await cargarTurno();
  }

  /**
   * Cierra la caja con el efectivo contado. Devuelve el turno cerrado con su arqueo.
   * @param {string} montoContado
   */
  async function cerrar(montoContado) {
    const cerrado = await useApi().post('/caja/cerrar', { montoContado });
    abierta.value = false;
    turno.value = null;
    return cerrado;
  }

  // Eventos en vivo.
  function alAbrirse() {
    abierta.value = true;
    if (estadoTurno.value !== 'sin_cargar') cargarTurno();
  }
  function alCerrarse() {
    abierta.value = false;
    turno.value = null;
  }
  /** Se cobró o se anuló un pedido: el resumen del turno cambió. */
  function alCambiarVentas() {
    if (turno.value) cargarTurno();
  }

  return {
    abierta,
    turno,
    estadoTurno,
    errorTurno,
    cargarEstado,
    cargarTurno,
    abrir,
    cerrar,
    alAbrirse,
    alCerrarse,
    alCambiarVentas,
  };
});
