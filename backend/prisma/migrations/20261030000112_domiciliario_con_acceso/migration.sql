-- Rol domiciliario: quien lleva los domicilios entra a Zenda desde su celular y ve solo
-- los que tiene asignados.
ALTER TYPE "rol_usuario" ADD VALUE 'domiciliario';

-- Acceso del domiciliario: el usuario con el que entra (uno por domiciliario).
ALTER TABLE "domiciliarios" ADD COLUMN     "usuario_id" UUID;

-- Ubicación que mandó el cliente (enlace de Google Maps o Waze).
ALTER TABLE "entregas_domicilio" ADD COLUMN     "ubicacion_url" VARCHAR(500);

-- CreateIndex
CREATE UNIQUE INDEX "domiciliarios_usuario_id_key" ON "domiciliarios"("usuario_id");

-- AddForeignKey
ALTER TABLE "domiciliarios" ADD CONSTRAINT "domiciliarios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
