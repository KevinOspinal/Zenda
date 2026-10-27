// @ts-check
// Clientes a cuyo nombre se factura (GET/POST/PATCH /clientes). Solo los datos necesarios
// para la factura (Ley 1581 de 2012). Los manejan el cajero, el administrador y el dueño.

/**
 * @typedef {{ id: string, tipoDocumento: 'cc' | 'nit' | 'ce' | 'pasaporte' | 'otro',
 *   numeroDocumento: string, nombre: string, email: string | null, telefono: string | null }} Cliente
 */

/** Tipos de documento con su nombre para mostrar. */
export const TIPOS_DOCUMENTO = Object.freeze([
  { value: 'cc', label: 'Cédula de ciudadanía' },
  { value: 'nit', label: 'NIT' },
  { value: 'ce', label: 'Cédula de extranjería' },
  { value: 'pasaporte', label: 'Pasaporte' },
  { value: 'otro', label: 'Otro' },
]);

export const useClientesStore = defineStore('clientes', () => {
  /**
   * Busca clientes por nombre o número de documento (mínimo 2 letras). Sin texto, trae
   * los más recientes.
   * @param {string} [texto]
   * @returns {Promise<Cliente[]>}
   */
  function buscar(texto = '') {
    const buscarPor = texto.trim();
    return useApi().get('/clientes', buscarPor.length >= 2 ? { buscar: buscarPor } : undefined);
  }

  /**
   * @param {Omit<Cliente, 'id'>} datos
   * @returns {Promise<Cliente>}
   */
  function crear(datos) {
    return useApi().post('/clientes', datos);
  }

  /**
   * @param {string} id
   * @param {Partial<Omit<Cliente, 'id'>>} cambios
   * @returns {Promise<Cliente>}
   */
  function actualizar(id, cambios) {
    return useApi().patch(`/clientes/${id}`, cambios);
  }

  return { buscar, crear, actualizar };
});
