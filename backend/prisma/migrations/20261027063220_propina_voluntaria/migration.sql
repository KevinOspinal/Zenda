-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "propina" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "propina_sugerida" DECIMAL(5,2) NOT NULL DEFAULT 10;

-- Agregado a mano: la Ley 1935 de 2018 limita la propina sugerida al 10 %.
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_propina_sugerida_valida"
  CHECK ("propina_sugerida" >= 0 AND "propina_sugerida" <= 10);

-- Agregado a mano: la propina nunca es negativa.
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_propina_no_negativa"
  CHECK ("propina" >= 0);
