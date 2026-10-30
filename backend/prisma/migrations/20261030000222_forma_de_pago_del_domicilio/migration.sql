-- Forma de pago de un domicilio: se elige al tomar el pedido y decide su recorrido
-- (anticipado: sale pagado; contra entrega: el domiciliario cobra y lo liquida en la caja).
CREATE TYPE "forma_pago_domicilio" AS ENUM ('anticipado', 'contra_entrega');

ALTER TABLE "entregas_domicilio" ADD COLUMN "forma_pago" "forma_pago_domicilio" NOT NULL DEFAULT 'contra_entrega';

-- Agregado a mano: los domicilios que ya existen y se cobraron antes de salir fueron de pago
-- anticipado. El dueño de las tablas solo puede leerlas y cambiarlas sin el FORCE de RLS;
-- rls.sql lo vuelve a activar después de migrar.
ALTER TABLE "entregas_domicilio" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "pedidos" NO FORCE ROW LEVEL SECURITY;

UPDATE "entregas_domicilio" AS e
SET "forma_pago" = 'anticipado', "paga_con" = NULL
FROM "pedidos" AS p
WHERE p."id" = e."pedido_id"
  AND p."estado" = 'pagado'
  AND (e."despachado_en" IS NULL OR p."cerrado_en" <= e."despachado_en");

ALTER TABLE "entregas_domicilio" FORCE ROW LEVEL SECURITY;
ALTER TABLE "pedidos" FORCE ROW LEVEL SECURITY;

-- Desde ahora la forma de pago siempre la elige quien toma el pedido: sin valor por defecto.
ALTER TABLE "entregas_domicilio" ALTER COLUMN "forma_pago" DROP DEFAULT;

-- "Paga con" (para llevar el cambio) solo tiene sentido contra entrega.
ALTER TABLE "entregas_domicilio" ADD CONSTRAINT "entregas_domicilio_paga_con_contra_entrega"
  CHECK ("paga_con" IS NULL OR "forma_pago" = 'contra_entrega');
