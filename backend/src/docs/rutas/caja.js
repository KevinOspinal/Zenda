// @ts-check
// Documentación de /caja.
import { esquemaParamsId } from '../../lib/esquemas.js';
import { esquemaAbrirCaja, esquemaCerrarCaja } from '../../modules/caja/caja.schemas.js';
import { cuerpo, operacion, parametros, respuesta } from '../ayudantes.js';
import { ID } from '../ejemplos.js';

const MANEJAN_CAJA = /** @type {const} */ (['dueno', 'administrador', 'cajero']);
const VEN_HISTORIAL = /** @type {const} */ (['dueno', 'administrador']);

const TURNO_ABIERTO = {
  id: ID.turno,
  tenantId: ID.negocio,
  abiertoPorId: ID.cajero,
  cerradoPorId: null,
  abiertoEn: '2026-10-26T13:00:00.000Z',
  cerradoEn: null,
  montoInicial: '100000',
  montoContado: null,
};

const RESUMEN = {
  ventasPorMetodo: {
    efectivo: '30000.00',
    tarjeta: '8000.00',
    transferencia: '0.00',
    otro: '0.00',
  },
  totalVendido: '38000.00',
  efectivoEsperado: '130000.00',
  pedidos: { pagados: 1, abiertos: 0, anulados: 1 },
};

const ARQUEO = { efectivoEsperado: '130000.00', montoContado: '129500.00', diferencia: '-500.00' };

const TURNO_CERRADO = {
  ...TURNO_ABIERTO,
  cerradoPorId: ID.cajero,
  cerradoEn: '2026-10-27T03:00:00.000Z',
  montoContado: '129500',
};

export const documentacionCaja = {
  '/caja/abrir': {
    post: operacion({
      etiqueta: 'Caja',
      resumen: 'Abrir la caja (iniciar turno)',
      roles: [...MANEJAN_CAJA],
      descripcion: `
Abre el turno con el efectivo de base para dar cambio. **Sin caja abierta no se pueden
tomar pedidos.**

Solo puede haber **un turno abierto a la vez** por negocio (una caja en el demo).
Si ya hay uno, responde 409 \`TURNO_YA_ABIERTO\`.

📡 Avisa en tiempo real con el evento \`caja:abierta\`.`,
      cuerpo: cuerpo(esquemaAbrirCaja, {
        ejemplo: { montoInicial: 100000 },
        descripciones: {
          montoInicial: 'Efectivo con el que se abre la caja, en pesos. Puede ser 0.',
        },
      }),
      respuestas: { 201: respuesta('Turno abierto.', TURNO_ABIERTO) },
      errores: ['400', '409'],
    }),
  },

  '/caja/actual': {
    get: operacion({
      etiqueta: 'Caja',
      resumen: 'Ver el turno abierto y lo vendido hasta ahora',
      roles: [...MANEJAN_CAJA],
      descripcion: `
El turno abierto con su **resumen**:

| Campo | Significado |
|---|---|
| \`ventasPorMetodo\` | Lo cobrado con cada método de pago |
| \`totalVendido\` | Suma de todos los pagos del turno |
| \`efectivoEsperado\` | Monto inicial + pagos en efectivo: lo que debería haber en la caja |
| \`pedidos\` | Cuántos pedidos están pagados, abiertos y anulados |

Los pagos de pedidos **anulados no cuentan**. Si no hay caja abierta, responde 404 \`SIN_TURNO_ABIERTO\`.`,
      respuestas: {
        200: respuesta('Turno abierto con su resumen.', { ...TURNO_ABIERTO, resumen: RESUMEN }),
      },
      errores: ['404'],
    }),
  },

  '/caja/cerrar': {
    post: operacion({
      etiqueta: 'Caja',
      resumen: 'Cerrar la caja con arqueo',
      roles: [...MANEJAN_CAJA],
      descripcion: `
El cajero **cuenta el efectivo** y lo envía en \`montoContado\`. El sistema lo compara con
el efectivo esperado:

> **diferencia = contado − esperado**
> Positiva = **sobrante** · Negativa = **faltante** · Cero = caja cuadrada

**Reglas**
- No se puede cerrar si quedan **pedidos sin cobrar o anular** (409 \`PEDIDOS_ABIERTOS\`).
- El cierre queda en la **auditoría** con el arqueo y las ventas por método.

📡 Avisa en tiempo real con el evento \`caja:cerrada\` (sin montos).`,
      cuerpo: cuerpo(esquemaCerrarCaja, {
        ejemplo: { montoContado: 129500 },
        descripciones: { montoContado: 'Efectivo contado físicamente al cerrar, en pesos.' },
      }),
      respuestas: {
        200: respuesta('Turno cerrado. En el ejemplo hay un faltante de $500.', {
          ...TURNO_CERRADO,
          resumen: RESUMEN,
          arqueo: ARQUEO,
        }),
      },
      errores: ['400', '404', '409'],
    }),
  },

  '/caja/turnos': {
    get: operacion({
      etiqueta: 'Caja',
      resumen: 'Historial de turnos',
      roles: [...VEN_HISTORIAL],
      descripcion:
        'Los últimos 50 turnos, del más reciente al más antiguo, con quién abrió y quién cerró.',
      respuestas: {
        200: respuesta('Lista de turnos.', [
          {
            ...TURNO_CERRADO,
            abiertoPor: { id: ID.cajero, nombre: 'Camilo Torres' },
            cerradoPor: { id: ID.cajero, nombre: 'Camilo Torres' },
          },
        ]),
      },
    }),
  },

  '/caja/turnos/{id}': {
    get: operacion({
      etiqueta: 'Caja',
      resumen: 'Ver un turno con su arqueo',
      roles: [...VEN_HISTORIAL],
      descripcion:
        'Un turno con su resumen de ventas y, si ya se cerró, su arqueo (`arqueo` es `null` si sigue abierto).',
      parametros: parametros('path', esquemaParamsId, {
        id: { descripcion: 'Id del turno.', ejemplo: ID.turno },
      }),
      respuestas: {
        200: respuesta('El turno.', { ...TURNO_CERRADO, resumen: RESUMEN, arqueo: ARQUEO }),
      },
      errores: ['400', '404'],
    }),
  },
};
