-- US61, US62 y US67 · Aula virtual. Migración compatible: solo agrega columnas e índices y vuelve opcional
-- url_archivo; no borra ni renombra nada.
-- El archivo de un material ya no se guarda como URL: va al almacén privado de platform/archivos y aquí queda su
-- clave interna (materiales/<uuid>), su nombre original saneado y su tamaño. url_archivo queda solo para el material
-- tipo ENLACE. enlace_virtual gana fecha_fin: con fecha_programada (el inicio) el servidor calcula si el enlace está
-- Programado, Activo o Finalizado (US62).
-- AlterTable
ALTER TABLE "enlace_virtual" ADD COLUMN     "fecha_fin" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "material_estudio" ADD COLUMN     "archivo_clave" TEXT,
ADD COLUMN     "nombre_archivo" TEXT,
ADD COLUMN     "tamano_bytes" INTEGER,
ALTER COLUMN "url_archivo" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "enlace_virtual_asignacion_docente_id_idx" ON "enlace_virtual"("asignacion_docente_id");

-- CreateIndex
CREATE INDEX "material_estudio_asignacion_docente_id_idx" ON "material_estudio"("asignacion_docente_id");

-- CreateIndex
CREATE INDEX "material_estudio_unidad_id_idx" ON "material_estudio"("unidad_id");


-- Las restricciones se crean NOT VALID: rigen para toda fila nueva o modificada sin revisar las que ya existían.

-- El fin de un enlace es posterior a su inicio (US62)
ALTER TABLE enlace_virtual ADD CONSTRAINT ck_enlace_virtual_fechas
  CHECK (fecha_fin IS NULL OR (fecha_programada IS NOT NULL AND fecha_fin > fecha_programada)) NOT VALID;

-- Un material ENLACE lleva su URL y ningún archivo; los demás, su archivo completo de hasta 5 MB (US61)
ALTER TABLE material_estudio ADD CONSTRAINT ck_material_contenido
  CHECK (
    (tipo_formato = 'ENLACE' AND url_archivo IS NOT NULL AND archivo_clave IS NULL)
    OR (
      tipo_formato <> 'ENLACE' AND archivo_clave IS NOT NULL AND nombre_archivo IS NOT NULL
      AND mime_type IS NOT NULL AND tamano_bytes > 0 AND tamano_bytes <= 5242880
    )
  ) NOT VALID;

-- Un material publicado siempre tiene la fecha en que se publicó
ALTER TABLE material_estudio ADD CONSTRAINT ck_material_publicado
  CHECK (estado_visibilidad <> 'PUBLICADO' OR publicado_en IS NOT NULL) NOT VALID;
