// @ts-check
// Documentación de /pedidos.
import { esquemaParamsId } from '../../lib/esquemas.js';
import {
  esquemaActualizarDomicilio,
  esquemaAnular,
  esquemaCobrar,
  esquemaCrearPedido,
  esquemaDespachar,
  esquemaDividir,
  esquemaEstadoCocina,
  esquemaEstadoCocinaPedido,
  esquemaFiltrosPedidos,
  esquemaItem,
  esquemaParamsItem,
} from '../../modules/pedidos/pedidos.schemas.js';
import { ATIENDEN, TODOS, cuerpo, operacion, parametros, respuesta } from '../ayudantes.js';
import { ID, PEDIDO, PEDIDO_DOMICILIO } from '../ejemplos.js';

const COBRAN = /** @type {const} */ (['dueno', 'administrador', 'cajero']);
const ANULAN = /** @type {const} */ (['dueno', 'administrador']);

const idPedido = parametros('path', esquemaParamsId, {
  id: { descripcion: 'Id del pedido.', ejemplo: ID.pedido },
});
const idPedidoEItem = parametros('path', esquemaParamsItem, {
  id: { descripcion: 'Id del pedido.', ejemplo: ID.pedido },
  itemId: {
    descripcion: 'Id del ítem (está en la lista `items` del pedido).',
    ejemplo: ID.itemHamburguesa,
  },
});

const DESCRIPCIONES_ITEM = {
  productoId: 'Producto del menú (sácalo de `GET /menu`). Debe estar activo.',
  cantidad: 'Unidades, mayor que cero. Admite hasta 3 decimales (por ejemplo `0.5` porción).',
  notas: 'Indicaciones para la cocina, por ejemplo "Sin cebolla". Opcional.',
};

/** El pedido de ejemplo ya cobrado. */
const PEDIDO_PAGADO = {
  ...PEDIDO,
  estado: 'pagado',
  cerradoEn: '2026-10-26T22:40:11.000Z',
  mesa: { ...PEDIDO.mesa, estado: 'libre' },
  pagos: [
    {
      id: ID.pago,
      tenantId: ID.negocio,
      pedidoId: ID.pedido,
      metodo: 'efectivo',
      monto: '20000',
      referencia: null,
      creadoEn: '2026-10-26T22:40:11.000Z',
    },
    {
      id: 'b2c3d4e5-f6a7-4890-9bcd-ef0123456789',
      tenantId: ID.negocio,
      pedidoId: ID.pedido,
      metodo: 'tarjeta',
      monto: '8000',
      referencia: 'APROB-123456',
      creadoEn: '2026-10-26T22:40:11.000Z',
    },
  ],
};

export const documentacionPedidos = {
  '/pedidos': {
    post: operacion({
      etiqueta: 'Pedidos',
      resumen: 'Crear un pedido (en mesa, de mostrador o a domicilio)',
      roles: ATIENDEN,
      descripcion: `
Crea un pedido, con o sin productos iniciales. Cada pedido recibe un **número del día**
(\`numero\`: #1, #2...; vuelve a 1 cada día, en hora de Colombia) con el que se identifican los
que no tienen mesa.

**Tipos** (\`tipo\`; si no llega, \`mesa\` con \`mesaId\` y \`mostrador\` sin él)
- **mesa**: necesita \`mesaId\`; la mesa pasa a **ocupada**. Una mesa admite un solo pedido
  abierto (si ya tiene uno, 409 \`MESA_OCUPADA\`).
- **mostrador**: comer en el local sin mesa o recoger. \`nombreCliente\` sirve para llamarlo.
- **domicilio**: necesita \`nombreCliente\` y \`entrega\` (teléfono y dirección). Suma
  \`valorDomicilio\` al total (si no llega, el del negocio: $3.000 por defecto), por ahora sin
  impuesto: ⚠️ el contador debe confirmar cuál lleva. Solo lo registran **cajero,
  administrador y dueño** (si no, 403): los datos de entrega son personales (Ley 1581).

\`origen\` dice por dónde llegó (\`local\`, \`whatsapp\`, \`telefono\`, \`otro\`); sirve para
los reportes por canal. La propina solo se sugiere en mesa (\`propinaSugerida\` es 0 en los demás).

**Reglas**
- Requiere la **caja abierta** (si no, 409 \`CAJA_CERRADA\`).
- Cada ítem **copia el precio y el impuesto del momento**: si después cambia el menú,
  este pedido no se altera.
- Los totales se calculan solos (ver "Cómo se calculan los impuestos" al inicio).

**Pedidos sin internet (\`uuidOffline\`):** si la app vendió sin conexión, envía el UUID que
generó. Si el mismo pedido llega dos veces, la segunda vez **no se duplica**: responde
**200** con el pedido existente en lugar de 201.

📡 Avisa en tiempo real: \`pedido:creado\` y, si tiene mesa, \`mesa:estado\`.`,
      cuerpo: cuerpo(esquemaCrearPedido, {
        ejemplos: {
          mesa: {
            summary: 'Pedido en mesa con productos',
            value: {
              mesaId: ID.mesa,
              items: [
                { productoId: ID.hamburguesa, cantidad: 2, notas: 'Sin cebolla' },
                { productoId: ID.gaseosa, cantidad: 1 },
              ],
            },
          },
          mostrador: {
            summary: 'Venta de mostrador (sin mesa)',
            value: { items: [{ productoId: ID.gaseosa, cantidad: 2 }] },
          },
          domicilio: {
            summary: 'Domicilio que llegó por WhatsApp',
            value: {
              tipo: 'domicilio',
              origen: 'whatsapp',
              nombreCliente: 'Juan',
              entrega: {
                telefono: '3109876543',
                direccion: 'Calle 10 # 5-20, barrio San Antonio',
                indicaciones: 'Apto 302, timbre dañado',
                pagaCon: 50000,
              },
              items: [
                { productoId: ID.hamburguesa, cantidad: 2 },
                { productoId: ID.gaseosa, cantidad: 1 },
              ],
            },
          },
          offline: {
            summary: 'Pedido hecho sin internet',
            value: {
              uuidOffline: ID.uuidOffline,
              items: [{ productoId: ID.hamburguesa, cantidad: 1 }],
            },
          },
        },
        descripciones: {
          tipo: '`mesa`, `mostrador` o `domicilio`.',
          mesaId: 'Mesa del pedido (solo tipo `mesa`).',
          origen: 'Por dónde llegó: `local` (por defecto), `whatsapp`, `telefono` u `otro`.',
          nombreCliente: 'Nombre para llamar al cliente (obligatorio en domicilios).',
          entrega: 'Solo domicilios: teléfono, dirección, indicaciones y con cuánto paga.',
          'entrega.pagaCon': 'Con cuánto paga en efectivo, para llevarle el cambio.',
          valorDomicilio: 'Solo domicilios. Si no llega, el valor por defecto del negocio.',
          uuidOffline: 'UUID generado por la app al vender sin internet. Evita duplicados.',
          items: 'Productos iniciales. Se pueden agregar más después.',
          ...Object.fromEntries(
            Object.entries(DESCRIPCIONES_ITEM).map(([campo, texto]) => [`items.${campo}`, texto]),
          ),
        },
      }),
      respuestas: {
        201: respuesta(
          'Pedido creado. 2 × $12.000 + 1 × $4.000 = $28.000 (base $25.925,92 + INC $2.074,08).',
          PEDIDO,
        ),
        200: respuesta(
          'El pedido ya existía (mismo `uuidOffline`): se devuelve sin duplicarlo.',
          PEDIDO,
        ),
      },
      errores: ['400', '404', '409', '422'],
    }),
    get: operacion({
      etiqueta: 'Pedidos',
      resumen: 'Listar pedidos',
      roles: TODOS,
      descripcion: `
Los últimos 100 pedidos, del más reciente al más antiguo. Se pueden filtrar por estado y por mesa.

**Para el mapa de mesas:** \`?activos=true&incluirItems=true\` trae en una sola petición los
pedidos que aún no se cobran ni se anulan, cada uno con sus ítems y el estado de cocina de
cada ítem.

**Para la cocina:** \`?cocina=true&incluirItems=true\` trae las comandas del tablero: pedidos
enviados a cocina con algún plato por entregar, **aunque ya se hayan cobrado** (el cliente pudo
pagar antes de que salieran sus platos). Los cobrados se incluyen durante 12 horas, para que no
se acumulen los platos que nadie marcó como entregados. Las ventas que se cobraron sin pasar por
la cocina no aparecen.

**Para la caja:** \`?domicilios=true\` trae los domicilios que no se han entregado (de las
últimas 24 horas), con sus ítems y sus datos de entrega. Solo para cajero, administrador y
dueño (si no, 403).

Los datos de entrega (\`entrega\`) solo llegan al cajero, al administrador y al dueño.

Solo se puede usar uno de estos filtros: \`estado\`, \`activos\`, \`cocina\` o \`domicilios\`
(si no, 400).`,
      parametros: parametros('query', esquemaFiltrosPedidos, {
        estado: {
          descripcion: '`abierto`, `enviado_a_cocina`, `pagado` o `anulado`.',
          ejemplo: 'abierto',
        },
        mesaId: { descripcion: 'Solo los pedidos de esta mesa.', ejemplo: ID.mesa },
        activos: {
          descripcion: '`true`: solo los abiertos y los que están en cocina.',
          ejemplo: 'true',
        },
        cocina: {
          descripcion:
            '`true`: las comandas de la cocina, incluidas las ya cobradas con platos por entregar.',
          ejemplo: 'true',
        },
        domicilios: {
          descripcion:
            '`true`: los domicilios sin entregar, con ítems y datos de entrega (solo la caja).',
          ejemplo: 'true',
        },
        incluirItems: {
          descripcion: '`true`: incluye los ítems de cada pedido (con el nombre del producto).',
          ejemplo: 'true',
        },
      }),
      respuestas: {
        200: respuesta('Lista de pedidos (sin ítems, salvo con `incluirItems=true`).', [
          {
            ...Object.fromEntries(
              Object.entries(PEDIDO).filter(
                ([campo]) => !['items', 'pagos', 'cliente', 'propinaSugerida'].includes(campo),
              ),
            ),
            mesa: { id: ID.mesa, nombre: 'Mesa 1' },
          },
        ]),
      },
      errores: ['400', '403'],
    }),
  },

  '/pedidos/{id}': {
    get: operacion({
      etiqueta: 'Pedidos',
      resumen: 'Ver un pedido completo',
      roles: TODOS,
      descripcion: `
El pedido con sus ítems (en el orden en que se agregaron), pagos, mesa y cliente.

Trae \`propinaSugerida\`: la propina que el mesero le sugiere al cliente antes de cobrar.
Es el porcentaje del negocio (10 % por defecto, ver \`PATCH /negocios/actual\`) sobre el
**subtotal antes de impuestos**, en pesos enteros. Todas las respuestas que devuelven el
pedido completo la incluyen.`,
      parametros: idPedido,
      respuestas: { 200: respuesta('El pedido.', PEDIDO) },
      errores: ['400', '404'],
    }),
  },

  '/pedidos/{id}/items': {
    post: operacion({
      etiqueta: 'Pedidos',
      resumen: 'Agregar un producto al pedido',
      roles: ATIENDEN,
      descripcion: `
Agrega un ítem y **recalcula los totales**. Funciona aunque el pedido ya esté en cocina:
la cocina recibe el cambio en tiempo real.

No se puede agregar a un pedido cobrado o anulado (409 \`PEDIDO_CERRADO\`), ni un
producto inactivo (422 \`PRODUCTO_INACTIVO\`).

📡 Avisa en tiempo real con \`pedido:actualizado\`, que incluye la comanda completa.`,
      parametros: idPedido,
      cuerpo: cuerpo(esquemaItem, {
        ejemplo: { productoId: ID.hamburguesa, cantidad: 1, notas: 'Término medio' },
        descripciones: DESCRIPCIONES_ITEM,
      }),
      respuestas: {
        200: respuesta('Pedido con el ítem nuevo y los totales actualizados.', PEDIDO),
      },
      errores: ['400', '404', '409', '422'],
    }),
  },

  '/pedidos/{id}/items/{itemId}': {
    delete: operacion({
      etiqueta: 'Pedidos',
      resumen: 'Quitar un producto del pedido',
      roles: ATIENDEN,
      descripcion: `
Quita un ítem y recalcula los totales. Solo si **la cocina no ha empezado a prepararlo**
(estado de cocina \`pendiente\`); si no, 409 \`ITEM_EN_PREPARACION\`.

📡 Avisa en tiempo real con \`pedido:actualizado\`.`,
      parametros: idPedidoEItem,
      respuestas: { 200: respuesta('Pedido sin el ítem y con los totales actualizados.', PEDIDO) },
      errores: ['400', '404', '409'],
    }),
  },

  '/pedidos/{id}/items/{itemId}/cocina': {
    patch: operacion({
      etiqueta: 'Pedidos',
      resumen: 'Avanzar el estado de cocina de un producto',
      roles: TODOS,
      descripcion: `
La cocina avanza cada ítem por separado, **solo hacia adelante**:

> \`pendiente\` → \`preparando\` → \`listo\` → \`entregado\`

Intentar retroceder o repetir un estado responde 409 \`CAMBIO_COCINA_INVALIDO\`.
Funciona aunque el pedido ya esté pagado (en comidas rápidas se cobra antes de cocinar).

**Quién marca cada paso** (si no, 403 \`SIN_PERMISO\`)
- \`preparando\` y \`listo\`: cocina, cajero, administrador y dueño. El mesero no: eso lo sabe la cocina.
- \`entregado\`: todos. La cocina solo en pedidos sin mesa (mostrador, "Ya salió"); en una mesa
  lo confirma el mesero.

📡 Avisa en tiempo real con \`item:estado_cocina\`: cuando un ítem está **listo**, el mesero se entera.`,
      parametros: idPedidoEItem,
      cuerpo: cuerpo(esquemaEstadoCocina, {
        ejemplo: { estadoCocina: 'listo' },
        descripciones: { estadoCocina: 'Estado nuevo: `preparando`, `listo` o `entregado`.' },
      }),
      respuestas: { 200: respuesta('Pedido con el ítem actualizado.', PEDIDO) },
      errores: ['400', '403', '404', '409'],
    }),
  },

  '/pedidos/{id}/cocina': {
    patch: operacion({
      etiqueta: 'Pedidos',
      resumen: 'Avanzar todos los platos de un pedido a la vez',
      roles: TODOS,
      descripcion: `
Avanza de una vez los platos que pueden pasar a ese estado:
- \`listo\`: los pendientes y los que se preparan ("Todo listo" de la cocina).
- \`entregado\`: los que ya están listos ("Entregar todo" del mesero; "Ya salió" en mostrador).
  Lo que sigue en preparación se queda: se entrega cuando esté listo.

Mismas reglas de quién marca cada paso que \`PATCH /pedidos/{id}/items/{itemId}/cocina\`
(si no, 403 \`SIN_PERMISO\`). Si ningún plato puede pasar a ese estado, 409
\`NADA_QUE_AVANZAR\`.

📡 Avisa en tiempo real con **un solo** \`pedido:estado_cocina\` con todos los platos que
cambiaron, para que el mesero reciba un solo aviso por mesa.`,
      parametros: idPedido,
      cuerpo: cuerpo(esquemaEstadoCocinaPedido, {
        ejemplo: { estadoCocina: 'entregado' },
        descripciones: { estadoCocina: '`listo` o `entregado`.' },
      }),
      respuestas: { 200: respuesta('Pedido con sus platos actualizados.', PEDIDO) },
      errores: ['400', '403', '404', '409'],
    }),
  },

  '/pedidos/{id}/enviar-cocina': {
    post: operacion({
      etiqueta: 'Pedidos',
      resumen: 'Enviar el pedido a cocina',
      roles: ATIENDEN,
      descripcion: `
Cambia el pedido a \`enviado_a_cocina\`. Sin cuerpo. El pedido debe tener al menos un
producto (si no, 409 \`PEDIDO_VACIO\`). Repetirlo no es un error.

La primera vez guarda la hora en \`enviadoACocinaEn\`; reenviar no la cambia. Con ella la
cocina sigue viendo el pedido aunque se cobre antes de que salgan sus platos.

📡 Avisa en tiempo real con \`pedido:enviado_a_cocina\`: **la comanda** con productos,
cantidades y notas.`,
      parametros: idPedido,
      respuestas: {
        200: respuesta('Pedido enviado a cocina.', {
          ...PEDIDO,
          estado: 'enviado_a_cocina',
          enviadoACocinaEn: '2026-10-26T22:16:40.512Z',
        }),
      },
      errores: ['400', '404', '409'],
    }),
  },

  '/pedidos/{id}/dividir': {
    post: operacion({
      etiqueta: 'Pedidos',
      resumen: 'Dividir la cuenta',
      roles: ATIENDEN,
      descripcion: `
Para cuando en una mesa cada persona paga lo suyo: pasa productos a una **cuenta nueva
en la misma mesa**. Cada cuenta se cobra por separado, así **cada persona puede tener su
propia factura**.

**Cómo funciona**
- Indica qué ítems pasan y **cuántas unidades** de cada uno. Ejemplo: de un ítem con
  2 hamburguesas puedes pasar 1; la otra se queda en la cuenta original.
- Los productos conservan su **precio, impuesto, notas y estado de cocina**.
- Los totales de ambas cuentas se recalculan; sumados, dan lo mismo que antes.
- La mesa sigue **ocupada** hasta que se cobren todas sus cuentas.
- Se puede dividir varias veces (por ejemplo, en tres cuentas).

**Errores**
- Pasar más unidades de las que tiene el ítem, o pasar **todo** (la cuenta original debe
  conservar algo): 422 \`DIVISION_INVALIDA\`.
- Un ítem que no es de este pedido: 404. Pedido ya cobrado o anulado: 409.

📡 Avisa en tiempo real: \`pedido:actualizado\` (la original) y \`pedido:creado\` (la nueva).`,
      parametros: idPedido,
      cuerpo: cuerpo(esquemaDividir, {
        ejemplo: {
          items: [
            { itemId: ID.itemHamburguesa, cantidad: 1 },
            { itemId: ID.itemGaseosa, cantidad: 1 },
          ],
        },
        descripciones: {
          items: 'Ítems que pasan a la cuenta nueva. Cada ítem puede aparecer una sola vez.',
          'items.itemId': 'Id del ítem (está en la lista `items` del pedido).',
          'items.cantidad':
            'Unidades que pasan a la cuenta nueva: todas las del ítem o solo una parte.',
        },
      }),
      respuestas: {
        201: respuesta(
          'Cuenta dividida. La original queda con 1 hamburguesa ($12.000) y la nueva con 1 hamburguesa y 1 gaseosa ($16.000).',
          {
            original: {
              ...PEDIDO,
              subtotal: '11111.11',
              impuestos: '888.89',
              total: '12000',
              items: [{ ...PEDIDO.items[0], cantidad: '1' }],
            },
            nuevo: {
              ...PEDIDO,
              id: 'c4d5e6f7-a8b9-4c0d-9e1f-2a3b4c5d6e7f',
              uuidOffline: 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b',
              subtotal: '14814.81',
              impuestos: '1185.19',
              total: '16000',
              items: [
                {
                  ...PEDIDO.items[0],
                  id: 'f6a7b8c9-d0e1-4f2a-8b3c-4d5e6f7a8b9c',
                  pedidoId: 'c4d5e6f7-a8b9-4c0d-9e1f-2a3b4c5d6e7f',
                  cantidad: '1',
                },
                { ...PEDIDO.items[1], pedidoId: 'c4d5e6f7-a8b9-4c0d-9e1f-2a3b4c5d6e7f' },
              ],
            },
          },
        ),
      },
      errores: ['400', '404', '409', '422'],
    }),
  },

  '/pedidos/{id}/cobrar': {
    post: operacion({
      etiqueta: 'Pedidos',
      resumen: 'Cobrar el pedido',
      roles: [...COBRAN],
      descripcion: `
Cobra con **uno o varios pagos** (por ejemplo, parte en efectivo y parte con tarjeta).

**Propina voluntaria** (Ley 1935 de 2018)
- El mesero le muestra al cliente la \`propinaSugerida\` del pedido y le **pregunta** si
  quiere darla. El cliente puede aceptarla, cambiar el valor o no darla.
- Si la da, se envía en \`propina\`. Si no, se omite el campo.
- La propina **no es venta del negocio**: no cambia el total, no lleva impuesto y la
  caja y los reportes la muestran aparte.
- No puede ser mayor que el total del pedido (422 \`PROPINA_EXCEDE_TOTAL\`), para evitar
  errores como un cero de más.

**Reglas**
- Los pagos deben sumar **exactamente** el total **más la propina** (si no, 422
  \`PAGO_NO_CUADRA\`).
- \`monto\` es lo que se abona a la cuenta. En efectivo, envía \`recibido\` (el billete del
  cliente) y la respuesta trae el **cambio** a devolver. El cambio no entra a la caja.
- Se puede cobrar desde \`abierto\`: en comidas rápidas el cliente paga antes de que cocinen.
- Con \`clienteId\`, la factura irá a nombre de ese cliente; sin él, a "consumidor final".

**Qué pasa al cobrar**
1. El pedido queda \`pagado\` y la mesa, **libre**.
2. Los productos que controlan inventario **se descuentan del stock**. Si alguno queda en
   negativo, se cobra igual y llega en \`advertencias\`.

📡 Avisa en tiempo real: \`pedido:pagado\` y \`mesa:estado\`.`,
      parametros: idPedido,
      cuerpo: cuerpo(esquemaCobrar, {
        ejemplos: {
          mixto: {
            summary: 'Efectivo (con cambio) + tarjeta',
            value: {
              pagos: [
                { metodo: 'efectivo', monto: 20000, recibido: 50000 },
                { metodo: 'tarjeta', monto: 8000, referencia: 'APROB-123456' },
              ],
            },
          },
          propina: {
            summary: 'Con propina: el cliente acepta dar $3.000',
            value: {
              propina: 3000,
              pagos: [{ metodo: 'efectivo', monto: 31000, recibido: 50000 }],
            },
          },
          cliente: {
            summary: 'Transferencia con factura a nombre de un cliente',
            value: {
              pagos: [{ metodo: 'transferencia', monto: 28000, referencia: 'NEQUI-998877' }],
              clienteId: ID.cliente,
            },
          },
        },
        descripciones: {
          pagos: 'Uno o varios pagos (máximo 10) que suman exactamente el total más la propina.',
          propina:
            'Propina voluntaria que decidió dar el cliente, en pesos. Opcional: sin ella, los pagos suman solo el total.',
          'pagos.metodo': '`efectivo`, `tarjeta`, `transferencia` u `otro`.',
          'pagos.monto': 'Lo que se abona a la cuenta con este pago, en pesos.',
          'pagos.referencia': 'Número de aprobación del datáfono o de la transferencia. Opcional.',
          'pagos.recibido':
            'Solo en efectivo: el billete que entrega el cliente, para calcular el cambio. Debe ser mayor o igual que `monto`.',
          clienteId: 'Cliente a cuyo nombre se factura. Opcional.',
        },
      }),
      respuestas: {
        200: respuesta('Pedido cobrado.', {
          pedido: PEDIDO_PAGADO,
          cambio: '30000.00',
          advertencias: [],
        }),
      },
      errores: ['400', '404', '409', '422'],
    }),
  },

  '/pedidos/{id}/anular': {
    post: operacion({
      etiqueta: 'Pedidos',
      resumen: 'Anular un pedido',
      roles: [...ANULAN],
      descripcion: `
Anula un pedido abierto o cobrado. Exige un **motivo** y queda en la **auditoría**.

**Qué pasa al anular**
- La mesa queda **libre** (si el pedido la ocupaba).
- Si estaba cobrado: sus pagos **salen del resumen de caja** y el inventario descontado
  **se devuelve**.
- Un pedido cobrado solo se anula mientras su **turno de caja siga abierto**, para no
  alterar un arqueo ya cerrado (si no, 409 \`TURNO_CERRADO\`).

📡 Avisa en tiempo real: \`pedido:anulado\` y \`mesa:estado\`.`,
      parametros: idPedido,
      cuerpo: cuerpo(esquemaAnular, {
        ejemplo: { motivo: 'El cliente se fue sin pedir' },
        descripciones: { motivo: 'Por qué se anula. Queda en la auditoría.' },
      }),
      respuestas: {
        200: respuesta('Pedido anulado.', {
          ...PEDIDO,
          estado: 'anulado',
          cerradoEn: '2026-10-26T22:20:00.000Z',
          mesa: { ...PEDIDO.mesa, estado: 'libre' },
        }),
      },
      errores: ['400', '404', '409'],
    }),
  },

  '/pedidos/{id}/domicilio': {
    patch: operacion({
      etiqueta: 'Pedidos',
      resumen: 'Corregir los datos de un domicilio',
      roles: [...COBRAN],
      descripcion: `
Corrige a quién y a dónde se lleva, con cuánto paga y el **valor del domicilio** (se ajusta si
es lejos). Envía solo lo que cambia; \`null\` en \`indicaciones\` o \`pagaCon\` los borra.

**Reglas**
- Solo domicilios (si no, 409 \`NO_ES_DOMICILIO\`), sin anular ni entregar (409).
- \`valorDomicilio\` cambia el total: solo antes de cobrar (si no, 409 \`PEDIDO_CERRADO\`).

📡 Avisa en tiempo real con \`pedido:actualizado\`.`,
      parametros: idPedido,
      cuerpo: cuerpo(esquemaActualizarDomicilio, {
        ejemplo: { valorDomicilio: 5000, indicaciones: 'Portería del conjunto, torre 3' },
      }),
      respuestas: {
        200: respuesta('Domicilio actualizado.', {
          ...PEDIDO_DOMICILIO,
          valorDomicilio: '5000',
          subtotal: '30925.92',
          total: '33000',
        }),
      },
      errores: ['400', '404', '409'],
    }),
  },

  '/pedidos/{id}/despachar': {
    post: operacion({
      etiqueta: 'Pedidos',
      resumen: 'Despachar un domicilio con un domiciliario',
      roles: [...COBRAN],
      descripcion: `
El domicilio sale del local con el domiciliario: queda la hora (\`entrega.despachadoEn\`) y
quién lo lleva. Sus platos salen de la cocina (quedan \`entregado\`), aunque nadie los haya
marcado listos: la caja es quien ve salir la bolsa.

**Reglas**
- Domicilio sin anular, sin entregar y que no haya salido (409), con productos (409
  \`PEDIDO_VACIO\`).
- El domiciliario debe existir (404) y estar activo (409 \`DOMICILIARIO_INACTIVO\`).
- Se puede despachar antes de cobrar (contra entrega) o después (pago por adelantado).

📡 Avisa en tiempo real con \`pedido:actualizado\`.`,
      parametros: idPedido,
      cuerpo: cuerpo(esquemaDespachar, { ejemplo: { domiciliarioId: ID.domiciliario } }),
      respuestas: {
        200: respuesta('Domicilio en camino.', {
          ...PEDIDO_DOMICILIO,
          entrega: {
            ...PEDIDO_DOMICILIO.entrega,
            domiciliarioId: ID.domiciliario,
            despachadoEn: '2026-10-26T22:40:00.000Z',
            domiciliario: { id: ID.domiciliario, nombre: 'Pedro Gómez', telefono: '3001234567' },
          },
        }),
      },
      errores: ['400', '404', '409'],
    }),
  },

  '/pedidos/{id}/entregar': {
    post: operacion({
      etiqueta: 'Pedidos',
      resumen: 'Marcar entregado un pedido sin mesa',
      roles: [...COBRAN],
      descripcion: `
- **Domicilio:** el cliente lo recibió (\`entrega.entregadoEn\`). Debe haber salido antes con un
  domiciliario (si no, 409 \`DOMICILIO_SIN_DESPACHAR\`). Si es contra entrega, cóbralo
  primero con \`POST /pedidos/{id}/cobrar\`.
- **Mostrador:** el cliente lo recogió; lo que quedara en la cocina sale con él.
- **Mesa:** no aplica (409 \`ENTREGA_EN_MESA\`): el mesero marca cada plato como entregado.

Sin cuerpo.

📡 Avisa en tiempo real con \`pedido:actualizado\`.`,
      parametros: idPedido,
      respuestas: {
        200: respuesta('Pedido entregado.', {
          ...PEDIDO_DOMICILIO,
          estado: 'pagado',
          entrega: {
            ...PEDIDO_DOMICILIO.entrega,
            despachadoEn: '2026-10-26T22:40:00.000Z',
            entregadoEn: '2026-10-26T23:05:00.000Z',
          },
        }),
      },
      errores: ['400', '404', '409'],
    }),
  },
};
