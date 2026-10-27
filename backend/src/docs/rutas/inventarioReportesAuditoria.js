// @ts-check
// Documentación de /inventario, /reportes y /auditoria.
import {
  esquemaParamsProducto,
  esquemaRegistrarMovimiento,
} from '../../modules/inventario/inventario.schemas.js';
import { esquemaFiltrosAuditoria } from '../../modules/auditoria/auditoria.routes.js';
import { esquemaRangoReporte } from '../../modules/reportes/reportes.schemas.js';
import { cuerpo, operacion, parametros, respuesta } from '../ayudantes.js';
import { ID, RANGO } from '../ejemplos.js';

const VEN_INVENTARIO = /** @type {const} */ (['dueno', 'administrador', 'cajero']);
const MUEVEN_INVENTARIO = /** @type {const} */ (['dueno', 'administrador']);
const VEN_REPORTES = /** @type {const} */ (['dueno', 'administrador']);

/** Parámetros de fecha comunes a los reportes. */
const parametrosRango = parametros('query', esquemaRangoReporte, {
  desde: {
    descripcion: 'Primer día (AAAA-MM-DD, hora de Colombia). Sin fechas: hoy.',
    ejemplo: RANGO.desde,
  },
  hasta: {
    descripcion: 'Último día, incluido. Si se omite, es igual a `desde`. Máximo 366 días de rango.',
    ejemplo: RANGO.hasta,
  },
});

/** Reglas comunes que se explican en cada reporte. */
const REGLAS_REPORTES = `
**Reglas de todos los reportes**
- Una venta cuenta en el **día y la hora en que se cobró**, en hora de Colombia
  (un cobro a las 11:30 p. m. es de ese día, aunque en UTC ya sea el siguiente).
- Solo cuentan los pedidos **pagados**. Los anulados no suman.
- Sin \`desde\` ni \`hasta\`, el reporte es del **día de hoy**.`;

export const documentacionInventarioReportesAuditoria = {
  '/inventario': {
    get: operacion({
      etiqueta: 'Inventario',
      resumen: 'Ver el stock de los productos',
      roles: [...VEN_INVENTARIO],
      descripcion: `
Los productos que **controlan inventario** (por ejemplo, bebidas embotelladas) con su stock.
Los que están en **negativo aparecen primero**: se vendieron sin existencias registradas
y conviene corregirlos con una compra o un ajuste.`,
      respuestas: {
        200: respuesta('Stock por producto.', [
          { id: ID.gaseosa, nombre: 'Gaseosa personal 400 ml', stock: '47', activo: true },
        ]),
      },
    }),
  },

  '/inventario/{productoId}/movimientos': {
    get: operacion({
      etiqueta: 'Inventario',
      resumen: 'Historial de movimientos de un producto',
      roles: [...VEN_INVENTARIO],
      descripcion: `
Los últimos 100 movimientos, del más reciente al más antiguo. **El stock siempre es
la suma de sus movimientos.**

| Tipo | Cantidad | Origen |
|---|---|---|
| \`compra\` | Positiva | Registrada por el administrador o el dueño |
| \`ajuste\` | Positiva o negativa | Corrección manual (con motivo) o devolución por anulación de una venta |
| \`venta\` | Negativa | Automática al cobrar un pedido (trae \`pedidoId\`) |`,
      parametros: parametros('path', esquemaParamsProducto, {
        productoId: { descripcion: 'Id del producto.', ejemplo: ID.gaseosa },
      }),
      respuestas: {
        200: respuesta('Movimientos del producto.', [
          {
            id: 'c3d4e5f6-a7b8-4901-8cde-f01234567890',
            tenantId: ID.negocio,
            productoId: ID.gaseosa,
            pedidoId: ID.pedido,
            tipo: 'venta',
            cantidad: '-1',
            fecha: '2026-10-26T22:40:11.000Z',
          },
          {
            id: 'd4e5f6a7-b8c9-4012-9def-012345678901',
            tenantId: ID.negocio,
            productoId: ID.gaseosa,
            pedidoId: null,
            tipo: 'compra',
            cantidad: '48',
            fecha: '2026-10-26T12:00:00.000Z',
          },
        ]),
      },
      errores: ['400', '404'],
    }),
  },

  '/inventario/movimientos': {
    post: operacion({
      etiqueta: 'Inventario',
      resumen: 'Registrar una compra o un ajuste',
      roles: [...MUEVEN_INVENTARIO],
      descripcion: `
- **Compra** (\`tipo: "compra"\`): entrada de mercancía. Cantidad **positiva**.
- **Ajuste** (\`tipo: "ajuste"\`): corrección por conteo físico, rotura o pérdida. Cantidad
  positiva o negativa y **motivo obligatorio**. Queda en la **auditoría**, porque un ajuste
  podría ocultar un faltante.

Las ventas **no** se registran aquí: las genera el cobro de los pedidos.
El producto debe controlar inventario (si no, 422 \`PRODUCTO_SIN_INVENTARIO\`).`,
      cuerpo: cuerpo(esquemaRegistrarMovimiento, {
        ejemplos: {
          compra: {
            summary: 'Compra: llegaron 24 gaseosas',
            value: { tipo: 'compra', productoId: ID.gaseosa, cantidad: 24 },
          },
          ajuste: {
            summary: 'Ajuste: 2 botellas rotas',
            value: {
              tipo: 'ajuste',
              productoId: ID.gaseosa,
              cantidad: -2,
              motivo: 'Dos botellas rotas',
            },
          },
        },
        descripciones: {
          tipo: '`compra` o `ajuste`.',
          productoId: 'Producto que controla inventario.',
          cantidad: 'Unidades (máximo 3 decimales, nunca 0). En una compra, siempre positiva.',
          motivo: 'Solo en ajustes y obligatorio: por qué se corrige el inventario.',
        },
      }),
      respuestas: {
        201: respuesta('Movimiento registrado con el stock resultante.', {
          productoId: ID.gaseosa,
          nombre: 'Gaseosa personal 400 ml',
          stock: '71',
        }),
      },
      errores: ['400', '404', '422'],
    }),
  },

  '/reportes/resumen': {
    get: operacion({
      etiqueta: 'Reportes',
      resumen: 'Resumen de ventas del periodo',
      roles: [...VEN_REPORTES],
      descripcion: `
Totales del periodo y su distribución en el tiempo.

| Campo | Significado |
|---|---|
| \`ventas\` | Cuántos pedidos se cobraron |
| \`total\` | Lo que pagaron los clientes (precios del menú) |
| \`subtotal\` · \`impuestos\` | Base sin impuesto e INC, calculados como exige la DIAN |
| \`propinas\` | Propinas del periodo. **No son ventas**: no suman al total |
| \`ticketPromedio\` | Total ÷ ventas: lo que gasta en promedio cada venta |
| \`anulaciones\` | Ventas anuladas (no suman al total) |
| \`porHora\` | Ventas por hora (0 a 23): muestra la **hora pico** |
| \`porDia\` | Ventas de cada día del rango |
${REGLAS_REPORTES}`,
      parametros: parametrosRango,
      respuestas: {
        200: respuesta('Resumen del periodo.', {
          rango: RANGO,
          ventas: 3,
          total: '58000.00',
          subtotal: '53703.70',
          impuestos: '4296.30',
          ajusteRedondeo: '0.00',
          propinas: '2500.00',
          ticketPromedio: '19333.33',
          anulaciones: { cantidad: 1, total: '10000.00' },
          porHora: [
            { hora: 12, ventas: 1, total: '28000.00' },
            { hora: 13, ventas: 1, total: '18000.00' },
            { hora: 23, ventas: 1, total: '12000.00' },
          ],
          porDia: [{ fecha: '2026-10-20', ventas: 3, total: '58000.00' }],
        }),
      },
      errores: ['400'],
    }),
  },

  '/reportes/por-producto': {
    get: operacion({
      etiqueta: 'Reportes',
      resumen: 'Ranking de productos vendidos',
      roles: [...VEN_REPORTES],
      descripcion: `
Los productos del que **más vendió al que menos**, con la cantidad, el total y su
**participación** (porcentaje del total). El total usa el precio con que se vendió cada
producto, no el precio actual del menú.
${REGLAS_REPORTES}`,
      parametros: parametrosRango,
      respuestas: {
        200: respuesta('Ranking de productos.', {
          rango: RANGO,
          total: '58000.00',
          productos: [
            {
              productoId: ID.hamburguesa,
              producto: 'IND Classic Artesanal',
              categoria: 'Hamburguesas',
              cantidad: '3',
              total: '36000.00',
              participacion: '62.07',
            },
            {
              productoId: ID.gaseosa,
              producto: 'Gaseosa personal 400 ml',
              categoria: 'Bebidas',
              cantidad: '3',
              total: '12000.00',
              participacion: '20.69',
            },
          ],
        }),
      },
      errores: ['400'],
    }),
  },

  '/reportes/por-metodo-pago': {
    get: operacion({
      etiqueta: 'Reportes',
      resumen: 'Ventas por método de pago',
      roles: [...VEN_REPORTES],
      descripcion: `
Lo cobrado con cada método. Siempre trae los **4 métodos**, aunque alguno esté en cero.

\`pagos\` cuenta pagos, no ventas: una venta pagada mitad en efectivo y mitad con tarjeta
suma un pago a cada método.

Los totales **incluyen las propinas**, porque el cliente las paga junto con la cuenta. Para
ver las propinas aparte, usa \`GET /reportes/resumen\`.
${REGLAS_REPORTES}`,
      parametros: parametrosRango,
      respuestas: {
        200: respuesta('Ventas por método de pago.', {
          rango: RANGO,
          total: '58000.00',
          metodos: [
            { metodo: 'efectivo', pagos: 1, total: '28000.00', participacion: '48.28' },
            { metodo: 'tarjeta', pagos: 1, total: '18000.00', participacion: '31.03' },
            { metodo: 'transferencia', pagos: 1, total: '12000.00', participacion: '20.69' },
            { metodo: 'otro', pagos: 0, total: '0.00', participacion: '0.00' },
          ],
        }),
      },
      errores: ['400'],
    }),
  },

  '/auditoria': {
    get: operacion({
      etiqueta: 'Auditoría',
      resumen: 'Consultar las acciones sensibles',
      roles: ['dueno'],
      descripcion: `
Quién hizo cada acción sensible y cuándo. Los registros **nunca se editan ni se borran**.

| Acción | Cuándo se registra | Qué guarda en \`detalle\` |
|---|---|---|
| \`cambiar_precio\` | Se edita el precio de un producto | Producto, precio anterior y nuevo |
| \`anular_venta\` | Se anula un pedido | Motivo, estado anterior y total |
| \`cerrar_caja\` | Se cierra un turno | Arqueo y ventas por método |
| \`ajustar_inventario\` | Se registra un ajuste de inventario | Producto, cantidad, motivo y stock antes y después |
| \`crear_usuario\` | El dueño crea un empleado | Nombre, correo y rol |
| \`editar_usuario\` | Cambia el nombre, el rol o el estado de un empleado | Valor anterior y nuevo de cada campo |
| \`restablecer_contrasena\` | El dueño restablece la contraseña de un empleado | A quién (nunca la contraseña) |

Devuelve los últimos 200 registros que cumplan los filtros, del más reciente al más antiguo.`,
      parametros: parametros('query', esquemaFiltrosAuditoria, {
        accion: { descripcion: 'Solo esta acción.', ejemplo: 'anular_venta' },
        desde: {
          descripcion: 'Desde este día (AAAA-MM-DD, hora de Colombia).',
          ejemplo: '2026-10-01',
        },
        hasta: { descripcion: 'Hasta este día, incluido.', ejemplo: '2026-10-31' },
      }),
      respuestas: {
        200: respuesta('Registros de auditoría.', [
          {
            id: 'e5f6a7b8-c9d0-4123-8ef0-123456789012',
            tenantId: ID.negocio,
            usuarioId: ID.dueno,
            accion: 'anular_venta',
            entidad: 'pedidos',
            entidadId: ID.pedido,
            detalle: {
              motivo: 'El cliente cambió de opinión',
              estadoAnterior: 'abierto',
              total: '2000.00',
            },
            fecha: '2026-10-26T22:20:00.000Z',
            usuario: { id: ID.dueno, nombre: 'Andrés Gómez', rol: 'dueno' },
          },
        ]),
      },
      errores: ['400'],
    }),
  },
};
