// @ts-check
// Documentación de /health y /auth.
import {
  esquemaCambiarContrasena,
  esquemaLogin,
  esquemaRefreshToken,
} from '../../modules/auth/auth.schemas.js';
import { TODOS, cuerpo, operacion, respuesta } from '../ayudantes.js';
import { ID, TOKEN_EJEMPLO, USUARIO_CAJERO } from '../ejemplos.js';

const SESION_INICIADA = {
  tokenAcceso: TOKEN_EJEMPLO,
  refreshToken: `${ID.negocio}.7ywvXO7mMRWSMxACuKPwYA6DzfkT6OYBjtaEuTdL7_0`,
  expiraEnSegundos: 900,
  usuario: USUARIO_CAJERO,
};

const cuerpoRefresh = cuerpo(esquemaRefreshToken, {
  ejemplo: { refreshToken: SESION_INICIADA.refreshToken },
  descripciones: { refreshToken: 'El `refreshToken` que entregó el login o la última renovación.' },
});

export const documentacionAuth = {
  '/health': {
    get: operacion({
      etiqueta: 'Sistema',
      resumen: 'Comprobar que el API y sus servicios funcionan',
      roles: null,
      descripcion: `
Comprueba que el API responde y que puede hablar con **PostgreSQL** y **Redis**.

- **200**: todo funciona.
- **503**: el API está vivo pero algún servicio no responde (en \`servicios\` se ve cuál).
  Revisa que Docker esté encendido: \`docker compose up -d\`.

Los servidores (Docker, balanceadores) usan este endpoint para saber si deben reiniciar
el proceso o dejar de enviarle tráfico.`,
      respuestas: {
        200: respuesta('Todo funciona.', {
          status: 'ok',
          servicios: { baseDeDatos: 'ok', redis: 'ok' },
        }),
        503: respuesta('Algún servicio no responde.', {
          status: 'error',
          servicios: { baseDeDatos: 'ok', redis: 'caido' },
        }),
      },
    }),
  },

  '/auth/login': {
    post: operacion({
      etiqueta: 'Autenticación',
      resumen: 'Iniciar sesión',
      roles: null,
      descripcion: `
Entrega el **token de acceso** con el que se usan todos los demás endpoints.

**Cómo usar la respuesta**
1. Copia \`tokenAcceso\`.
2. Haz clic en el botón **Authorize** 🔒 (arriba a la derecha) y pégalo.
3. Guarda también el \`refreshToken\`: sirve para renovar la sesión sin volver a escribir la contraseña.

**Por qué se pide el NIT:** el sistema atiende a varios negocios y el mismo correo
puede existir en dos negocios distintos. El NIT indica en cuál buscar.

**Seguridad**
- El token de acceso dura **15 minutos**. Después responde \`TOKEN_EXPIRADO\`: usa \`/auth/refresh\`.
- Tras **5 intentos fallidos seguidos**, la cuenta se bloquea **15 minutos** (responde 423).
- Desde una misma IP se permiten **10 intentos por minuto** (si no, 429), para frenar a
  quien prueba muchas cuentas.
- El mensaje de error es el mismo si falla el NIT, el correo o la contraseña, para no dar pistas.

**Usuarios de prueba** (NIT \`900111222\`, contraseña = \`SEED_CONTRASENA\` de tu \`.env\`):
\`dueno@laindustria.test\`, \`admin@laindustria.test\`, \`cajero@laindustria.test\`,
\`laura@laindustria.test\` (mesero).`,
      cuerpo: cuerpo(esquemaLogin, {
        ejemplo: { nit: '900111222', email: 'cajero@laindustria.test', password: 'tu-contraseña' },
        descripciones: {
          nit: 'NIT del negocio: solo dígitos, sin puntos ni dígito de verificación.',
          email: 'Correo del usuario. No importan mayúsculas ni espacios al inicio o al final.',
          password: 'Contraseña del usuario.',
        },
      }),
      respuestas: {
        200: respuesta('Sesión iniciada.', SESION_INICIADA),
        401: respuesta('NIT, correo o contraseña incorrectos.', {
          error: {
            code: 'CREDENCIALES_INVALIDAS',
            message: 'NIT, correo o contraseña incorrectos',
          },
        }),
      },
      errores: ['400', '423', '429'],
    }),
  },

  '/auth/refresh': {
    post: operacion({
      etiqueta: 'Autenticación',
      resumen: 'Renovar el token de acceso',
      roles: null,
      descripcion: `
Cambia un \`refreshToken\` por un token de acceso nuevo **y un refreshToken nuevo**.

⚠️ **Cada refreshToken sirve una sola vez.** Guarda siempre el nuevo que llega en la respuesta.
Si alguien vuelve a usar un refreshToken que ya se usó para renovar, el sistema asume que
fue robado y **cierra todas las sesiones** de ese usuario por seguridad.

Límite: **30 renovaciones por minuto** por IP (si no, 429).`,
      cuerpo: cuerpoRefresh,
      respuestas: {
        200: respuesta('Tokens nuevos.', SESION_INICIADA),
        401: respuesta('El refreshToken no existe, venció, ya se usó o se cerró la sesión.', {
          error: {
            code: 'REFRESH_INVALIDO',
            message: 'La sesión no es válida; inicie sesión de nuevo',
          },
        }),
      },
      errores: ['400', '429'],
    }),
  },

  '/auth/logout': {
    post: operacion({
      etiqueta: 'Autenticación',
      resumen: 'Cerrar sesión',
      roles: null,
      descripcion: `
Revoca el \`refreshToken\`: ya no servirá para renovar la sesión. El token de acceso
actual sigue funcionando hasta que venza (máximo 15 minutos).

Cerrar sesión dos veces no es un error: siempre responde 204.`,
      cuerpo: cuerpoRefresh,
      respuestas: { 204: respuesta('Sesión cerrada. Sin contenido.') },
      errores: ['400'],
    }),
  },

  '/auth/cambiar-contrasena': {
    post: operacion({
      etiqueta: 'Autenticación',
      resumen: 'Cambiar mi contraseña',
      roles: TODOS,
      descripcion: `
Cada usuario cambia su propia contraseña dando la actual.

Por seguridad **se cierran todas tus sesiones** (por ejemplo, la de un celular perdido) y la
respuesta trae **tokens nuevos** para que sigas trabajando sin volver a iniciar sesión.
Si usas Swagger, vuelve a autorizar con el \`tokenAcceso\` nuevo.`,
      cuerpo: cuerpo(esquemaCambiarContrasena, {
        ejemplo: { contrasenaActual: 'tu-contraseña-actual', contrasenaNueva: 'MiClaveNueva2026' },
        descripciones: {
          contrasenaActual: 'Tu contraseña de hoy.',
          contrasenaNueva:
            'La nueva: mínimo 8 caracteres, con al menos una letra y un número, y distinta a la actual.',
        },
      }),
      respuestas: {
        200: respuesta('Contraseña cambiada. Sesión nueva.', SESION_INICIADA),
        401: respuesta('La contraseña actual no es correcta (o el token no es válido).', {
          error: { code: 'CONTRASENA_INCORRECTA', message: 'La contraseña actual no es correcta' },
        }),
      },
      errores: ['400', '422'],
    }),
  },

  '/auth/yo': {
    get: operacion({
      etiqueta: 'Autenticación',
      resumen: 'Ver el usuario autenticado y su negocio',
      roles: TODOS,
      descripcion: `
Devuelve quién es el dueño del token y a qué negocio pertenece. Útil para comprobar que
el token funciona y para mostrar el nombre del usuario en la app.`,
      respuestas: {
        200: respuesta('Usuario y negocio.', {
          usuario: USUARIO_CAJERO,
          negocio: {
            id: ID.negocio,
            nombre: 'La Industria',
            nit: '900111222',
            ciudad: 'Cali',
            regimenImpuesto: 'responsable_inc',
          },
        }),
      },
    }),
  },
};
