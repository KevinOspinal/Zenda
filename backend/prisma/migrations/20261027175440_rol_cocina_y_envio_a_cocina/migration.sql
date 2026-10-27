-- AlterEnum
ALTER TYPE "rol_usuario" ADD VALUE 'cocina';

-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "enviado_a_cocina_en" TIMESTAMPTZ(6);

-- Agregado a mano: los pedidos que hoy están en cocina ya se enviaron; se usa la hora en que
-- se abrieron como aproximación. Los cobrados antes de este cambio quedan sin fecha, para que
-- no vuelvan a aparecer en la cocina.
UPDATE "pedidos" SET "enviado_a_cocina_en" = "abierto_en" WHERE "estado" = 'enviado_a_cocina';
