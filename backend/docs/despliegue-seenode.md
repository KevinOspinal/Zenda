# Despliegue del piloto en Seenode

Guía paso a paso para publicar Zenda en [Seenode](https://seenode.com): el API, el frontend y
PostgreSQL. Se despliega desde la rama `despliegue-seenode`; `main` sigue siendo la rama de
trabajo.

## Qué se crea

| Pieza                     | Tipo en Seenode                                | Carpeta    | Costo aprox. |
| ------------------------- | ---------------------------------------------- | ---------- | ------------ |
| Base de datos             | PostgreSQL 16, plan Basic (1 GB, copia diaria) |            | USD 4/mes    |
| API (Express + Socket.IO) | Web service, plan Basic (0,5 GB)               | `backend`  | USD 4/mes    |
| Frontend (Nuxt SPA)       | Static site                                    | `frontend` | Gratis       |

Redis no se usa en el piloto: sin `REDIS_URL`, los límites de intentos de login se guardan en
la memoria del API. Sirve mientras el API tenga **una sola réplica**. La cola de facturación
(Factus) sí necesitará Redis.

## Reglas

- Ninguna contraseña ni clave va en el repositorio ni en un chat. Se escriben solo en el panel
  de Seenode y en tu terminal.
- Las claves se generan con este comando (solo letras, números, `-` y `_`, seguras dentro de
  una URL):

  ```bash
  node -e "console.log(require('node:crypto').randomBytes(36).toString('base64url'))"
  ```

## Paso 1. Subir la rama

```bash
git push -u origin despliegue-seenode
```

## Paso 2. Crear la base de datos

1. En Seenode: **New → Database → PostgreSQL**, versión **16**, plan **Basic**.
2. En la pestaña de copias de seguridad, programa una **copia diaria**.
3. En **Connection** copia la URL (URI) del usuario de la base. Este es el **usuario dueño**:
   lo usan solo las migraciones.

## Paso 3. Crear el usuario de la app

La app se conecta con un usuario sin privilegios, para que Row-Level Security siempre filtre
por negocio y la auditoría solo admita inserciones. Hazlo antes del primer despliegue del API.

1. Genera la contraseña del usuario de la app con el comando de las reglas y guárdala.
2. En tu terminal, desde la carpeta `backend` (usa la URL pública de la base):

   ```bash
   docker run --rm -i postgres:16-alpine psql "URL_DEL_DUENO" \
     -v usuario_app=zenda_app -v clave_app='CONTRASENA_DE_LA_APP' \
     -f - < prisma/usuario-app.sql
   ```

3. Al final debe mostrar `zenda_app | f | f` (no es superusuario y no se salta RLS).

Si se conecta pero se queja de SSL, agrega `?sslmode=require` al final de la URL.

**Plan B**: si el script se detiene con _"no puede crear usuarios (CREATE ROLE)"_, la app usará
el usuario dueño (en el paso 4, `DATABASE_URL` igual a `DATABASE_URL_MIGRACIONES`). RLS sigue
filtrando por negocio porque las tablas tienen `FORCE ROW LEVEL SECURITY`, siempre que ese
usuario no sea superusuario ni tenga `BYPASSRLS`. Revísalo con:

```sql
SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;
```

Ambos deben ser `f`. Lo que se pierde es que la auditoría sea de solo inserción.

## Paso 4. Crear el API

**New → Web service**, desde el repositorio de GitHub:

| Campo          | Valor                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Rama           | `despliegue-seenode`                                                                                                          |
| Root directory | `backend`                                                                                                                     |
| Lenguaje       | Node 24                                                                                                                       |
| Build command  | `DATABASE_URL_MIGRACIONES=${DATABASE_URL_MIGRACIONES:-postgresql://sin-conexion@localhost/sin-conexion} npm ci --include=dev` |
| Start command  | `npm run db:deploy && exec node src/server.js`                                                                                |
| Port           | `3000`                                                                                                                        |
| Réplicas       | 1                                                                                                                             |

- El build instala también las dependencias de desarrollo porque la CLI de Prisma las necesita
  para migrar. La URL de relleno solo sirve para generar el cliente de Prisma si la variable no
  está disponible al construir (no se conecta a nada).
- Seenode no tiene un paso previo al despliegue: el arranque aplica las migraciones y
  `prisma/rls.sql` y después inicia el API. Repetirlas en cada arranque no cambia nada.

Variables de entorno:

| Variable                   | Valor                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                 | `production`                                                                                       |
| `PORT`                     | `3000`                                                                                             |
| `DATABASE_URL`             | `postgresql://zenda_app:CONTRASENA_DE_LA_APP@HOST:PUERTO/BASE` (host privado si Seenode lo ofrece) |
| `DATABASE_URL_MIGRACIONES` | La URL del usuario dueño (paso 2)                                                                  |
| `JWT_SECRET`               | Una clave generada (mínimo 32 caracteres)                                                          |
| `CORS_ORIGENES`            | Por ahora `http://localhost:3001`; en el paso 6 va la URL del frontend                             |
| `CONFIAR_EN_PROXY`         | `true` (Seenode pone un proxy delante del API)                                                     |
| `LOG_LEVEL`                | `info`                                                                                             |

No configures `REDIS_URL` ni `DOCS_HABILITADA`. El registro de negocios queda cerrado en
producción.

**Comprobar**: abre `https://URL-DEL-API/health`. Debe responder:

```json
{ "status": "ok", "servicios": { "baseDeDatos": "ok", "redis": "sin_configurar" } }
```

## Paso 5. Crear el frontend

**New → Static site**, desde el mismo repositorio:

| Campo                     | Valor                                   |
| ------------------------- | --------------------------------------- |
| Rama                      | `despliegue-seenode`                    |
| Root directory            | `frontend`                              |
| Build command             | `npm ci --include=dev && npm run build` |
| Publish directory         | `.output/public`                        |
| Client-side routing (SPA) | Activado (viene así)                    |

Variables de entorno (se usan al construir y quedan dentro de la app; aquí nunca van secretos):

| Variable                          | Valor                                    |
| --------------------------------- | ---------------------------------------- |
| `NUXT_PUBLIC_API_URL`             | `https://URL-DEL-API` (sin `/` al final) |
| `NUXT_PUBLIC_REGISTRO_HABILITADO` | `false`                                  |

Si cambias una variable del frontend, hay que volver a construirlo.

## Paso 6. Conectar el API con el frontend

En el API cambia `CORS_ORIGENES` a la URL del frontend, con `https://` y sin `/` al final, por
ejemplo `https://zenda-xxxx.seenode.app`. Guarda para que se vuelva a desplegar.

## Paso 7. Registrar el restaurante piloto

La base queda limpia, sin los negocios de ejemplo (no se ejecuta `db:seed`).

1. En el API agrega `REGISTRO_HABILITADO=true` y espera el despliegue.
2. Abre `https://URL-DEL-FRONTEND/registro` y registra el restaurante con su NIT y la cuenta
   del dueño.
3. Quita `REGISTRO_HABILITADO` del API para volver a cerrar el registro.

## Paso 8. Prueba completa

- Ingreso del dueño, mesas, menú y usuarios (mesero, cajero, cocina).
- Mesa → pedido → cocina → cobro → recibo.
- Un domicilio contra entrega con el domiciliario desde un celular real: despachar, Google
  Maps o Waze, "Entregado" y la liquidación en la caja.
- Tiempo real: la cocina y la caja se actualizan sin recargar.

## Actualizar el piloto

El trabajo sigue en `main`. Para publicar lo nuevo:

```bash
git switch despliegue-seenode
git merge main
git push
git switch main
```

Seenode vuelve a desplegar al recibir el push (auto-deploy). Si algo sale mal, en el servicio
está la opción de volver a un despliegue anterior (rollback).

## Problemas comunes

| Síntoma                                                   | Causa probable                                                                |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `/health` responde 503 con `baseDeDatos: "caido"`         | `DATABASE_URL` mal escrita, host equivocado o falta `?sslmode=require`        |
| El navegador muestra errores de CORS                      | `CORS_ORIGENES` no coincide exacto con la URL del frontend                    |
| Todo el restaurante recibe "Demasiados intentos" a la vez | El API ve la IP del proxy y no la de cada persona: revisar `CONFIAR_EN_PROXY` |
| El frontend llama a `localhost:3000`                      | Falta `NUXT_PUBLIC_API_URL` al construir el frontend                          |
| El API se reinicia por memoria                            | Subir el API al plan Standard (1 GB)                                          |
