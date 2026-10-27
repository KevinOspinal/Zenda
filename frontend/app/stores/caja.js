// @ts-check
// Estado de la caja (GET /caja/estado): si está abierta, sin montos. Sin caja abierta no se
// pueden tomar pedidos. Se mantiene al día con los eventos caja:abierta y caja:cerrada.
// La pantalla de caja (Fase 4) agrega aquí el turno, el resumen y el arqueo.
export const useCajaStore = defineStore('caja', () => {
  /** null mientras no se sabe (por ejemplo, antes de la primera consulta). */
  const abierta = ref(/** @type {boolean | null} */ (null));

  async function cargarEstado() {
    try {
      abierta.value = (await useApi().get('/caja/estado')).abierta;
    } catch {
      // Sin conexión se conserva lo último que se supo; el evento en vivo lo corrige.
    }
  }

  function alAbrirse() {
    abierta.value = true;
  }

  function alCerrarse() {
    abierta.value = false;
  }

  return { abierta, cargarEstado, alAbrirse, alCerrarse };
});
