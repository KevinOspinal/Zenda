-- Row-Level Security: aislamiento entre negocios.
--
-- Cada petición fija el negocio activo con:
--   SELECT set_config('app.tenant_id', '<uuid del negocio>', true);
-- y PostgreSQL solo deja ver y modificar filas de ese negocio.
-- Si no hay negocio activo, no se ve ninguna fila.
--
-- Prisma no crea políticas, por eso viven aquí. El archivo es idempotente:
-- se aplica después de cada migración (npm run db:migrate / db:deploy).
-- Al crear una tabla nueva con tenant_id, agréguela a la lista de abajo.
-- La prueba tests/aislamiento.test.js falla si alguna tabla queda sin RLS.

-- 1. Negocio activo de la sesión. NULLIF evita un error cuando la variable quedó vacía:
--    en ese caso devuelve NULL y la política no deja pasar ninguna fila.
CREATE OR REPLACE FUNCTION negocio_activo() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$;

-- 2. Activar RLS y crear la política en cada tabla de negocio.
--    FORCE hace que la política aplique incluso al dueño de la tabla.
--    USING filtra lo que se lee; WITH CHECK impide escribir filas de otro negocio.
DO $$
DECLARE
  tabla text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    'usuarios',
    'sesiones_usuario',
    'mesas',
    'categorias',
    'productos',
    'movimientos_inventario',
    'clientes',
    'turnos_caja',
    'pedidos',
    'items_pedido',
    'pagos',
    'resoluciones_facturacion',
    'documentos_fiscales',
    'credenciales_proveedor',
    'auditoria'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabla);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tabla);
    EXECUTE format('DROP POLICY IF EXISTS aislamiento_por_negocio ON %I', tabla);
    EXECUTE format(
      'CREATE POLICY aislamiento_por_negocio ON %I
         USING (tenant_id = negocio_activo())
         WITH CHECK (tenant_id = negocio_activo())',
      tabla
    );
  END LOOP;
END $$;

-- 3. La auditoría solo admite inserciones: nadie distinto al dueño puede editarla ni borrarla.
DO $$
DECLARE
  rol text;
BEGIN
  FOR rol IN
    SELECT DISTINCT grantee
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'auditoria'
      AND privilege_type IN ('UPDATE', 'DELETE', 'TRUNCATE')
      AND grantee <> current_user
  LOOP
    EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON auditoria FROM %I', rol);
  END LOOP;
END $$;
