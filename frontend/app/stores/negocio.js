// @ts-check
// Datos completos del negocio de la sesión (GET /negocios/actual): dirección, teléfono y cobro
// por Bre-B, entre otros. Los usan la precuenta y el cobro por transferencia.
//
// Se guardan en memoria para no pedirlos en cada cobro. La precuenta los vuelve a pedir al
// imprimir (`forzar`), para que una llave recién cambiada salga bien en el papel.
// Al cambiar de sesión o de negocio se olvidan.

export const useNegocioStore = defineStore('negocio', () => {
  const sesion = useSesionStore();

  /** Negocio como lo entrega el API; null si aún no se ha traído. */
  const datos = ref(/** @type {any} */ (null));
  /** @type {Promise<any> | null} */
  let cargaEnCurso = null;

  /**
   * Trae los datos del negocio, o entrega los que ya tiene.
   * @param {{ forzar?: boolean }} [opciones] `forzar: true` los pide de nuevo al API.
   * @returns {Promise<any>}
   */
  function cargar({ forzar = false } = {}) {
    if (datos.value && !forzar) return Promise.resolve(datos.value);
    // Si ya hay una petición en camino, se espera esa en vez de hacer otra.
    cargaEnCurso ??= useApi()
      .get('/negocios/actual')
      .then((negocio) => (datos.value = negocio))
      .finally(() => (cargaEnCurso = null));
    return cargaEnCurso;
  }

  /**
   * Reemplaza los datos con los que respondió el API al guardar la configuración.
   * @param {any} negocio
   */
  function actualizar(negocio) {
    datos.value = negocio;
  }

  // Otra sesión u otro negocio: estos datos ya no sirven.
  watch(
    () => sesion.negocio?.id,
    () => (datos.value = null),
  );

  return { datos, cargar, actualizar };
});
