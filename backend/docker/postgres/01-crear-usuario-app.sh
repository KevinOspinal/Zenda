#!/bin/sh
# Crea el usuario de base de datos con el que se conecta la app y la base de pruebas.
#
# Por qué existe: el usuario dueño de las tablas (POSTGRES_USER) se salta Row-Level Security.
# La app usa otro usuario sin privilegios especiales, así RLS siempre filtra por negocio.
#
# Docker lo ejecuta solo la primera vez que se crea el volumen de PostgreSQL.
# Es seguro ejecutarlo de nuevo: lo que ya existe no se vuelve a crear.
set -e

BASE_PRUEBAS="${POSTGRES_DB}_test"

# 1. Crear el usuario de la app (sin superusuario y sin saltarse RLS) y la base de pruebas.
psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v usuario_app="$APP_DB_USER" \
  -v clave_app="$APP_DB_PASSWORD" \
  -v base_pruebas="$BASE_PRUEBAS" <<'SQL'
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS',
  :'usuario_app', :'clave_app'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'usuario_app')
\gexec

SELECT format('CREATE DATABASE %I', :'base_pruebas')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'base_pruebas')
\gexec
SQL

# 2. Dar permisos en cada base (los permisos en PostgreSQL son por base de datos).
for BASE in "$POSTGRES_DB" "$BASE_PRUEBAS"; do
  psql -v ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" \
    --dbname "$BASE" \
    -v usuario_app="$APP_DB_USER" \
    -v dueno="$POSTGRES_USER" \
    -v base="$BASE" <<'SQL'
-- Permitirle conectarse y usar el esquema public.
GRANT CONNECT ON DATABASE :"base" TO :"usuario_app";
GRANT USAGE ON SCHEMA public TO :"usuario_app";

-- Las tablas que creen las migraciones (con el usuario dueño) quedan disponibles
-- para la app solo con permisos de lectura y escritura de datos, no de estructura.
ALTER DEFAULT PRIVILEGES FOR ROLE :"dueno" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"usuario_app";
ALTER DEFAULT PRIVILEGES FOR ROLE :"dueno" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"usuario_app";
SQL
done
