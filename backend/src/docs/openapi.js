// @ts-check
// Documento OpenAPI 3.1 del API: lo muestra Swagger UI en /docs.
//
// Estructura:
// - INTRODUCCION: guía para empezar, convenciones, roles, impuestos y tiempo real.
// - ERRORES: respuestas de error comunes, con ejemplos, que reutilizan todos los endpoints.
// - rutas/*.js: un archivo por módulo con sus endpoints.
import { documentacionAuth } from './rutas/auth.js';
import { documentacionCaja } from './rutas/caja.js';
import { documentacionInventarioReportesAuditoria } from './rutas/inventarioReportesAuditoria.js';
import { documentacionMenu } from './rutas/menu.js';
import { documentacionMesasYClientes } from './rutas/mesasYClientes.js';
import { documentacionNegocios } from './rutas/negocios.js';
import { documentacionPedidos } from './rutas/pedidos.js';
import { documentacionUsuarios } from './rutas/usuarios.js';

const INTRODUCCION = `
API del software de administración para restaurantes y cafeterías. Cubre el ciclo de una
venta: **mesa → pedido → cocina → cobro**, con caja, inventario, reportes y auditoría.

---

## 🚀 Cómo empezar (3 pasos)

1. Abre **Autenticación → POST /auth/login**, haz clic en **Try it out**, escribe tus datos
   y presiona **Execute**. Copia el \`tokenAcceso\` de la respuesta.
2. Haz clic en el botón **Authorize** 🔒 (arriba a la derecha), pega el token y presiona
   **Authorize**. Desde ahora todos los endpoints lo envían solos.
3. Prueba cualquier endpoint con **Try it out → Execute**.

> ⏱️ El token dura **15 minutos**. Si una respuesta dice \`TOKEN_EXPIRADO\`, repite el paso 1
> (o usa \`POST /auth/refresh\`) y vuelve a autorizar.

**¿Negocio nuevo?** Regístralo con \`POST /negocios/registro\`: la respuesta ya trae el
token del dueño.

**Usuarios de prueba** (negocio "La Industria", NIT \`900111222\`, contraseña = \`SEED_CONTRASENA\`
de tu archivo \`.env\`):

| Rol | Correo |
|---|---|
| Dueño | \`dueno@laindustria.test\` |
| Administrador | \`admin@laindustria.test\` |
| Cajero | \`cajero@laindustria.test\` |
| Mesero | \`laura@laindustria.test\` |

---

## 🧾 Flujo de una venta

| Paso | Quién | Endpoint |
|---|---|---|
| 1. Abrir la caja | Cajero | \`POST /caja/abrir\` |
| 2. Ver mesas y menú | Mesero | \`GET /mesas\` · \`GET /menu\` |
| 3. Tomar el pedido | Mesero | \`POST /pedidos\` |
| 4. Enviar a cocina | Mesero | \`POST /pedidos/{id}/enviar-cocina\` |
| 5. La cocina avanza los productos | Cocina | \`PATCH /pedidos/{id}/items/{itemId}/cocina\` |
| 6. Cobrar | Cajero | \`POST /pedidos/{id}/cobrar\` |
| 7. Cerrar la caja con arqueo | Cajero | \`POST /caja/cerrar\` |
| 8. Revisar el día | Dueño | \`GET /reportes/resumen\` · \`GET /auditoria\` |

---

## 👥 Roles

| Rol | Puede |
|---|---|
| **Dueño** | Todo, incluidos los empleados (usuarios) y la auditoría |
| **Administrador** | Menú, mesas, inventario, caja, anulaciones y reportes |
| **Cajero** | Caja, cobros, clientes y consulta de inventario |
| **Mesero** | Tomar pedidos, enviarlos a cocina y consultar menú y mesas. **No cobra** |

Cada endpoint indica arriba **quién puede usarlo**. Si no tienes permiso, responde **403**.

---

## 📐 Convenciones

**Dinero**
- Se **envía** como número o texto, **sin puntos de miles** y con máximo 2 decimales:
  \`12000\` o \`"12000.50"\`. Nunca \`"12.000"\` (es ambiguo: ¿doce mil o doce?).
- Se **recibe como texto** (\`"12000"\`) para no perder precisión con decimales.
- Los precios del menú **ya incluyen el impuesto**: es lo que paga el cliente.

**Fechas**
- Los filtros usan \`AAAA-MM-DD\` y son **días en hora de Colombia** (UTC−5).
- Las respuestas traen fechas en formato ISO y en UTC (\`2026-10-26T22:15:03.120Z\`).

**Identificadores**: todos son UUID. Un id que no es UUID responde **400** antes de buscar.

**Negocios**: cada usuario solo ve los datos de **su negocio**. Un id de otro negocio
responde **404**, como si no existiera. Esto lo garantiza la base de datos (Row-Level Security).

---

## ⚠️ Errores

Todos los errores tienen el mismo formato:

\`\`\`json
{ "error": { "code": "MESA_OCUPADA", "message": "La Mesa 1 ya tiene un pedido abierto" } }
\`\`\`

\`code\` es estable (sirve para programar la app); \`message\` es legible para mostrar al usuario.

| Código HTTP | Significado | Qué hacer |
|---|---|---|
| **400** | Datos inválidos (\`VALIDATION_ERROR\`) | Revisa el mensaje: dice qué campo falla |
| **401** | Sin token, token inválido o vencido | Inicia sesión o renueva el token |
| **403** | Tu rol no puede hacer esto (\`SIN_PERMISO\`) | Usa un usuario con el rol indicado |
| **404** | No existe (o es de otro negocio) | Revisa el id |
| **409** | Conflicto con el estado actual | Ej.: mesa ocupada, caja cerrada, pedido ya cobrado |
| **422** | Una regla de negocio lo impide | Ej.: los pagos no suman el total |
| **423** | Cuenta bloqueada por intentos fallidos | Espera 15 minutos |
| **429** | Demasiadas peticiones desde tu IP (\`DEMASIADAS_SOLICITUDES\`) | Espera lo que indica el encabezado \`Retry-After\` |

---

## 🧮 Cómo se calculan los impuestos

Los restaurantes y cafeterías cobran **Impuesto Nacional al Consumo (INC) del 8 %**
(Estatuto Tributario, art. 512-9); los negocios bajo franquicia, **IVA del 19 %**.

El precio del menú es el precio final. El sistema calcula los valores de la factura **como
exige la DIAN** (Anexo técnico 1.9), con redondeo "a la par":

| Paso | Ejemplo: 2 hamburguesas de $12.000 con INC 8 % |
|---|---|
| Valor unitario sin impuesto (6 decimales) | 12.000 ÷ 1,08 = 11.111,111111 |
| Base de la línea | 11.111,111111 × 2 = **22.222,22** |
| Impuesto = base × tarifa | 22.222,22 × 0,08 = **1.777,78** |
| Total | **24.000** |

Si por redondeo la suma difiere en centavos del precio del menú, la diferencia va en
\`ajusteRedondeo\`: el cliente **siempre paga exactamente** lo que dice el menú.

---

## 📡 Tiempo real (Socket.IO)

Las pantallas se actualizan solas, sin volver a consultar. Conéctate a la misma dirección
del API con el token de acceso:

\`\`\`js
import { io } from 'socket.io-client';
const socket = io('http://localhost:3000', { auth: { token: '<tokenAcceso>' } });
socket.on('pedido:enviado_a_cocina', (comanda) => console.log(comanda));
\`\`\`

En Postman: **New → Socket.IO**, encabezado \`Authorization: Bearer <tokenAcceso>\`.

Cada dispositivo solo recibe los eventos **de su negocio**. Los eventos no llevan datos
personales de clientes, montos de caja ni arqueos.

| Evento | Cuándo llega | Datos |
|---|---|---|
| \`pedido:creado\` | Se crea un pedido | id, estado, mesa, mesero, total |
| \`pedido:actualizado\` | Se agregan o quitan productos | Lo anterior + la comanda (\`items\`) |
| \`pedido:enviado_a_cocina\` | Se envía a cocina | **La comanda**: productos, cantidades y notas |
| \`item:estado_cocina\` | La cocina avanza un producto | Pedido, mesa, producto y estado (\`listo\`…) |
| \`pedido:pagado\` | Se cobra | id, estado, mesa, total |
| \`pedido:anulado\` | Se anula | id, estado, mesa, total |
| \`mesa:estado\` | Una mesa se ocupa o se libera | mesaId, nombre, estado |
| \`caja:abierta\` · \`caja:cerrada\` | Se abre o se cierra la caja | turnoId y la hora |
| \`sesion:expirada\` | Venció el token (luego se desconecta) | Renueva el token y vuelve a conectar |

Si la conexión se rechaza, el error \`connect_error\` trae \`NO_AUTENTICADO\`,
\`TOKEN_INVALIDO\` o \`TOKEN_EXPIRADO\`.
`;

/**
 * Respuesta de error con uno o varios ejemplos.
 * @param {string} descripcion
 * @param {Record<string, [code: string, message: string]>} ejemplos
 */
function error(descripcion, ejemplos) {
  return {
    description: descripcion,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
        examples: Object.fromEntries(
          Object.entries(ejemplos).map(([nombre, [code, message]]) => [
            nombre,
            { summary: code, value: { error: { code, message } } },
          ]),
        ),
      },
    },
  };
}

/** Errores comunes que reutilizan todos los endpoints. */
const ERRORES = {
  Error400: error('Datos inválidos: el mensaje indica qué campo falla.', {
    validacion: [
      'VALIDATION_ERROR',
      'Datos inválidos. precio: debe ser un valor en pesos sin separadores de miles y con máximo 2 decimales',
    ],
    json: ['INVALID_JSON', 'El cuerpo no es JSON válido'],
  }),
  Error401: error('Falta el token, es inválido o venció.', {
    sinToken: ['NO_AUTENTICADO', 'Debe iniciar sesión'],
    vencido: ['TOKEN_EXPIRADO', 'La sesión expiró'],
    invalido: ['TOKEN_INVALIDO', 'Token de acceso inválido'],
  }),
  Error403: error('Tu rol no tiene permiso para esta acción.', {
    sinPermiso: ['SIN_PERMISO', 'No tiene permiso para esta acción'],
  }),
  Error404: error('No existe, o pertenece a otro negocio.', {
    noEncontrado: ['NO_ENCONTRADO', 'El registro no existe'],
    mesa: ['MESA_NO_ENCONTRADA', 'La mesa no existe'],
    producto: ['PRODUCTO_NO_ENCONTRADO', 'El producto no existe'],
  }),
  Error409: error('Conflicto con el estado actual de los datos.', {
    yaExiste: ['YA_EXISTE', 'Ya existe un registro con esos datos'],
    enUso: ['EN_USO', 'No se puede eliminar porque otros registros lo usan'],
    mesaOcupada: ['MESA_OCUPADA', 'La Mesa 1 ya tiene un pedido abierto'],
    cajaCerrada: ['CAJA_CERRADA', 'Abra la caja antes de tomar pedidos'],
    pedidoCerrado: ['PEDIDO_CERRADO', 'El pedido ya fue cobrado o anulado'],
  }),
  Error422: error('Una regla de negocio impide la acción.', {
    pagoNoCuadra: [
      'PAGO_NO_CUADRA',
      'Los pagos suman 28000.00 y deben sumar 31000.00 (total 28000.00 + propina 3000.00)',
    ],
    propinaExcedeTotal: [
      'PROPINA_EXCEDE_TOTAL',
      'La propina (280000.00) no puede ser mayor que el total del pedido (28000.00)',
    ],
    productoInactivo: ['PRODUCTO_INACTIVO', '"Agua" no está disponible en el menú'],
    impuesto: [
      'IMPUESTO_NO_PERMITIDO',
      'Un negocio con régimen "responsable_inc" no puede cobrar "iva"',
    ],
  }),
  Error429: error(
    'Demasiadas peticiones desde tu IP. El encabezado Retry-After indica cuántos segundos esperar.',
    {
      limite: [
        'DEMASIADAS_SOLICITUDES',
        'Demasiados intentos. Espere hasta 60 segundos e intente de nuevo',
      ],
    },
  ),
  Error423: error('Cuenta bloqueada temporalmente por intentos fallidos.', {
    bloqueada: ['CUENTA_BLOQUEADA', 'Demasiados intentos fallidos. Intente de nuevo en 15 minutos'],
  }),
};

/** Documento OpenAPI completo. */
export const documentoOpenApi = {
  openapi: '3.1.0',
  info: {
    title: 'Zenda · API para restaurantes y cafeterías',
    version: '0.1.0',
    description: INTRODUCCION,
  },
  servers: [{ url: '/', description: 'Este servidor' }],
  // Por defecto todos los endpoints requieren token; los públicos lo anulan.
  security: [{ tokenAcceso: [] }],
  tags: [
    { name: 'Sistema', description: 'Estado del servicio.' },
    {
      name: 'Negocios',
      description:
        'Registro de un restaurante o cafetería nuevo con su dueño, y configuración del negocio (propina sugerida).',
    },
    {
      name: 'Autenticación',
      description: 'Iniciar sesión, renovar el token y cerrar sesión. **Empieza aquí.**',
    },
    {
      name: 'Usuarios',
      description:
        'Empleados del negocio: crear, cambiar rol, desactivar y restablecer contraseñas.',
    },
    { name: 'Menú', description: 'Categorías y productos. El menú para tomar pedidos.' },
    { name: 'Mesas', description: 'Mesas del local y su estado (libre u ocupada).' },
    { name: 'Clientes', description: 'Personas o empresas que piden factura a su nombre.' },
    { name: 'Caja', description: 'Apertura de turno, resumen de lo vendido y cierre con arqueo.' },
    {
      name: 'Pedidos',
      description: 'El ciclo de una venta: crear, agregar productos, cocina, cobrar y anular.',
    },
    {
      name: 'Inventario',
      description: 'Stock de los productos que lo controlan, compras y ajustes.',
    },
    { name: 'Reportes', description: 'Ventas del periodo, por producto y por método de pago.' },
    { name: 'Auditoría', description: 'Registro de acciones sensibles. Solo lo ve el dueño.' },
  ],
  paths: {
    ...documentacionNegocios,
    ...documentacionAuth,
    ...documentacionUsuarios,
    ...documentacionMenu,
    ...documentacionMesasYClientes,
    ...documentacionCaja,
    ...documentacionPedidos,
    ...documentacionInventarioReportesAuditoria,
  },
  components: {
    securitySchemes: {
      tokenAcceso: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Pega aquí el `tokenAcceso` que entrega `POST /auth/login` (sin la palabra "Bearer"). Dura 15 minutos.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        description: 'Formato de todos los errores del API.',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', description: 'Código estable para programar la app.' },
              message: { type: 'string', description: 'Mensaje legible para mostrar al usuario.' },
            },
          },
        },
      },
    },
    responses: ERRORES,
  },
};
