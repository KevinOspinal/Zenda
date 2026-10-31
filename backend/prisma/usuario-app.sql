-- Crea el usuario con el que se conecta la app en producción (por ejemplo, en Seenode).
--
-- Por qué: la app no debe conectarse con el usuario dueño de las tablas. Con un usuario sin
-- privilegios especiales, Row-Level Security siempre filtra por negocio y la auditoría solo
-- admite inserciones (ver rls.sql). En desarrollo esto lo hace docker/postgres/01-crear-usuario-app.sh.
--
-- Se ejecuta con psql y el usuario dueño de la base, idealmente ANTES del primer despliegue
-- del API. La contraseña se escribe en la terminal; nunca va en el repositorio:
--
--   psql "<URL del usuario dueño>" -v usuario_app=zenda_app -v clave_app='<contraseña>' \
--     -f prisma/usuario-app.sql
--
-- Es seguro ejecutarlo de nuevo: si el usuario ya existe, solo cambia su contraseña y
-- vuelve a dar los permisos.
\set ON_ERROR_STOP on

-- 1. El dueño debe poder crear usuarios. Si no puede, se detiene sin cambiar nada.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = current_user AND (rolsuper OR rolcreaterole)
  ) THEN
    RAISE EXCEPTION 'El usuario % no puede crear usuarios (CREATE ROLE). Use el plan B de docs/despliegue-seenode.md.', current_user;
  END IF;
END $$;

-- 2. Crear el usuario de la app (sin superusuario y sin saltarse RLS) o cambiar su contraseña.
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS',
  :'usuario_app', :'clave_app'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'usuario_app')
\gexec

SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', :'usuario_app', :'clave_app')
\gexec

-- 3. Permisos de datos, no de estructura: conectarse, usar el esquema y leer y escribir filas.
SELECT current_database() AS base, current_user AS dueno \gset

GRANT CONNECT ON DATABASE :"base" TO :"usuario_app";
GRANT USAGE ON SCHEMA public TO :"usuario_app";

-- Las tablas que creen las migraciones más adelante (con el usuario dueño).
ALTER DEFAULT PRIVILEGES FOR ROLE :"dueno" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"usuario_app";
ALTER DEFAULT PRIVILEGES FOR ROLE :"dueno" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"usuario_app";

-- Y las que ya existan, si el API ya se desplegó antes de correr este script.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"usuario_app";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"usuario_app";

-- 4. La auditoría solo admite inserciones (igual que en rls.sql), si la tabla ya existe.
SELECT format('REVOKE UPDATE, DELETE, TRUNCATE ON auditoria FROM %I', :'usuario_app')
WHERE to_regclass('public.auditoria') IS NOT NULL
\gexec

-- 5. Resultado: las dos columnas de privilegios deben decir f (falso).
SELECT rolname AS usuario_app, rolsuper AS superusuario, rolbypassrls AS se_salta_rls
FROM pg_roles
WHERE rolname = :'usuario_app';
