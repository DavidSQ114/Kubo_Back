-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMINISTRADOR', 'DOCENTE', 'APODERADO', 'ALUMNO');

-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('PENDIENTE_ACTIVACION', 'ACTIVO', 'SUSPENDIDO', 'DADO_DE_BAJA');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('HORARIO', 'NOTAS', 'PAGO', 'RECTIFICACION', 'MATERIAL', 'TRABAJO', 'ASISTENCIA', 'RECORDATORIO', 'SISTEMA');

-- CreateEnum
CREATE TYPE "NivelLog" AS ENUM ('INFO', 'WARN', 'ERROR', 'FATAL');

-- CreateEnum
CREATE TYPE "EstadoEnvio" AS ENUM ('PENDIENTE', 'PROCESADO', 'FALLIDO');

-- CreateEnum
CREATE TYPE "EstadoAnio" AS ENUM ('PLANIFICADO', 'EN_MATRICULA', 'EN_CURSO', 'EN_CIERRE', 'CERRADO');

-- CreateEnum
CREATE TYPE "EstadoPeriodo" AS ENUM ('INACTIVO', 'ACTIVO', 'EN_CIERRE', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "EstadoSeccion" AS ENUM ('ACTIVA', 'INACTIVA');

-- CreateEnum
CREATE TYPE "EstadoCurso" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "MetodoConsolidacion" AS ENUM ('MODA', 'PONDERADO');

-- CreateEnum
CREATE TYPE "CriterioDesempate" AS ENUM ('MAYOR_JERARQUIA', 'MENOR_JERARQUIA', 'ULTIMO_REGISTRO');

-- CreateEnum
CREATE TYPE "EstadoRegla" AS ENUM ('BORRADOR', 'VIGENTE', 'ARCHIVADA');

-- CreateEnum
CREATE TYPE "Logro" AS ENUM ('AD', 'A', 'B', 'C');

-- CreateEnum
CREATE TYPE "EstadoMatricula" AS ENUM ('EN_PROCESO', 'MATRICULADO', 'RETIRADO', 'ANULADO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "ModalidadPago" AS ENUM ('MENSUAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "TipoConcepto" AS ENUM ('MATRICULA', 'PENSION');

-- CreateEnum
CREATE TYPE "EstadoCobro" AS ENUM ('PENDIENTE', 'PAGADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('OBSERVADO', 'CONFIRMADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'DEPOSITO', 'TARJETA');

-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES');

-- CreateEnum
CREATE TYPE "EstadoPublicacion" AS ENUM ('BORRADOR', 'COMPLETO', 'PUBLICADO', 'ARCHIVADO');

-- CreateEnum
CREATE TYPE "EstadoAsistencia" AS ENUM ('PRESENTE', 'TARDANZA', 'FALTA', 'FALTA_JUSTIFICADA');

-- CreateEnum
CREATE TYPE "EstadoAsistenciaDocente" AS ENUM ('PUNTUAL', 'TARDANZA', 'FALTA', 'FALTA_JUSTIFICADA');

-- CreateEnum
CREATE TYPE "EstadoCierre" AS ENUM ('PENDIENTE_APERTURA', 'ABIERTO', 'FUERA_DE_PLAZO', 'CERRADO', 'PUBLICADO');

-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('PENDIENTE', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoFormato" AS ENUM ('PDF', 'PPTX', 'DOCX', 'XLSX', 'IMAGEN', 'ENLACE');

-- CreateEnum
CREATE TYPE "EstadoVisibilidad" AS ENUM ('BORRADOR', 'PUBLICADO', 'OCULTO');

-- CreateEnum
CREATE TYPE "TipoEnlace" AS ENUM ('CLASE_VIRTUAL', 'ASESORIA', 'TALLER');

-- CreateEnum
CREATE TYPE "EstadoEnlace" AS ENUM ('PROGRAMADO', 'ACTIVO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "EstadoTrabajo" AS ENUM ('BORRADOR', 'PUBLICADO', 'CERRADO');

-- CreateEnum
CREATE TYPE "EstadoEntrega" AS ENUM ('ENTREGADO', 'REVISADO');

-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('FEMENINO', 'MASCULINO');

-- CreateEnum
CREATE TYPE "MotivoAnulacion" AS ENUM ('ERROR_DIGITACION', 'PAGO_DUPLICADO', 'SOLICITUD_APODERADO', 'OTRO');

-- CreateEnum
CREATE TYPE "MotivoRetiro" AS ENUM ('TRASLADO', 'MOTIVOS_ECONOMICOS', 'MOTIVOS_SALUD', 'OTRO');

-- CreateTable
CREATE TABLE "anio_academico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anio" INTEGER NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "estado" "EstadoAnio" NOT NULL DEFAULT 'PLANIFICADO',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anio_academico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodo_evaluacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anio_academico_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "estado" "EstadoPeriodo" NOT NULL DEFAULT 'INACTIVO',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periodo_evaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grado" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numero" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aula" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "aforo" INTEGER NOT NULL,
    "ubicacion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seccion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anio_academico_id" UUID NOT NULL,
    "grado_id" UUID NOT NULL,
    "aula_id" UUID,
    "tutor_id" UUID,
    "nombre" TEXT NOT NULL,
    "aforo_maximo" INTEGER NOT NULL,
    "estado" "EstadoSeccion" NOT NULL DEFAULT 'ACTIVA',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "area_curricular" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "area_curricular_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curso" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "area_curricular_id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" "EstadoCurso" NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competencia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "area_curricular_id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_estudio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anio_academico_id" UUID NOT NULL,
    "grado_id" UUID NOT NULL,
    "curso_id" UUID NOT NULL,
    "horas_semanales" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_estudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competencia_plan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_estudio_id" UUID NOT NULL,
    "competencia_id" UUID NOT NULL,
    "orden" INTEGER NOT NULL,
    "peso" DECIMAL(5,2),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competencia_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignacion_docente" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_estudio_id" UUID NOT NULL,
    "seccion_id" UUID NOT NULL,
    "docente_id" UUID NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asignacion_docente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regla_consolidacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anio_academico_id" UUID NOT NULL,
    "rige_desde_id" UUID,
    "nombre" TEXT NOT NULL,
    "metodo" "MetodoConsolidacion" NOT NULL,
    "criterio_desempate" "CriterioDesempate" NOT NULL DEFAULT 'MAYOR_JERARQUIA',
    "configuracion" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "estado" "EstadoRegla" NOT NULL DEFAULT 'BORRADOR',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regla_consolidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametro_institucion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anio_academico_id" UUID,
    "clave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "descripcion" TEXT,
    "actualizado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parametro_institucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidad_didactica" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asignacion_docente_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unidad_didactica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_estudio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asignacion_docente_id" UUID NOT NULL,
    "unidad_id" UUID,
    "titulo" TEXT NOT NULL,
    "tipo_formato" "TipoFormato" NOT NULL,
    "url_archivo" TEXT NOT NULL,
    "peso_mb" DECIMAL(5,2),
    "mime_type" TEXT,
    "estado_visibilidad" "EstadoVisibilidad" NOT NULL DEFAULT 'BORRADOR',
    "publicado_en" TIMESTAMPTZ(3),
    "subido_por_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_estudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enlace_virtual" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asignacion_docente_id" UUID NOT NULL,
    "tipo_enlace" "TipoEnlace" NOT NULL,
    "titulo" TEXT NOT NULL,
    "url_meet" TEXT NOT NULL,
    "horario" TEXT,
    "fecha_programada" TIMESTAMPTZ(3),
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enlace_virtual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trabajo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asignacion_docente_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "instrucciones" TEXT NOT NULL,
    "fecha_limite" TIMESTAMPTZ(3) NOT NULL,
    "archivo_apoyo_url" TEXT,
    "estado" "EstadoTrabajo" NOT NULL DEFAULT 'BORRADOR',
    "publicado_en" TIMESTAMPTZ(3),
    "creado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trabajo_competencia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trabajo_id" UUID NOT NULL,
    "competencia_plan_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trabajo_competencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entrega_trabajo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trabajo_id" UUID NOT NULL,
    "matricula_id" UUID NOT NULL,
    "comentario" TEXT,
    "entregado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoEntrega" NOT NULL DEFAULT 'ENTREGADO',
    "retroalimentacion" TEXT,
    "revisado_por_id" UUID,
    "revisado_en" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entrega_trabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archivo_entrega" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entrega_trabajo_id" UUID NOT NULL,
    "nombre_archivo" TEXT NOT NULL,
    "archivo_url" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archivo_entrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persona" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dni" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "fecha_nacimiento" DATE,
    "sexo" "Sexo",
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estudiante" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "persona_id" UUID NOT NULL,
    "grado_ingreso_id" UUID,
    "colegio_procedencia" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estudiante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apoderado" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "persona_id" UUID NOT NULL,
    "ocupacion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apoderado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "administrador" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "persona_id" UUID NOT NULL,
    "cargo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "administrador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "docente" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "persona_id" UUID NOT NULL,
    "codigo_docente" TEXT,
    "especialidad" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "docente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vinculo_apoderado" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "estudiante_id" UUID NOT NULL,
    "apoderado_id" UUID NOT NULL,
    "parentesco" TEXT NOT NULL,
    "es_principal" BOOLEAN NOT NULL DEFAULT false,
    "autorizado" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vinculo_apoderado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierre_calificacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asignacion_docente_id" UUID NOT NULL,
    "periodo_evaluacion_id" UUID NOT NULL,
    "regla_consolidacion_id" UUID NOT NULL,
    "estado" "EstadoCierre" NOT NULL DEFAULT 'PENDIENTE_APERTURA',
    "cerrado_por_id" UUID,
    "cerrado_en" TIMESTAMPTZ(3),
    "publicado_por_id" UUID,
    "publicado_en" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cierre_calificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nota" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cierre_id" UUID NOT NULL,
    "matricula_id" UUID NOT NULL,
    "competencia_plan_id" UUID NOT NULL,
    "logro" "Logro" NOT NULL,
    "registrado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultado_consolidado" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cierre_id" UUID NOT NULL,
    "matricula_id" UUID NOT NULL,
    "logro_consolidado" "Logro",
    "incompleto" BOOLEAN NOT NULL DEFAULT false,
    "detalle_calculo" JSONB NOT NULL,
    "calculado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultado_consolidado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidencia_pedagogica" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nota_id" UUID NOT NULL,
    "entrega_trabajo_id" UUID,
    "titulo" TEXT,
    "comentario" TEXT,
    "archivo_url" TEXT,
    "nombre_archivo" TEXT,
    "mime_type" TEXT,
    "tamano_bytes" INTEGER,
    "subido_por_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidencia_pedagogica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_rectificacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nota_id" UUID NOT NULL,
    "valor_anterior" "Logro" NOT NULL,
    "valor_solicitado" "Logro" NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'PENDIENTE',
    "motivo_rechazo" TEXT,
    "resuelto_por_id" UUID,
    "resuelto_en" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitud_rectificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloque_horario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dia" "DiaSemana" NOT NULL,
    "hora_inicio" TIME(0) NOT NULL,
    "hora_fin" TIME(0) NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "obligatorio" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloque_horario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "seccion_id" UUID NOT NULL,
    "estado_publicacion" "EstadoPublicacion" NOT NULL DEFAULT 'BORRADOR',
    "version" INTEGER NOT NULL,
    "publicado_por_id" UUID,
    "publicado_en" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalle_horario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "horario_id" UUID NOT NULL,
    "bloque_id" UUID NOT NULL,
    "aula_id" UUID NOT NULL,
    "asignacion_docente_id" UUID NOT NULL,
    "docente_id" UUID NOT NULL,
    "seccion_id" UUID NOT NULL,
    "en_vigor" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detalle_horario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesion_clase" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "detalle_horario_id" UUID NOT NULL,
    "docente_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "iniciada_en" TIMESTAMPTZ(3),
    "cerrada_en" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesion_clase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asistencia_estudiante" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sesion_clase_id" UUID NOT NULL,
    "matricula_id" UUID NOT NULL,
    "estado" "EstadoAsistencia" NOT NULL,
    "registrado_por_id" UUID NOT NULL,
    "registrado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificado_por_id" UUID,
    "modificado_en" TIMESTAMPTZ(3),
    "motivo_cambio" TEXT,
    "observacion" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asistencia_estudiante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asistencia_docente" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "docente_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_ingreso" TIME(0),
    "hora_salida" TIME(0),
    "estado" "EstadoAsistenciaDocente" NOT NULL,
    "justificacion" TEXT,
    "registrado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asistencia_docente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "persona_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'PENDIENTE_ACTIVACION',
    "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMPTZ(3),
    "debe_cambiar_password" BOOLEAN NOT NULL DEFAULT true,
    "version_sesion" INTEGER NOT NULL DEFAULT 0,
    "ultimo_acceso_en" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "version_sesion" INTEGER NOT NULL,
    "rol_activo" "Rol" NOT NULL,
    "ip_origen" TEXT,
    "user_agent" TEXT,
    "expira_en" TIMESTAMPTZ(3) NOT NULL,
    "revocada_en" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_recuperacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_en" TIMESTAMPTZ(3) NOT NULL,
    "usado_en" TIMESTAMPTZ(3),
    "revocado_en" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_recuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matricula" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "estudiante_id" UUID NOT NULL,
    "seccion_id" UUID,
    "anio_academico_id" UUID NOT NULL,
    "vinculo_responsable_id" UUID,
    "fecha_matricula" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoMatricula" NOT NULL DEFAULT 'EN_PROCESO',
    "modalidad_pago" "ModalidadPago" NOT NULL DEFAULT 'MENSUAL',
    "registrado_por_id" UUID NOT NULL,
    "retirado_en" TIMESTAMPTZ(3),
    "motivo_retiro" "MotivoRetiro",
    "detalle_retiro" TEXT,
    "anulado_por_id" UUID,
    "anulado_en" TIMESTAMPTZ(3),
    "motivo_anulacion" TEXT,
    "ultimo_recordatorio_en" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matricula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_seccion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "matricula_id" UUID NOT NULL,
    "seccion_id" UUID NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE,
    "motivo" TEXT,
    "registrado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_seccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concepto_cobro" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "matricula_id" UUID NOT NULL,
    "tipo" "TipoConcepto" NOT NULL,
    "mes" INTEGER,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "fecha_vencimiento" DATE NOT NULL,
    "estado" "EstadoCobro" NOT NULL DEFAULT 'PENDIENTE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concepto_cobro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operacion_pago" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numero_operacion" TEXT NOT NULL,
    "medio_pago" "MedioPago" NOT NULL,
    "fecha_pago" TIMESTAMPTZ(3) NOT NULL,
    "monto_total" DECIMAL(10,2) NOT NULL,
    "estado" "EstadoPago" NOT NULL,
    "registrado_por_id" UUID NOT NULL,
    "confirmado_por_id" UUID,
    "anulado_por_id" UUID,
    "anulado_en" TIMESTAMPTZ(3),
    "motivo_anulacion" "MotivoAnulacion",
    "observacion_anulacion" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operacion_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pago" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "operacion_pago_id" UUID NOT NULL,
    "concepto_cobro_id" UUID NOT NULL,
    "monto_aplicado" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobante" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "operacion_pago_id" UUID NOT NULL,
    "numero_comprobante" TEXT NOT NULL,
    "nombre_archivo" TEXT NOT NULL,
    "archivo_url" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamano_bytes" INTEGER,
    "checksum_sha256" TEXT,
    "monto_total" DECIMAL(10,2) NOT NULL,
    "enviado_en" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprobante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "enlace" TEXT,
    "leida_en" TIMESTAMPTZ(3),
    "clave_deduplicacion" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_evento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo_evento" TEXT NOT NULL,
    "agregado_tipo" TEXT NOT NULL,
    "agregado_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "estado" "EstadoEnvio" NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "proximo_intento" TIMESTAMPTZ(3),
    "procesado_en" TIMESTAMPTZ(3),
    "ultimo_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_auditoria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID,
    "request_id" TEXT,
    "entidad_afectada" TEXT NOT NULL,
    "entidad_id" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "valor_anterior" JSONB,
    "valor_nuevo" JSONB,
    "motivo" TEXT,
    "ip_origen" TEXT,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_error" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID,
    "request_id" TEXT,
    "endpoint" TEXT NOT NULL,
    "metodo_http" TEXT,
    "codigo_http" INTEGER NOT NULL,
    "nivel" "NivelLog" NOT NULL,
    "mensaje" TEXT NOT NULL,
    "stack_trace" TEXT,
    "metadatos" JSONB,
    "ip_origen" TEXT,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_error_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "anio_academico_anio_key" ON "anio_academico"("anio");

-- CreateIndex
CREATE UNIQUE INDEX "periodo_evaluacion_anio_academico_id_numero_key" ON "periodo_evaluacion"("anio_academico_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "grado_numero_key" ON "grado"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "aula_nombre_key" ON "aula"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "seccion_anio_academico_id_grado_id_nombre_key" ON "seccion"("anio_academico_id", "grado_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "area_curricular_codigo_key" ON "area_curricular"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "curso_codigo_key" ON "curso"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "competencia_codigo_key" ON "competencia"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "plan_estudio_anio_academico_id_grado_id_curso_id_key" ON "plan_estudio"("anio_academico_id", "grado_id", "curso_id");

-- CreateIndex
CREATE UNIQUE INDEX "competencia_plan_plan_estudio_id_competencia_id_key" ON "competencia_plan"("plan_estudio_id", "competencia_id");

-- CreateIndex
CREATE INDEX "asignacion_docente_docente_id_idx" ON "asignacion_docente"("docente_id");

-- CreateIndex
CREATE UNIQUE INDEX "regla_consolidacion_anio_academico_id_version_key" ON "regla_consolidacion"("anio_academico_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "parametro_institucion_clave_anio_academico_id_key" ON "parametro_institucion"("clave", "anio_academico_id");

-- CreateIndex
CREATE UNIQUE INDEX "unidad_didactica_asignacion_docente_id_numero_key" ON "unidad_didactica"("asignacion_docente_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "trabajo_competencia_trabajo_id_competencia_plan_id_key" ON "trabajo_competencia"("trabajo_id", "competencia_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "entrega_trabajo_trabajo_id_matricula_id_key" ON "entrega_trabajo"("trabajo_id", "matricula_id");

-- CreateIndex
CREATE UNIQUE INDEX "persona_dni_key" ON "persona"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "estudiante_persona_id_key" ON "estudiante"("persona_id");

-- CreateIndex
CREATE UNIQUE INDEX "apoderado_persona_id_key" ON "apoderado"("persona_id");

-- CreateIndex
CREATE UNIQUE INDEX "administrador_persona_id_key" ON "administrador"("persona_id");

-- CreateIndex
CREATE UNIQUE INDEX "docente_persona_id_key" ON "docente"("persona_id");

-- CreateIndex
CREATE UNIQUE INDEX "docente_codigo_docente_key" ON "docente"("codigo_docente");

-- CreateIndex
CREATE UNIQUE INDEX "vinculo_apoderado_estudiante_id_apoderado_id_key" ON "vinculo_apoderado"("estudiante_id", "apoderado_id");

-- CreateIndex
CREATE UNIQUE INDEX "cierre_calificacion_asignacion_docente_id_periodo_evaluacio_key" ON "cierre_calificacion"("asignacion_docente_id", "periodo_evaluacion_id");

-- CreateIndex
CREATE INDEX "nota_matricula_id_idx" ON "nota"("matricula_id");

-- CreateIndex
CREATE UNIQUE INDEX "nota_cierre_id_matricula_id_competencia_plan_id_key" ON "nota"("cierre_id", "matricula_id", "competencia_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "resultado_consolidado_cierre_id_matricula_id_key" ON "resultado_consolidado"("cierre_id", "matricula_id");

-- CreateIndex
CREATE UNIQUE INDEX "bloque_horario_dia_hora_inicio_key" ON "bloque_horario"("dia", "hora_inicio");

-- CreateIndex
CREATE UNIQUE INDEX "horario_seccion_id_version_key" ON "horario"("seccion_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "detalle_horario_horario_id_bloque_id_key" ON "detalle_horario"("horario_id", "bloque_id");

-- CreateIndex
CREATE UNIQUE INDEX "sesion_clase_detalle_horario_id_fecha_key" ON "sesion_clase"("detalle_horario_id", "fecha");

-- CreateIndex
CREATE INDEX "asistencia_estudiante_matricula_id_idx" ON "asistencia_estudiante"("matricula_id");

-- CreateIndex
CREATE UNIQUE INDEX "asistencia_estudiante_sesion_clase_id_matricula_id_key" ON "asistencia_estudiante"("sesion_clase_id", "matricula_id");

-- CreateIndex
CREATE UNIQUE INDEX "asistencia_docente_docente_id_fecha_key" ON "asistencia_docente"("docente_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_persona_id_key" ON "usuario"("persona_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sesion_refresh_token_hash_key" ON "sesion"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sesion_usuario_id_idx" ON "sesion"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "token_recuperacion_token_hash_key" ON "token_recuperacion"("token_hash");

-- CreateIndex
CREATE INDEX "matricula_seccion_id_estado_idx" ON "matricula"("seccion_id", "estado");

-- CreateIndex
CREATE INDEX "concepto_cobro_estado_fecha_vencimiento_idx" ON "concepto_cobro"("estado", "fecha_vencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "concepto_cobro_matricula_id_tipo_mes_key" ON "concepto_cobro"("matricula_id", "tipo", "mes");

-- CreateIndex
CREATE INDEX "operacion_pago_numero_operacion_idx" ON "operacion_pago"("numero_operacion");

-- CreateIndex
CREATE UNIQUE INDEX "pago_operacion_pago_id_concepto_cobro_id_key" ON "pago"("operacion_pago_id", "concepto_cobro_id");

-- CreateIndex
CREATE UNIQUE INDEX "comprobante_operacion_pago_id_key" ON "comprobante"("operacion_pago_id");

-- CreateIndex
CREATE UNIQUE INDEX "comprobante_numero_comprobante_key" ON "comprobante"("numero_comprobante");

-- CreateIndex
CREATE UNIQUE INDEX "notificacion_clave_deduplicacion_key" ON "notificacion"("clave_deduplicacion");

-- CreateIndex
CREATE INDEX "notificacion_usuario_id_leida_en_idx" ON "notificacion"("usuario_id", "leida_en");

-- CreateIndex
CREATE INDEX "outbox_evento_estado_proximo_intento_idx" ON "outbox_evento"("estado", "proximo_intento");

-- CreateIndex
CREATE INDEX "registro_auditoria_entidad_afectada_entidad_id_idx" ON "registro_auditoria"("entidad_afectada", "entidad_id");

-- CreateIndex
CREATE INDEX "registro_auditoria_fecha_idx" ON "registro_auditoria"("fecha");

-- CreateIndex
CREATE INDEX "log_error_fecha_idx" ON "log_error"("fecha");

-- AddForeignKey
ALTER TABLE "periodo_evaluacion" ADD CONSTRAINT "periodo_evaluacion_anio_academico_id_fkey" FOREIGN KEY ("anio_academico_id") REFERENCES "anio_academico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seccion" ADD CONSTRAINT "seccion_anio_academico_id_fkey" FOREIGN KEY ("anio_academico_id") REFERENCES "anio_academico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seccion" ADD CONSTRAINT "seccion_grado_id_fkey" FOREIGN KEY ("grado_id") REFERENCES "grado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seccion" ADD CONSTRAINT "seccion_aula_id_fkey" FOREIGN KEY ("aula_id") REFERENCES "aula"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seccion" ADD CONSTRAINT "seccion_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "docente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso" ADD CONSTRAINT "curso_area_curricular_id_fkey" FOREIGN KEY ("area_curricular_id") REFERENCES "area_curricular"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competencia" ADD CONSTRAINT "competencia_area_curricular_id_fkey" FOREIGN KEY ("area_curricular_id") REFERENCES "area_curricular"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_estudio" ADD CONSTRAINT "plan_estudio_anio_academico_id_fkey" FOREIGN KEY ("anio_academico_id") REFERENCES "anio_academico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_estudio" ADD CONSTRAINT "plan_estudio_grado_id_fkey" FOREIGN KEY ("grado_id") REFERENCES "grado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_estudio" ADD CONSTRAINT "plan_estudio_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competencia_plan" ADD CONSTRAINT "competencia_plan_plan_estudio_id_fkey" FOREIGN KEY ("plan_estudio_id") REFERENCES "plan_estudio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competencia_plan" ADD CONSTRAINT "competencia_plan_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_docente" ADD CONSTRAINT "asignacion_docente_plan_estudio_id_fkey" FOREIGN KEY ("plan_estudio_id") REFERENCES "plan_estudio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_docente" ADD CONSTRAINT "asignacion_docente_seccion_id_fkey" FOREIGN KEY ("seccion_id") REFERENCES "seccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_docente" ADD CONSTRAINT "asignacion_docente_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regla_consolidacion" ADD CONSTRAINT "regla_consolidacion_anio_academico_id_fkey" FOREIGN KEY ("anio_academico_id") REFERENCES "anio_academico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regla_consolidacion" ADD CONSTRAINT "regla_consolidacion_rige_desde_id_fkey" FOREIGN KEY ("rige_desde_id") REFERENCES "periodo_evaluacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametro_institucion" ADD CONSTRAINT "parametro_institucion_anio_academico_id_fkey" FOREIGN KEY ("anio_academico_id") REFERENCES "anio_academico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametro_institucion" ADD CONSTRAINT "parametro_institucion_actualizado_por_id_fkey" FOREIGN KEY ("actualizado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidad_didactica" ADD CONSTRAINT "unidad_didactica_asignacion_docente_id_fkey" FOREIGN KEY ("asignacion_docente_id") REFERENCES "asignacion_docente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_estudio" ADD CONSTRAINT "material_estudio_asignacion_docente_id_fkey" FOREIGN KEY ("asignacion_docente_id") REFERENCES "asignacion_docente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_estudio" ADD CONSTRAINT "material_estudio_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidad_didactica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_estudio" ADD CONSTRAINT "material_estudio_subido_por_id_fkey" FOREIGN KEY ("subido_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enlace_virtual" ADD CONSTRAINT "enlace_virtual_asignacion_docente_id_fkey" FOREIGN KEY ("asignacion_docente_id") REFERENCES "asignacion_docente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabajo" ADD CONSTRAINT "trabajo_asignacion_docente_id_fkey" FOREIGN KEY ("asignacion_docente_id") REFERENCES "asignacion_docente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabajo" ADD CONSTRAINT "trabajo_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabajo_competencia" ADD CONSTRAINT "trabajo_competencia_trabajo_id_fkey" FOREIGN KEY ("trabajo_id") REFERENCES "trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabajo_competencia" ADD CONSTRAINT "trabajo_competencia_competencia_plan_id_fkey" FOREIGN KEY ("competencia_plan_id") REFERENCES "competencia_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrega_trabajo" ADD CONSTRAINT "entrega_trabajo_trabajo_id_fkey" FOREIGN KEY ("trabajo_id") REFERENCES "trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrega_trabajo" ADD CONSTRAINT "entrega_trabajo_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrega_trabajo" ADD CONSTRAINT "entrega_trabajo_revisado_por_id_fkey" FOREIGN KEY ("revisado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archivo_entrega" ADD CONSTRAINT "archivo_entrega_entrega_trabajo_id_fkey" FOREIGN KEY ("entrega_trabajo_id") REFERENCES "entrega_trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudiante" ADD CONSTRAINT "estudiante_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudiante" ADD CONSTRAINT "estudiante_grado_ingreso_id_fkey" FOREIGN KEY ("grado_ingreso_id") REFERENCES "grado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apoderado" ADD CONSTRAINT "apoderado_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "administrador" ADD CONSTRAINT "administrador_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docente" ADD CONSTRAINT "docente_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_apoderado" ADD CONSTRAINT "vinculo_apoderado_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_apoderado" ADD CONSTRAINT "vinculo_apoderado_apoderado_id_fkey" FOREIGN KEY ("apoderado_id") REFERENCES "apoderado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_calificacion" ADD CONSTRAINT "cierre_calificacion_asignacion_docente_id_fkey" FOREIGN KEY ("asignacion_docente_id") REFERENCES "asignacion_docente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_calificacion" ADD CONSTRAINT "cierre_calificacion_periodo_evaluacion_id_fkey" FOREIGN KEY ("periodo_evaluacion_id") REFERENCES "periodo_evaluacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_calificacion" ADD CONSTRAINT "cierre_calificacion_regla_consolidacion_id_fkey" FOREIGN KEY ("regla_consolidacion_id") REFERENCES "regla_consolidacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_calificacion" ADD CONSTRAINT "cierre_calificacion_cerrado_por_id_fkey" FOREIGN KEY ("cerrado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_calificacion" ADD CONSTRAINT "cierre_calificacion_publicado_por_id_fkey" FOREIGN KEY ("publicado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota" ADD CONSTRAINT "nota_cierre_id_fkey" FOREIGN KEY ("cierre_id") REFERENCES "cierre_calificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota" ADD CONSTRAINT "nota_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota" ADD CONSTRAINT "nota_competencia_plan_id_fkey" FOREIGN KEY ("competencia_plan_id") REFERENCES "competencia_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota" ADD CONSTRAINT "nota_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_consolidado" ADD CONSTRAINT "resultado_consolidado_cierre_id_fkey" FOREIGN KEY ("cierre_id") REFERENCES "cierre_calificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_consolidado" ADD CONSTRAINT "resultado_consolidado_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencia_pedagogica" ADD CONSTRAINT "evidencia_pedagogica_nota_id_fkey" FOREIGN KEY ("nota_id") REFERENCES "nota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencia_pedagogica" ADD CONSTRAINT "evidencia_pedagogica_entrega_trabajo_id_fkey" FOREIGN KEY ("entrega_trabajo_id") REFERENCES "entrega_trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencia_pedagogica" ADD CONSTRAINT "evidencia_pedagogica_subido_por_id_fkey" FOREIGN KEY ("subido_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_rectificacion" ADD CONSTRAINT "solicitud_rectificacion_nota_id_fkey" FOREIGN KEY ("nota_id") REFERENCES "nota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_rectificacion" ADD CONSTRAINT "solicitud_rectificacion_resuelto_por_id_fkey" FOREIGN KEY ("resuelto_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horario" ADD CONSTRAINT "horario_seccion_id_fkey" FOREIGN KEY ("seccion_id") REFERENCES "seccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horario" ADD CONSTRAINT "horario_publicado_por_id_fkey" FOREIGN KEY ("publicado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_horario" ADD CONSTRAINT "detalle_horario_horario_id_fkey" FOREIGN KEY ("horario_id") REFERENCES "horario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_horario" ADD CONSTRAINT "detalle_horario_bloque_id_fkey" FOREIGN KEY ("bloque_id") REFERENCES "bloque_horario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_horario" ADD CONSTRAINT "detalle_horario_aula_id_fkey" FOREIGN KEY ("aula_id") REFERENCES "aula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_horario" ADD CONSTRAINT "detalle_horario_asignacion_docente_id_fkey" FOREIGN KEY ("asignacion_docente_id") REFERENCES "asignacion_docente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_horario" ADD CONSTRAINT "detalle_horario_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_horario" ADD CONSTRAINT "detalle_horario_seccion_id_fkey" FOREIGN KEY ("seccion_id") REFERENCES "seccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion_clase" ADD CONSTRAINT "sesion_clase_detalle_horario_id_fkey" FOREIGN KEY ("detalle_horario_id") REFERENCES "detalle_horario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion_clase" ADD CONSTRAINT "sesion_clase_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia_estudiante" ADD CONSTRAINT "asistencia_estudiante_sesion_clase_id_fkey" FOREIGN KEY ("sesion_clase_id") REFERENCES "sesion_clase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia_estudiante" ADD CONSTRAINT "asistencia_estudiante_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia_estudiante" ADD CONSTRAINT "asistencia_estudiante_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia_estudiante" ADD CONSTRAINT "asistencia_estudiante_modificado_por_id_fkey" FOREIGN KEY ("modificado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia_docente" ADD CONSTRAINT "asistencia_docente_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia_docente" ADD CONSTRAINT "asistencia_docente_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion" ADD CONSTRAINT "sesion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_recuperacion" ADD CONSTRAINT "token_recuperacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matricula" ADD CONSTRAINT "matricula_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matricula" ADD CONSTRAINT "matricula_seccion_id_fkey" FOREIGN KEY ("seccion_id") REFERENCES "seccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matricula" ADD CONSTRAINT "matricula_anio_academico_id_fkey" FOREIGN KEY ("anio_academico_id") REFERENCES "anio_academico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matricula" ADD CONSTRAINT "matricula_vinculo_responsable_id_fkey" FOREIGN KEY ("vinculo_responsable_id") REFERENCES "vinculo_apoderado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matricula" ADD CONSTRAINT "matricula_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matricula" ADD CONSTRAINT "matricula_anulado_por_id_fkey" FOREIGN KEY ("anulado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_seccion" ADD CONSTRAINT "historial_seccion_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "matricula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_seccion" ADD CONSTRAINT "historial_seccion_seccion_id_fkey" FOREIGN KEY ("seccion_id") REFERENCES "seccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_seccion" ADD CONSTRAINT "historial_seccion_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concepto_cobro" ADD CONSTRAINT "concepto_cobro_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "matricula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operacion_pago" ADD CONSTRAINT "operacion_pago_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operacion_pago" ADD CONSTRAINT "operacion_pago_confirmado_por_id_fkey" FOREIGN KEY ("confirmado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operacion_pago" ADD CONSTRAINT "operacion_pago_anulado_por_id_fkey" FOREIGN KEY ("anulado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_operacion_pago_id_fkey" FOREIGN KEY ("operacion_pago_id") REFERENCES "operacion_pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_concepto_cobro_id_fkey" FOREIGN KEY ("concepto_cobro_id") REFERENCES "concepto_cobro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobante" ADD CONSTRAINT "comprobante_operacion_pago_id_fkey" FOREIGN KEY ("operacion_pago_id") REFERENCES "operacion_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_auditoria" ADD CONSTRAINT "registro_auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_error" ADD CONSTRAINT "log_error_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
