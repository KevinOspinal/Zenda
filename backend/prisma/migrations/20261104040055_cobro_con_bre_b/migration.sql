-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "llave_bre_b" VARCHAR(100),
ADD COLUMN     "qr_bre_b" VARCHAR(512);

-- Agregado a mano: sin llave o sin QR se guarda NULL, nunca un texto vacío.
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_llave_bre_b_no_vacia"
  CHECK ("llave_bre_b" IS NULL OR length(trim("llave_bre_b")) > 0);
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_qr_bre_b_no_vacio"
  CHECK ("qr_bre_b" IS NULL OR length(trim("qr_bre_b")) > 0);
