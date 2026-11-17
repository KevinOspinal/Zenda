// @ts-check
// Lo que muestra la pantalla de clientes: la lista (GET /clientes), la búsqueda al instante,
// el filtro de los que no tienen correo, el índice por letra y el cliente de la ficha.
// La lógica pura está en utils/clientes.js; aquí se junta con los datos del API.
//
// La búsqueda responde al instante con los clientes que ya se conocen y, a la vez, le pregunta
// al API (que solo envía 50 por vez); lo que llega se suma a la lista sin parpadeos.
// Los datos viven en la pantalla (no en un store): se vuelven a pedir al entrar.

/** @typedef {import('~/stores/clientes.js').Cliente} Cliente */

/** Cuántos clientes envía el API por búsqueda (si llegan todos, puede haber más). */
const MAXIMO_DEL_API = 50;
/** Cuánto dura el resaltado de un cliente que se acaba de guardar. */
const RESALTADO_MS = 1500;

export function useVistaDeClientes() {
  const clientesStore = useClientesStore();

  // ── Datos ──
  /** Todos los clientes que se conocen, por su id (de la lista inicial y de las búsquedas). */
  const conocidos = ref(/** @type {Map<string, Cliente>} */ (new Map()));
  /** sin_cargar · cargando · listo · error */
  const estadoCarga = ref('sin_cargar');
  const errorCarga = ref('');
  /** La lista inicial llegó completa (50): puede haber más clientes que los de la lista. */
  const hayMas = ref(false);
  const resaltados = ref(/** @type {Set<string>} */ (new Set()));

  /** @param {Cliente[]} clientes */
  function sumar(clientes) {
    for (const cliente of clientes) conocidos.value.set(cliente.id, cliente);
  }

  async function cargar() {
    estadoCarga.value = 'cargando';
    errorCarga.value = '';
    try {
      const lista = await clientesStore.buscar();
      conocidos.value = new Map();
      sumar(lista);
      hayMas.value = lista.length >= MAXIMO_DEL_API;
      estadoCarga.value = 'listo';
    } catch (fallo) {
      errorCarga.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
      estadoCarga.value = 'error';
    }
  }

  /**
   * Se guardó un cliente (nuevo o editado): queda como respondió el API y se resalta.
   * @param {Cliente} cliente
   */
  function alGuardar(cliente) {
    conocidos.value.set(cliente.id, cliente);
    resaltados.value.add(cliente.id);
    setTimeout(() => resaltados.value.delete(cliente.id), RESALTADO_MS);
  }

  // ── Búsqueda ──
  const busqueda = ref('');
  const buscandoEnElApi = ref(false);
  /** Lo buscado sin espacios de más (con 2 letras o más, también se le pregunta al API). */
  const textoBuscado = computed(() => busqueda.value.trim());

  watchDebounced(
    textoBuscado,
    async (texto) => {
      // El API busca el documento "empieza por", sin puntos: "1.234" se le pide como "1234".
      const paraElApi = sinSeparadores(texto);
      if (paraElApi.length < 2) return;
      buscandoEnElApi.value = true;
      try {
        sumar(await clientesStore.buscar(paraElApi));
      } catch {
        // Si falla, se queda con lo que ya se conoce: la búsqueda local sigue sirviendo.
      } finally {
        buscandoEnElApi.value = false;
      }
    },
    { debounce: 250 },
  );

  /** Ver solo los que no tienen correo (la factura electrónica no les llega). */
  const soloSinCorreo = ref(false);

  const todos = computed(() => [...conocidos.value.values()]);
  const cuantosSinCorreo = computed(() => todos.value.filter((cliente) => !cliente.email).length);

  /** Los clientes del filtro y la búsqueda, en orden alfabético. */
  const visibles = computed(() =>
    todos.value
      .filter(
        (cliente) =>
          (!soloSinCorreo.value || !cliente.email) && coincideCliente(cliente, textoBuscado.value),
      )
      .sort(compararClientes),
  );

  /** Sin búsqueda, por letra (como la agenda del celular); al buscar, todos juntos. */
  const grupos = computed(() =>
    textoBuscado.value
      ? [{ letra: '', clientes: visibles.value }]
      : agruparPorLetra(visibles.value),
  );

  // Si ya no queda ninguno sin correo, el filtro se quita solo.
  watch(cuantosSinCorreo, (cuantos) => {
    if (!cuantos) soloSinCorreo.value = false;
  });

  function verTodos() {
    busqueda.value = '';
    soloSinCorreo.value = false;
  }

  // ── Cliente de la ficha ──
  const elegidoId = ref(/** @type {string | null} */ (null));
  const elegido = computed(() =>
    elegidoId.value ? (conocidos.value.get(elegidoId.value) ?? null) : null,
  );

  return {
    estadoCarga,
    errorCarga,
    hayMas,
    resaltados,
    cargar,
    alGuardar,
    busqueda,
    textoBuscado,
    buscandoEnElApi,
    soloSinCorreo,
    todos,
    cuantosSinCorreo,
    visibles,
    grupos,
    verTodos,
    elegidoId,
    elegido,
  };
}
