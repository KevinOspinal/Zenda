-- Clave de idempotencia de cada ítem del pedido: la app genera una en cada toque de
-- "agregar" y la repite si reintenta. Si el mismo toque llega dos veces, no se duplica.
-- Los ítems viejos quedan sin clave (NULL): el índice único permite varios NULL.

-- AlterTable
ALTER TABLE "items_pedido" ADD COLUMN     "clave_idempotencia" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "items_pedido_tenant_id_clave_idempotencia_key" ON "items_pedido"("tenant_id", "clave_idempotencia");
