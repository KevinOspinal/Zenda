-- CreateEnum
CREATE TYPE "regimen_impuesto" AS ENUM ('responsable_inc', 'franquicia_iva', 'no_responsable');

-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "ajuste_redondeo" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "regimen_impuesto" "regimen_impuesto" NOT NULL DEFAULT 'responsable_inc';

-- Agregado a mano: los totales del pedido siempre deben cuadrar.
-- subtotal + impuestos se calculan como exige la DIAN; el ajuste absorbe los centavos
-- de diferencia con lo que paga el cliente (la suma de los precios del menú).
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_totales_cuadran"
  CHECK ("subtotal" + "impuestos" + "ajuste_redondeo" = "total");
