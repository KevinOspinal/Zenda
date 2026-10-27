// @ts-check

/** Error de aplicación con código y estado HTTP, seguro de mostrar al cliente. */
export class AppError extends Error {
  /**
   * @param {number} status Código HTTP.
   * @param {string} code Código estable para el cliente, p. ej. `NOT_FOUND`.
   * @param {string} message Mensaje legible, sin detalles internos.
   */
  constructor(status, code, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}
