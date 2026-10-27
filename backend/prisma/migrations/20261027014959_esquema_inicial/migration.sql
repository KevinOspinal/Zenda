-- CreateEnum
CREATE TYPE "rol_usuario" AS ENUM ('dueno', 'administrador', 'cajero', 'mesero');

-- CreateEnum
CREATE TYPE "estado_mesa" AS ENUM ('libre', 'ocupada');

-- CreateEnum
CREATE TYPE "tipo_impuesto" AS ENUM ('iva', 'impoconsumo', 'exento');

-- CreateEnum
CREATE TYPE "tipo_movimiento_inventario" AS ENUM ('venta', 'compra', 'ajuste');

-- CreateEnum
CREATE TYPE "tipo_documento_cliente" AS ENUM ('cc', 'nit', 'ce', 'pasaporte', 'otro');

-- CreateEnum
CREATE TYPE "estado_pedido" AS ENUM ('abierto', 'enviado_a_cocina', 'pagado', 'anulado');

-- CreateEnum
CREATE TYPE "estado_cocina" AS ENUM ('pendiente', 'preparando', 'listo', 'entregado');

-- CreateEnum
CREATE TYPE "metodo_pago" AS ENUM ('efectivo', 'tarjeta', 'transferencia', 'otro');

-- CreateEnum
CREATE TYPE "tipo_documento_fiscal" AS ENUM ('factura', 'nota_credito');

-- CreateEnum
CREATE TYPE "estado_documento_fiscal" AS ENUM ('pendiente', 'enviando', 'reintento', 'aceptado', 'rechazado');

-- CreateEnum
CREATE TYPE "ambiente_proveedor" AS ENUM ('pruebas', 'produccion');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "nit" VARCHAR(20) NOT NULL,
    "ciudad" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'demo',
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "rol_usuario" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMPTZ(6),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_en" TIMESTAMPTZ(6) NOT NULL,
    "revocada_en" TIMESTAMPTZ(6),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesiones_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "zona" TEXT,
    "capacidad" INTEGER NOT NULL,
    "estado" "estado_mesa" NOT NULL DEFAULT 'libre',

    CONSTRAINT "mesas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "categoria_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DECIMAL(14,2) NOT NULL,
    "tipo_impuesto" "tipo_impuesto" NOT NULL,
    "controla_stock" BOOLEAN NOT NULL DEFAULT false,
    "stock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_inventario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "pedido_id" UUID,
    "tipo" "tipo_movimiento_inventario" NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "tipo_documento" "tipo_documento_cliente" NOT NULL,
    "numero_documento" VARCHAR(20) NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "telefono" VARCHAR(20),

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turnos_caja" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "abierto_por" UUID NOT NULL,
    "cerrado_por" UUID,
    "abierto_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerrado_en" TIMESTAMPTZ(6),
    "monto_inicial" DECIMAL(14,2) NOT NULL,
    "monto_contado" DECIMAL(14,2),

    CONSTRAINT "turnos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "mesa_id" UUID,
    "turno_id" UUID NOT NULL,
    "mesero_id" UUID NOT NULL,
    "cliente_id" UUID,
    "estado" "estado_pedido" NOT NULL DEFAULT 'abierto',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impuestos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "uuid_offline" UUID NOT NULL DEFAULT gen_random_uuid(),
    "abierto_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerrado_en" TIMESTAMPTZ(6),

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items_pedido" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "pedido_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "precio_unitario" DECIMAL(14,2) NOT NULL,
    "tasa_impuesto" DECIMAL(5,2) NOT NULL,
    "estado_cocina" "estado_cocina" NOT NULL DEFAULT 'pendiente',
    "notas" TEXT,

    CONSTRAINT "items_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "pedido_id" UUID NOT NULL,
    "metodo" "metodo_pago" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "referencia" TEXT,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resoluciones_facturacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "tipo" "tipo_documento_fiscal" NOT NULL,
    "prefijo" VARCHAR(10),
    "desde" INTEGER NOT NULL,
    "hasta" INTEGER NOT NULL,
    "vigente_desde" DATE NOT NULL,
    "vigente_hasta" DATE NOT NULL,
    "consecutivo_actual" INTEGER NOT NULL DEFAULT 0,
    "factus_range_id" INTEGER NOT NULL,

    CONSTRAINT "resoluciones_facturacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_fiscales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "pedido_id" UUID NOT NULL,
    "resolucion_id" UUID NOT NULL,
    "tipo" "tipo_documento_fiscal" NOT NULL,
    "numero" INTEGER,
    "estado" "estado_documento_fiscal" NOT NULL DEFAULT 'pendiente',
    "cufe" TEXT,
    "qr" TEXT,
    "xml_url" TEXT,
    "pdf_url" TEXT,
    "id_externo" TEXT,
    "clave_idempotencia" TEXT NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimo_error" TEXT,
    "emitido_en" TIMESTAMPTZ(6),

    CONSTRAINT "documentos_fiscales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credenciales_proveedor" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "proveedor" TEXT NOT NULL,
    "ambiente" "ambiente_proveedor" NOT NULL,
    "credenciales_cifradas" BYTEA NOT NULL,

    CONSTRAINT "credenciales_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "usuario_id" UUID,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" UUID,
    "detalle" JSONB,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_nit_key" ON "tenants"("nit");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_tenant_id_email_key" ON "usuarios"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "sesiones_usuario_tenant_id_usuario_id_idx" ON "sesiones_usuario"("tenant_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_usuario_tenant_id_token_hash_key" ON "sesiones_usuario"("tenant_id", "token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "mesas_tenant_id_nombre_key" ON "mesas"("tenant_id", "nombre");

-- CreateIndex
CREATE INDEX "categorias_tenant_id_orden_idx" ON "categorias"("tenant_id", "orden");

-- CreateIndex
CREATE INDEX "productos_tenant_id_categoria_id_idx" ON "productos"("tenant_id", "categoria_id");

-- CreateIndex
CREATE INDEX "movimientos_inventario_tenant_id_producto_id_fecha_idx" ON "movimientos_inventario"("tenant_id", "producto_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_tenant_id_tipo_documento_numero_documento_key" ON "clientes"("tenant_id", "tipo_documento", "numero_documento");

-- CreateIndex
CREATE INDEX "turnos_caja_tenant_id_abierto_en_idx" ON "turnos_caja"("tenant_id", "abierto_en");

-- CreateIndex
CREATE INDEX "pedidos_tenant_id_abierto_en_idx" ON "pedidos"("tenant_id", "abierto_en");

-- CreateIndex
CREATE INDEX "pedidos_tenant_id_estado_idx" ON "pedidos"("tenant_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_tenant_id_uuid_offline_key" ON "pedidos"("tenant_id", "uuid_offline");

-- CreateIndex
CREATE INDEX "items_pedido_tenant_id_pedido_id_idx" ON "items_pedido"("tenant_id", "pedido_id");

-- CreateIndex
CREATE INDEX "pagos_tenant_id_pedido_id_idx" ON "pagos"("tenant_id", "pedido_id");

-- CreateIndex
CREATE INDEX "resoluciones_facturacion_tenant_id_tipo_idx" ON "resoluciones_facturacion"("tenant_id", "tipo");

-- CreateIndex
CREATE INDEX "documentos_fiscales_tenant_id_estado_idx" ON "documentos_fiscales"("tenant_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_fiscales_tenant_id_resolucion_id_numero_key" ON "documentos_fiscales"("tenant_id", "resolucion_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_fiscales_tenant_id_clave_idempotencia_key" ON "documentos_fiscales"("tenant_id", "clave_idempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "credenciales_proveedor_tenant_id_ambiente_key" ON "credenciales_proveedor"("tenant_id", "ambiente");

-- CreateIndex
CREATE INDEX "auditoria_tenant_id_fecha_idx" ON "auditoria"("tenant_id", "fecha");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_usuario" ADD CONSTRAINT "sesiones_usuario_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_usuario" ADD CONSTRAINT "sesiones_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesas" ADD CONSTRAINT "mesas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_abierto_por_fkey" FOREIGN KEY ("abierto_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_cerrado_por_fkey" FOREIGN KEY ("cerrado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_mesa_id_fkey" FOREIGN KEY ("mesa_id") REFERENCES "mesas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turnos_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_mesero_id_fkey" FOREIGN KEY ("mesero_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_pedido" ADD CONSTRAINT "items_pedido_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_pedido" ADD CONSTRAINT "items_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_pedido" ADD CONSTRAINT "items_pedido_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resoluciones_facturacion" ADD CONSTRAINT "resoluciones_facturacion_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_fiscales" ADD CONSTRAINT "documentos_fiscales_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_fiscales" ADD CONSTRAINT "documentos_fiscales_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_fiscales" ADD CONSTRAINT "documentos_fiscales_resolucion_id_fkey" FOREIGN KEY ("resolucion_id") REFERENCES "resoluciones_facturacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credenciales_proveedor" ADD CONSTRAINT "credenciales_proveedor_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Agregado a mano: reglas que Prisma no puede expresar en schema.prisma.
-- ─────────────────────────────────────────────────────────────────────────────

-- Solo puede haber un turno de caja abierto por negocio (una caja por negocio en el demo).
CREATE UNIQUE INDEX "turnos_caja_un_turno_abierto" ON "turnos_caja"("tenant_id") WHERE "cerrado_en" IS NULL;

-- Validaciones de datos: la base rechaza valores imposibles aunque el código falle.
ALTER TABLE "productos" ADD CONSTRAINT "productos_precio_no_negativo" CHECK ("precio" >= 0);
ALTER TABLE "mesas" ADD CONSTRAINT "mesas_capacidad_positiva" CHECK ("capacidad" > 0);
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_montos_no_negativos"
  CHECK ("monto_inicial" >= 0 AND ("monto_contado" IS NULL OR "monto_contado" >= 0));
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_totales_no_negativos"
  CHECK ("subtotal" >= 0 AND "impuestos" >= 0 AND "total" >= 0);
ALTER TABLE "items_pedido" ADD CONSTRAINT "items_pedido_cantidad_positiva" CHECK ("cantidad" > 0);
ALTER TABLE "items_pedido" ADD CONSTRAINT "items_pedido_precio_no_negativo" CHECK ("precio_unitario" >= 0);
ALTER TABLE "items_pedido" ADD CONSTRAINT "items_pedido_tasa_valida" CHECK ("tasa_impuesto" >= 0 AND "tasa_impuesto" <= 100);
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_monto_positivo" CHECK ("monto" > 0);
ALTER TABLE "resoluciones_facturacion" ADD CONSTRAINT "resoluciones_rango_valido"
  CHECK ("desde" > 0 AND "hasta" >= "desde" AND "vigente_hasta" >= "vigente_desde");
