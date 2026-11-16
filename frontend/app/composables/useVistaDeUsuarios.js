// @ts-check
// Lo que muestra la pantalla de usuarios: las cuentas (GET /usuarios), los contadores por
// estado, el filtro por rol, la búsqueda, el orden por rol, la cuenta elegida para la vista
// rápida y qué se puede hacer con cada una.
// La lógica pura está en utils/usuarios.js; aquí se junta con los datos y la sesión.
//
// Los datos viven en la pantalla (no en un store): son de un solo negocio y se vuelven a
// pedir al entrar, así nunca se ven cuentas de otro negocio. Se actualizan solos al volver a
// la pestaña (por ejemplo, alguien quedó bloqueado) y el bloqueo se vence en pantalla con la
// hora.

/** @typedef {import('~/utils/usuarios.js').Cuenta} Cuenta */
/** @typedef {import('~/utils/usuarios.js').EstadoCuenta} EstadoCuenta */

/** Cuánto dura el resaltado de una cuenta que cambió. */
const RESALTADO_MS = 1500;

export function useVistaDeUsuarios() {
  const sesion = useSesionStore();
  // Cada 30 segundos basta para que "Bloqueado hasta las 4:15" se quite a tiempo.
  const ahora = useAhora(30_000);
  const puedeGestionar = computed(() => puede(sesion.rol, 'gestionarUsuarios'));

  // ── Datos ──
  const cuentas = ref(/** @type {Cuenta[]} */ ([]));
  /** sin_cargar · cargando · listo · error */
  const estadoCarga = ref('sin_cargar');
  const errorCarga = ref('');
  /** Ids de las cuentas resaltadas en este momento. */
  const resaltados = ref(/** @type {Set<string>} */ (new Set()));

  /** @param {string} id */
  function resaltar(id) {
    resaltados.value.add(id);
    setTimeout(() => resaltados.value.delete(id), RESALTADO_MS);
  }

  /** Trae las cuentas; si ya se veían, resalta las que cambiaron. */
  async function cargar() {
    if (estadoCarga.value !== 'listo') estadoCarga.value = 'cargando';
    try {
      /** @type {Cuenta[]} */
      const nuevas = await useApi().get('/usuarios');
      if (estadoCarga.value === 'listo') {
        const antes = new Map(cuentas.value.map((cuenta) => [cuenta.id, cuenta]));
        for (const cuenta of nuevas) {
          const anterior = antes.get(cuenta.id);
          if (!anterior || cambio(anterior, cuenta)) resaltar(cuenta.id);
        }
      }
      cuentas.value = nuevas;
      estadoCarga.value = 'listo';
      errorCarga.value = '';
    } catch (fallo) {
      errorCarga.value = fallo instanceof ErrorApi ? fallo.message : MENSAJE_ERROR_GENERICO;
      if (estadoCarga.value !== 'listo') estadoCarga.value = 'error';
    }
  }

  /**
   * Se guardó una cuenta (creada, editada, activada o restablecida): queda como respondió el
   * API, en su lugar, y se resalta.
   * @param {Cuenta} cuenta
   */
  function alGuardar(cuenta) {
    const indice = cuentas.value.findIndex((otra) => otra.id === cuenta.id);
    if (indice === -1) cuentas.value.push(cuenta);
    else cuentas.value[indice] = { ...cuentas.value[indice], ...cuenta };
    resaltar(cuenta.id);
  }

  // Al volver a la pestaña, se ponen al día (sin la pantalla de carga).
  const visibilidad = useDocumentVisibility();
  watch(visibilidad, (actual) => {
    if (actual === 'visible' && estadoCarga.value === 'listo') cargar();
  });

  // ── Estado de cada cuenta (con la hora, porque el bloqueo se vence solo) ──
  /** @param {Cuenta} cuenta */
  const estadoDe = (cuenta) => estadoDeCuenta(cuenta, ahora.value);
  /** @param {Cuenta} cuenta */
  const finBloqueoDe = (cuenta) => finDelBloqueo(cuenta, ahora.value);
  /** @param {Cuenta} cuenta */
  const esPropia = (cuenta) => cuenta.id === sesion.usuario?.id;

  const duenosActivos = computed(
    () => cuentas.value.filter((cuenta) => cuenta.rol === 'dueno' && cuenta.activo).length,
  );
  /**
   * Qué se puede hacer con una cuenta (nada, si la sesión no maneja usuarios).
   * @param {Cuenta} cuenta
   */
  function permisosDe(cuenta) {
    const permisos = permisosSobreCuenta(cuenta, {
      idPropia: sesion.usuario?.id,
      duenosActivos: duenosActivos.value,
    });
    if (puedeGestionar.value) return permisos;
    return { ...permisos, editar: false, restablecer: false, cambiarAcceso: false };
  }

  // ── Filtros ──
  /** Estado elegido en los contadores, o null para ver todos. */
  const filtro = ref(/** @type {EstadoCuenta | null} */ (null));
  const rolElegido = ref(/** @type {import('~/utils/roles.js').Rol | null} */ (null));
  const busqueda = ref('');

  /** Los contadores y los chips de rol cuentan todas las cuentas, sin importar la búsqueda. */
  const conteo = computed(() => conteoDeCuentas(cuentas.value, ahora.value));
  const roles = computed(() => conteoPorRol(cuentas.value));

  /** Las cuentas del filtro, el rol y la búsqueda, ordenadas por rol y por nombre. */
  const visibles = computed(() =>
    cuentas.value
      .filter(
        (cuenta) =>
          (!filtro.value || estadoDe(cuenta) === filtro.value) &&
          (!rolElegido.value || cuenta.rol === rolElegido.value) &&
          coincideCuenta(cuenta, busqueda.value),
      )
      .sort(compararCuentas),
  );

  // Si el rol elegido se queda sin cuentas, se vuelve a ver todo.
  watch(roles, (actuales) => {
    if (rolElegido.value && !actuales.some(({ rol }) => rol === rolElegido.value)) {
      rolElegido.value = null;
    }
  });

  function verTodos() {
    filtro.value = null;
    rolElegido.value = null;
    busqueda.value = '';
  }

  // ── Cuenta de la vista rápida (o de la hoja de abajo, en el celular) ──
  const elegidaId = ref(/** @type {string | null} */ (null));
  const elegida = computed(
    () => cuentas.value.find((cuenta) => cuenta.id === elegidaId.value) ?? null,
  );

  return {
    cuentas,
    estadoCarga,
    errorCarga,
    resaltados,
    cargar,
    alGuardar,
    estadoDe,
    finBloqueoDe,
    esPropia,
    permisosDe,
    filtro,
    rolElegido,
    busqueda,
    conteo,
    roles,
    visibles,
    verTodos,
    elegidaId,
    elegida,
  };
}

/**
 * Algo que se ve en la tarjeta cambió.
 * @param {Cuenta} antes
 * @param {Cuenta} ahora
 */
function cambio(antes, ahora) {
  return (
    antes.nombre !== ahora.nombre ||
    antes.rol !== ahora.rol ||
    antes.activo !== ahora.activo ||
    antes.bloqueado !== ahora.bloqueado
  );
}
