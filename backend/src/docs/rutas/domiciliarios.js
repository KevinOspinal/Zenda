// @ts-check
// Documentación de /domiciliarios.
import { esquemaParamsId } from '../../lib/esquemas.js';
import {
  esquemaActualizarDomiciliario,
  esquemaCrearDomiciliario,
  esquemaDarAcceso,
  esquemaFiltrosDomiciliarios,
} from '../../modules/domiciliarios/domiciliarios.schemas.js';
import { esquemaLiquidar } from '../../modules/pedidos/pedidos.schemas.js';
import { cuerpo, operacion, parametros, respuesta } from '../ayudantes.js';
import { DOMICILIARIO, ID, PEDIDO_DOMICILIO } from '../ejemplos.js';

const idDomiciliario = parametros('path', esquemaParamsId, {
  id: { descripcion: 'Id del domiciliario.', ejemplo: ID.domiciliario },
});
const CON_ACCESO = { ...DOMICILIARIO, acceso: { email: 'pedro@laindustria.test', activo: true } };

const CONSULTAN = /** @type {const} */ (['dueno', 'administrador', 'cajero']);
const GESTIONAN = /** @type {const} */ (['dueno', 'administrador']);

export const documentacionDomiciliarios = {
  '/domiciliarios': {
    get: operacion({
      etiqueta: 'Domiciliarios',
      resumen: 'Listar los domiciliarios',
      roles: [...CONSULTAN],
      descripcion: `
Los domiciliarios del negocio: primero los activos, por nombre. Con \`?activos=true\`, solo
los que pueden llevar pedidos (para elegir al despachar un domicilio).`,
      parametros: parametros('query', esquemaFiltrosDomiciliarios, {
        activos: { descripcion: '`true`: solo los activos.', ejemplo: 'true' },
      }),
      respuestas: { 200: respuesta('Lista de domiciliarios.', [DOMICILIARIO]) },
      errores: ['400'],
    }),
    post: operacion({
      etiqueta: 'Domiciliarios',
      resumen: 'Registrar un domiciliario',
      roles: [...GESTIONAN],
      descripcion: `
Registra a quien lleva los domicilios. No inicia sesión: la caja le asigna los pedidos al
despacharlos y le manda los datos por WhatsApp a su teléfono.`,
      cuerpo: cuerpo(esquemaCrearDomiciliario, {
        ejemplo: { nombre: 'Pedro Gómez', telefono: '3001234567' },
      }),
      respuestas: { 201: respuesta('Domiciliario registrado.', DOMICILIARIO) },
      errores: ['400'],
    }),
  },

  '/domiciliarios/{id}': {
    patch: operacion({
      etiqueta: 'Domiciliarios',
      resumen: 'Editar o desactivar un domiciliario',
      roles: [...GESTIONAN],
      descripcion: `
Cambia su nombre o su teléfono, o lo desactiva (\`activo: false\`). Los domiciliarios no se
borran: así se conserva el historial de los domicilios que llevaron.`,
      parametros: idDomiciliario,
      cuerpo: cuerpo(esquemaActualizarDomiciliario, { ejemplo: { activo: false } }),
      respuestas: {
        200: respuesta('Domiciliario actualizado.', { ...DOMICILIARIO, activo: false }),
      },
      errores: ['400', '404'],
    }),
  },

  '/domiciliarios/{id}/acceso': {
    post: operacion({
      etiqueta: 'Domiciliarios',
      resumen: 'Darle acceso a Zenda a un domiciliario',
      roles: ['dueno'],
      descripcion: `
Crea su usuario (rol \`domiciliario\`) con el correo y la contraseña que el dueño le entrega.
Desde su celular ve **solo sus entregas**, navega con Google Maps o Waze y las marca como
entregadas. Si ya tuvo acceso y se le quitó, se reactiva con estos datos.

**Reglas**
- El domiciliario debe estar activo (409 \`DOMICILIARIO_INACTIVO\`) y sin acceso vigente (409
  \`ACCESO_EXISTENTE\`); el correo no puede usarlo otra persona del negocio (409 \`YA_EXISTE\`).
- Queda en la auditoría (\`dar_acceso_domiciliario\`), sin la contraseña.
- Su usuario no se puede cambiar de rol desde \`PATCH /usuarios/{id}\` (422 \`ROL_DOMICILIARIO\`).`,
      parametros: idDomiciliario,
      cuerpo: cuerpo(esquemaDarAcceso, {
        ejemplo: { email: 'pedro@laindustria.test', contrasena: 'Domicilios2026' },
      }),
      respuestas: { 201: respuesta('Domiciliario con acceso.', CON_ACCESO) },
      errores: ['400', '404', '409'],
    }),
    delete: operacion({
      etiqueta: 'Domiciliarios',
      resumen: 'Quitarle el acceso a Zenda a un domiciliario',
      roles: ['dueno'],
      descripcion: `
Su usuario queda inactivo y se cierran sus sesiones. Sigue siendo domiciliario: la caja le
puede asignar domicilios como siempre. Si no tiene acceso, 409 \`SIN_ACCESO\`. Queda en la
auditoría (\`quitar_acceso_domiciliario\`).`,
      parametros: idDomiciliario,
      respuestas: {
        200: respuesta('Domiciliario sin acceso.', {
          ...CON_ACCESO,
          acceso: { ...CON_ACCESO.acceso, activo: false },
        }),
      },
      errores: ['400', '404', '409'],
    }),
  },

  '/domiciliarios/{id}/liquidar': {
    post: operacion({
      etiqueta: 'Domiciliarios',
      resumen: 'Liquidar a un domiciliario (recibir el dinero de sus domicilios)',
      roles: ['dueno', 'administrador', 'cajero'],
      descripcion: `
El domiciliario trae a la caja el dinero de sus domicilios **contra entrega** ya entregados
(los que están **por liquidar**). Cada uno queda cobrado por su total, con el método con que
pagó el cliente: \`efectivo\` por defecto, o \`transferencia\` si le pagó por Nequi, por
ejemplo. En efectivo, el billete del cliente (\`pagaCon\`) queda como lo recibido, para el
cambio del recibo. Sin propina.

**Todo o nada:** si un domicilio no se puede liquidar, no se cobra ninguno.
- No existe o no es de este domiciliario: 404.
- Está anulado (409 \`PEDIDO_ANULADO\`), es de pago anticipado (409 \`DOMICILIO_ANTICIPADO\`),
  no se ha entregado (409 \`DOMICILIO_SIN_ENTREGAR\`) o ya se liquidó (409
  \`DOMICILIO_LIQUIDADO\`).

Emite el recibo de cada uno (si el negocio no factura electrónicamente) y queda en la
auditoría (\`liquidar_domiciliario\`). Mientras haya domicilios por liquidar, la caja no se
puede cerrar.

📡 Avisa en tiempo real con \`pedido:pagado\` por cada domicilio.`,
      parametros: idDomiciliario,
      cuerpo: cuerpo(esquemaLiquidar, {
        ejemplo: { pedidos: [{ pedidoId: ID.pedido, metodo: 'efectivo' }] },
      }),
      respuestas: {
        200: respuesta('Domicilios liquidados.', {
          pedidos: [
            {
              ...PEDIDO_DOMICILIO,
              estado: 'pagado',
              entrega: {
                ...PEDIDO_DOMICILIO.entrega,
                domiciliarioId: ID.domiciliario,
                despachadoEn: '2026-10-26T22:40:00.000Z',
                entregadoEn: '2026-10-26T23:05:00.000Z',
              },
            },
          ],
          total: '31000.00',
        }),
      },
      errores: ['400', '404', '409'],
    }),
  },
};
