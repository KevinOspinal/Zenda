// @ts-check
// Documentación de /recibos.
import { esquemaFiltrosRecibos } from '../../modules/recibos/recibos.schemas.js';
import { operacion, parametros, respuesta } from '../ayudantes.js';
import { RECIBO_EN_LISTA } from '../ejemplos.js';

export const documentacionRecibos = {
  '/recibos': {
    get: operacion({
      etiqueta: 'Recibos',
      resumen: 'Listar los últimos recibos de venta',
      roles: ['dueno', 'administrador', 'cajero'],
      descripcion: `
Los últimos 20 recibos de venta del negocio, del más reciente al más antiguo, con un resumen
de su pedido (mesa o número y cliente, total y métodos de pago) para reconocerlo en la caja.
Con \`?numero=7\`, solo ese recibo.

Solo los negocios que no facturan electrónicamente emiten recibos (al cobrar). Para
reimprimir uno se trae su pedido completo con \`GET /pedidos/{id}\`: trae el recibo con los
datos del negocio con que se emitió.`,
      parametros: parametros('query', esquemaFiltrosRecibos, {
        numero: { descripcion: 'Número del recibo que se busca.', ejemplo: '7' },
      }),
      respuestas: { 200: respuesta('Lista de recibos.', [RECIBO_EN_LISTA]) },
      errores: ['400'],
    }),
  },
};
