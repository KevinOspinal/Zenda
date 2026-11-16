// @ts-check
// Estado del mapa de mesas (pages/mesas/index.vue): lo que muestra cada mesa, los contadores
// del resumen, los filtros por estado y por zona, los grupos por zona y la mesa elegida para
// la vista rápida (tablet horizontal y PC).
// La lógica pura vive en utils/mesas.js; aquí se une con los stores y con la hora actual.

/** Valor del selector de zonas que muestra todas. */
export const TODAS_LAS_ZONAS = 'Todas';

export function useMapaDeMesas() {
  const mesas = useMesasStore();
  const pedidos = usePedidosStore();
  // El tiempo de cada mesa y la espera de la cocina se ponen al día cada 30 segundos (no en
  // cada cuadro: el mapa se repintaría sin parar y las tarjetas no alcanzarían a deslizarse).
  const ahora = useAhora(30_000);

  const zonaActiva = ref(TODAS_LAS_ZONAS);
  /** Filtro del resumen (libres, ocupadas…), o null para ver todas. */
  const filtro = ref(/** @type {import('~/utils/mesas.js').FiltroMesas | null} */ (null));

  /**
   * Lo que muestra cada mesa: su pedido activo o, si ya pagó y espera platos de la cocina,
   * ese pedido cobrado (ver datosDeMesa).
   */
  const datosPorMesa = computed(() => {
    // Mesas con platos listos para llevar, de pedidos por cobrar o ya cobrados.
    const conPlatosListos = new Set(
      pedidos.pedidosConPlatosListos().map(({ pedido }) => pedido.mesaId),
    );
    /** @type {Map<string, import('~/utils/mesas.js').DatosDeMesa>} */
    const datos = new Map();
    for (const mesa of mesas.lista) {
      const activo = pedidos.pedidoDeMesa(mesa.id);
      const cobrado =
        activo || mesa.estado !== 'ocupada' ? null : pedidos.pedidoCobradoDeMesa(mesa.id);
      const pedido = activo ?? cobrado;
      const estado = {
        pagada: Boolean(cobrado),
        platosListos: Boolean(pedido) && conPlatosListos.has(mesa.id),
      };
      datos.set(mesa.id, datosDeMesa(pedido, estado, ahora.value));
    }
    return datos;
  });

  const conteo = computed(() => conteoPorFiltro(mesas.lista, datosPorMesa.value));

  /** Las mesas de la zona elegida que entran en el filtro del resumen. */
  const mesasVisibles = computed(() =>
    mesas.lista.filter(
      (mesa) =>
        (zonaActiva.value === TODAS_LAS_ZONAS || (mesa.zona || SIN_ZONA) === zonaActiva.value) &&
        (!filtro.value || cumpleFiltro(filtro.value, mesa, datosPorMesa.value.get(mesa.id))),
    ),
  );

  /**
   * Las mesas visibles por zona, con cuántas de la zona están libres. Solo se agrupan si se
   * ven todas las zonas y hay más de una; si no, va un solo grupo sin título.
   */
  const grupos = computed(() => {
    if (zonaActiva.value !== TODAS_LAS_ZONAS || mesas.zonas.length < 2) {
      return [{ zona: '', mesas: mesasVisibles.value, libres: 0, total: 0 }];
    }
    return agruparPorZona(mesasVisibles.value, SIN_ZONA).map((grupo) => {
      const deLaZona = mesas.lista.filter((mesa) => (mesa.zona || SIN_ZONA) === grupo.zona);
      return {
        ...grupo,
        libres: deLaZona.filter((mesa) => mesa.estado === 'libre').length,
        total: deLaZona.length,
      };
    });
  });

  // ── Vista rápida ──
  const mesaElegidaId = ref(/** @type {string | null} */ (null));
  const mesaElegida = computed(
    () => mesas.lista.find((mesa) => mesa.id === mesaElegidaId.value) ?? null,
  );
  const datosElegida = computed(() =>
    mesaElegida.value ? (datosPorMesa.value.get(mesaElegida.value.id) ?? null) : null,
  );
  // Si la mesa elegida se libera (se cobró y se entregó todo), la vista rápida se cierra.
  watch(
    () => datosElegida.value?.pedido,
    (pedido) => {
      if (mesaElegidaId.value && !pedido) mesaElegidaId.value = null;
    },
  );

  /** Quita el filtro del resumen y vuelve a todas las zonas. */
  function verTodas() {
    filtro.value = null;
    zonaActiva.value = TODAS_LAS_ZONAS;
  }

  return {
    zonaActiva,
    filtro,
    datosPorMesa,
    conteo,
    mesasVisibles,
    grupos,
    mesaElegidaId,
    mesaElegida,
    datosElegida,
    verTodas,
  };
}
