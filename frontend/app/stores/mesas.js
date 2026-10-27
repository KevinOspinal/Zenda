// @ts-check
// Mesas del negocio (GET /mesas), al día con el evento en vivo mesa:estado.
// Las mesas que cambian por un evento se "resaltan" un momento para que se note el cambio.

/** @typedef {{ id: string, nombre: string, zona: string | null, capacidad: number, estado: 'libre' | 'ocupada' }} Mesa */

/** Cuánto dura el resaltado de una mesa que cambió en vivo. */
const RESALTADO_MS = 1500;

/** Zona de las mesas que no tienen una asignada. */
export const SIN_ZONA = 'Sin zona';

export const useMesasStore = defineStore('mesas', () => {
  const lista = ref(/** @type {Mesa[]} */ ([]));
  /** sin_cargar · cargando · listo · error */
  const estadoCarga = ref('sin_cargar');
  const errorCarga = ref('');
  /** Ids de las mesas resaltadas en este momento. */
  const resaltadas = ref(/** @type {Set<string>} */ (new Set()));

  /** Zonas en el orden en que aparecen. */
  const zonas = computed(() => [...new Set(lista.value.map((mesa) => mesa.zona || SIN_ZONA))]);

  async function cargar() {
    if (estadoCarga.value !== 'listo') estadoCarga.value = 'cargando';
    try {
      lista.value = await useApi().get('/mesas');
      estadoCarga.value = 'listo';
      errorCarga.value = '';
    } catch (error) {
      errorCarga.value = error instanceof Error ? error.message : MENSAJE_ERROR_GENERICO;
      if (estadoCarga.value !== 'listo') estadoCarga.value = 'error';
    }
  }

  /**
   * Resalta una mesa un momento (cambió por un evento en vivo).
   * @param {string} mesaId
   */
  function resaltar(mesaId) {
    resaltadas.value.add(mesaId);
    setTimeout(() => resaltadas.value.delete(mesaId), RESALTADO_MS);
  }

  /**
   * Evento mesa:estado: una mesa se ocupó o se liberó.
   * @param {{ mesaId: string, estado: 'libre' | 'ocupada' }} datos
   */
  function alCambiarEstado({ mesaId, estado }) {
    const mesa = lista.value.find((m) => m.id === mesaId);
    if (!mesa) return;
    mesa.estado = estado;
    resaltar(mesaId);
  }

  return { lista, estadoCarga, errorCarga, resaltadas, zonas, cargar, resaltar, alCambiarEstado };
});
