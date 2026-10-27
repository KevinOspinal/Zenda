-- CreateEnum
CREATE TYPE "tipo_pedido" AS ENUM ('mesa', 'mostrador', 'domicilio');

-- CreateEnum
CREATE TYPE "origen_pedido" AS ENUM ('local', 'whatsapp', 'telefono', 'otro');

-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "nombre_cliente" VARCHAR(80),
ADD COLUMN     "numero" INTEGER,
ADD COLUMN     "origen" "origen_pedido" NOT NULL DEFAULT 'local',
ADD COLUMN     "tipo" "tipo_pedido" NOT NULL DEFAULT 'mostrador',
ADD COLUMN     "valor_domicilio" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "valor_domicilio" DECIMAL(14,2) NOT NULL DEFAULT 3000;

-- CreateTable
CREATE TABLE "entregas_domicilio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "pedido_id" UUID NOT NULL,
    "telefono" VARCHAR(20) NOT NULL,
    "direccion" VARCHAR(200) NOT NULL,
    "indicaciones" VARCHAR(300),
    "paga_con" DECIMAL(14,2),
    "domiciliario_id" UUID,
    "despachado_en" TIMESTAMPTZ(6),
    "entregado_en" TIMESTAMPTZ(6),

    CONSTRAINT "entregas_domicilio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domiciliarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "telefono" VARCHAR(20) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domiciliarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contadores_pedidos" (
    "tenant_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "ultimo" INTEGER NOT NULL,

    CONSTRAINT "contadores_pedidos_pkey" PRIMARY KEY ("tenant_id","fecha")
);

-- CreateIndex
CREATE UNIQUE INDEX "entregas_domicilio_pedido_id_key" ON "entregas_domicilio"("pedido_id");

-- CreateIndex
CREATE INDEX "entregas_domicilio_tenant_id_entregado_en_idx" ON "entregas_domicilio"("tenant_id", "entregado_en");

-- AddForeignKey
ALTER TABLE "entregas_domicilio" ADD CONSTRAINT "entregas_domicilio_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas_domicilio" ADD CONSTRAINT "entregas_domicilio_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas_domicilio" ADD CONSTRAINT "entregas_domicilio_domiciliario_id_fkey" FOREIGN KEY ("domiciliario_id") REFERENCES "domiciliarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domiciliarios" ADD CONSTRAINT "domiciliarios_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contadores_pedidos" ADD CONSTRAINT "contadores_pedidos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Agregado a mano: llenar los datos nuevos en los pedidos que ya existen. El dueño de la tabla
-- solo puede hacerlo sin el FORCE de RLS; rls.sql lo vuelve a activar después de migrar.
ALTER TABLE "pedidos" NO FORCE ROW LEVEL SECURITY;

-- Los pedidos que ya existen son de mesa o de mostrador, según tengan mesa.
UPDATE "pedidos" SET "tipo" = 'mesa' WHERE "mesa_id" IS NOT NULL;

-- Numerarlos por negocio y por día (hora de Colombia), en el orden en que se abrieron, y
-- dejar cada contador en el último número que se dio.
UPDATE "pedidos" p SET "numero" = n.numero
FROM (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY tenant_id, (abierto_en AT TIME ZONE 'America/Bogota')::date
    ORDER BY abierto_en, id
  ) AS numero
  FROM "pedidos"
) n
WHERE p.id = n.id;

INSERT INTO "contadores_pedidos" ("tenant_id", "fecha", "ultimo")
SELECT tenant_id, (abierto_en AT TIME ZONE 'America/Bogota')::date, max("numero")
FROM "pedidos"
GROUP BY 1, 2;

ALTER TABLE "pedidos" FORCE ROW LEVEL SECURITY;
ALTER TABLE "pedidos" ALTER COLUMN "numero" SET NOT NULL;

-- Agregado a mano: reglas que verifica la base de datos.
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_numero_positivo" CHECK ("numero" > 0);
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_valor_domicilio_no_negativo"
  CHECK ("valor_domicilio" >= 0);
-- Todo pedido de mesa tiene mesa, y solo los de mesa la tienen.
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_mesa_segun_tipo"
  CHECK (("tipo" = 'mesa') = ("mesa_id" IS NOT NULL));
-- Solo los domicilios cobran domicilio.
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_valor_domicilio_segun_tipo"
  CHECK ("tipo" = 'domicilio' OR "valor_domicilio" = 0);
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_valor_domicilio_no_negativo"
  CHECK ("valor_domicilio" >= 0);
ALTER TABLE "entregas_domicilio" ADD CONSTRAINT "entregas_domicilio_paga_con_no_negativo"
  CHECK ("paga_con" IS NULL OR "paga_con" >= 0);
ALTER TABLE "contadores_pedidos" ADD CONSTRAINT "contadores_pedidos_ultimo_positivo"
  CHECK ("ultimo" > 0);
