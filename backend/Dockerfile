# syntax=docker/dockerfile:1
#
# Imagen del API de Zenda. Tiene varias etapas:
#
#   dependencias → todas las dependencias (con la CLI de Prisma) y el cliente generado.
#   migraciones  → aplica las migraciones y las políticas de RLS, y termina.
#   produccion   → el API, solo con lo necesario para correr (etapa por defecto).
#
# Construir y correr:
#   docker build -t zenda-api .                                # imagen del API
#   docker build -t zenda-migraciones --target migraciones .  # imagen de migraciones
#
# Ningún secreto entra en la imagen: la configuración llega por variables de entorno
# al crear el contenedor (ver .env.example y docker-compose.yml).

ARG NODE_VERSION=26

# ─────────────────────────────── Base común ───────────────────────────────
FROM node:${NODE_VERSION}-slim AS base
WORKDIR /app
# La CLI de Prisma necesita OpenSSL para conectarse a PostgreSQL al migrar.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# ─────────────────── Etapa 1: dependencias y cliente de Prisma ───────────────────
FROM base AS dependencias
# Primero solo los archivos de dependencias: si el código cambia pero ellas no,
# Docker reutiliza esta capa y la construcción es mucho más rápida.
COPY package.json package-lock.json prisma.config.js ./
COPY prisma ./prisma
# `npm ci` instala exactamente lo del package-lock.json y ejecuta `prisma generate`
# (postinstall). La configuración de Prisma exige la URL de migraciones aunque generar
# el cliente no se conecta a la base: se pasa una de relleno solo para este paso.
RUN DATABASE_URL_MIGRACIONES=postgresql://sin-conexion@localhost/sin-conexion npm ci

# ─────────────────── Etapa 2: migraciones (se ejecuta y termina) ───────────────────
FROM dependencias AS migraciones
# Necesita DATABASE_URL_MIGRACIONES (el usuario dueño de las tablas).
# `db:deploy` aplica las migraciones pendientes y después prisma/rls.sql.
# Sin avisos de versiones nuevas de npm y Prisma en los registros.
ENV NPM_CONFIG_UPDATE_NOTIFIER=false PRISMA_HIDE_UPDATE_MESSAGE=true
USER node
CMD ["npm", "run", "db:deploy"]

# ─────────────── Etapa 3: dependencias de producción (sin las de desarrollo) ───────────────
FROM dependencias AS dependencias-produccion
# Quita ESLint, Vitest, etc. `--omit=optional` quita también la CLI de Prisma: el
# package-lock la marca como de desarrollo y opcional a la vez (@prisma/client la
# declara como opcional), y el API no la usa al correr. Ninguna dependencia opcional
# hace falta en el servidor. El cliente generado (node_modules/.prisma) se conserva.
RUN npm prune --omit=dev --omit=optional

# ─────────────────────── Etapa 4: el API (por defecto) ───────────────────────
FROM node:${NODE_VERSION}-slim AS produccion
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=dependencias-produccion /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Corre con un usuario sin privilegios: si alguien encuentra una falla en la app,
# no tiene permisos de administrador dentro del contenedor.
USER node
EXPOSE 3000

# Docker revisa cada 30 segundos que el API responda y que la base y Redis estén
# disponibles (/health responde 503 si alguno falla).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

# Node recibe directamente las señales de Docker (SIGTERM) y cierra de forma ordenada
# (ver src/server.js).
CMD ["node", "src/server.js"]
