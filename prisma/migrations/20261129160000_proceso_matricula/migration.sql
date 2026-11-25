-- Bloque M4 · fase 5: proceso de matrícula por año (fechas y documentos requeridos).
-- CreateTable
CREATE TABLE "proceso_matricula" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anio_academico_id" UUID NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "actualizado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proceso_matricula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento_requerido" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proceso_id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "obligatorio" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_requerido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proceso_matricula_anio_academico_id_key" ON "proceso_matricula"("anio_academico_id");

-- CreateIndex
CREATE INDEX "documento_requerido_proceso_id_activo_orden_idx" ON "documento_requerido"("proceso_id", "activo", "orden");

-- AddForeignKey
ALTER TABLE "proceso_matricula" ADD CONSTRAINT "proceso_matricula_anio_academico_id_fkey" FOREIGN KEY ("anio_academico_id") REFERENCES "anio_academico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proceso_matricula" ADD CONSTRAINT "proceso_matricula_actualizado_por_id_fkey" FOREIGN KEY ("actualizado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_requerido" ADD CONSTRAINT "documento_requerido_proceso_id_fkey" FOREIGN KEY ("proceso_id") REFERENCES "proceso_matricula"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "proceso_matricula" ADD CONSTRAINT "ck_proceso_matricula_fechas" CHECK (fecha_inicio <= fecha_fin);
-- Un mismo nombre no se repite entre los documentos activos del proceso.
CREATE UNIQUE INDEX "uq_documento_requerido_nombre_activo" ON "documento_requerido" (proceso_id, lower(nombre)) WHERE activo;
