-- CreateTable
CREATE TABLE "grupos_opciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "minimo" INTEGER NOT NULL DEFAULT 0,
    "maximo" INTEGER,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "grupos_opciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "grupo_id" UUID NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "precio_extra" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tipo_impuesto" "tipo_impuesto" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "opciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos_grupos_opciones" (
    "tenant_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "grupo_id" UUID NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "productos_grupos_opciones_pkey" PRIMARY KEY ("producto_id","grupo_id")
);

-- CreateTable
CREATE TABLE "items_pedido_opciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "opcion_id" UUID,
    "grupo" VARCHAR(60) NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "precio_extra" DECIMAL(14,2) NOT NULL,
    "tasa_impuesto" DECIMAL(5,2) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "items_pedido_opciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grupos_opciones_tenant_id_orden_idx" ON "grupos_opciones"("tenant_id", "orden");

-- CreateIndex
CREATE INDEX "opciones_tenant_id_grupo_id_orden_idx" ON "opciones"("tenant_id", "grupo_id", "orden");

-- CreateIndex
CREATE INDEX "productos_grupos_opciones_tenant_id_grupo_id_idx" ON "productos_grupos_opciones"("tenant_id", "grupo_id");

-- CreateIndex
CREATE INDEX "items_pedido_opciones_tenant_id_item_id_idx" ON "items_pedido_opciones"("tenant_id", "item_id");

-- CreateIndex
CREATE INDEX "items_pedido_opciones_opcion_id_idx" ON "items_pedido_opciones"("opcion_id");

-- AddForeignKey
ALTER TABLE "grupos_opciones" ADD CONSTRAINT "grupos_opciones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opciones" ADD CONSTRAINT "opciones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opciones" ADD CONSTRAINT "opciones_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_opciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_grupos_opciones" ADD CONSTRAINT "productos_grupos_opciones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_grupos_opciones" ADD CONSTRAINT "productos_grupos_opciones_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_grupos_opciones" ADD CONSTRAINT "productos_grupos_opciones_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_opciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_pedido_opciones" ADD CONSTRAINT "items_pedido_opciones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_pedido_opciones" ADD CONSTRAINT "items_pedido_opciones_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items_pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_pedido_opciones" ADD CONSTRAINT "items_pedido_opciones_opcion_id_fkey" FOREIGN KEY ("opcion_id") REFERENCES "opciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Agregado a mano: reglas que verifica la base de datos.
-- Un grupo pide entre "minimo" y "maximo" opciones; sin máximo, todas las que se quieran.
ALTER TABLE "grupos_opciones" ADD CONSTRAINT "grupos_opciones_limites_validos"
  CHECK ("minimo" >= 0 AND ("maximo" IS NULL OR ("maximo" >= 1 AND "maximo" >= "minimo")));
ALTER TABLE "grupos_opciones" ADD CONSTRAINT "grupos_opciones_nombre_no_vacio"
  CHECK (length(trim("nombre")) > 0);
ALTER TABLE "opciones" ADD CONSTRAINT "opciones_precio_extra_no_negativo"
  CHECK ("precio_extra" >= 0);
ALTER TABLE "opciones" ADD CONSTRAINT "opciones_nombre_no_vacio"
  CHECK (length(trim("nombre")) > 0);
ALTER TABLE "items_pedido_opciones" ADD CONSTRAINT "items_pedido_opciones_precio_extra_no_negativo"
  CHECK ("precio_extra" >= 0);
