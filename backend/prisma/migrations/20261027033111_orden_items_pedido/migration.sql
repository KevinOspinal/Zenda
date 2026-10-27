-- AlterTable
ALTER TABLE "items_pedido" ADD COLUMN     "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp();
