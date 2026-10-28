-- AlterTable
ALTER TABLE "pagos" ADD COLUMN     "recibido" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "direccion" VARCHAR(200),
ADD COLUMN     "pie_recibo" VARCHAR(200),
ADD COLUMN     "telefono" VARCHAR(20),
ADD COLUMN     "ultimo_recibo" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "recibos_venta" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "pedido_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "encabezado" JSONB NOT NULL,
    "emitido_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recibos_venta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recibos_venta_pedido_id_key" ON "recibos_venta"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "recibos_venta_tenant_id_numero_key" ON "recibos_venta"("tenant_id", "numero");

-- AddForeignKey
ALTER TABLE "recibos_venta" ADD CONSTRAINT "recibos_venta_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recibos_venta" ADD CONSTRAINT "recibos_venta_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Agregado a mano: reglas que verifica la base de datos.
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_ultimo_recibo_no_negativo"
  CHECK ("ultimo_recibo" >= 0);
ALTER TABLE "recibos_venta" ADD CONSTRAINT "recibos_venta_numero_positivo"
  CHECK ("numero" > 0);
-- Lo recibido en efectivo nunca es menos que lo que se abona.
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_recibido_alcanza"
  CHECK ("recibido" IS NULL OR "recibido" >= "monto");
