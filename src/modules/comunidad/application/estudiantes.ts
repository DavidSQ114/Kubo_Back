// comunidad/application: registro y búsqueda de estudiantes (US17, RF13, AD-09).
// El estudiante todavía no tiene cuenta de usuario (llega con US49). «Guardar como borrador» crea además su
// matrícula «En proceso» por el puerto MatriculaBorradorProvider (la implementa matricula).
import { prisma } from "@/platform/db/prisma";
import { esDuplicado } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { listarGrados } from "@/modules/academico";
import type { Autenticado } from "@/modules/identidad";
import { erroresComunidad as E } from "../domain/errores";
import { accionPerfil, fechaSinHora, verificarVinculosIniciales, type Parentesco } from "../domain/vinculos";
import { apoderados, estudiantes, personas, vinculos, type Pagina } from "../infrastructure/repositorio";
import { matriculaBorradorProvider, type MatriculaBorrador } from "../puertos";
import { personaParaPerfil } from "./personas";

export interface EstudianteListado {
  estudianteId: string;
  personaId: string;
  dni: string;
  nombreCompleto: string;
  gradoIngreso: string | null;
  /** «Carmen Rojas Medina (Madre)», el principal primero. */
  apoderados: { apoderadoId: string; nombreCompleto: string; parentesco: string; esPrincipal: boolean }[];
}

/** Estudiantes activos por DNI o nombre, paginados (para vincular a un apoderado en AD-08). */
export async function buscarEstudiantes(f: Pagina) {
  const [{ total, filas }, grados] = await Promise.all([estudiantes.buscar(f), listarGrados()]);
  const nombreGrado = new Map(grados.map((g) => [g.id, g.nombre]));
  const items: EstudianteListado[] = filas.map((e) => ({
    estudianteId: e.id,
    personaId: e.persona.id,
    dni: e.persona.dni,
    nombreCompleto: `${e.persona.nombres} ${e.persona.apellidos}`,
    gradoIngreso: e.gradoIngresoId ? (nombreGrado.get(e.gradoIngresoId) ?? null) : null,
    apoderados: e.vinculosApoderado.map((v) => ({
      apoderadoId: v.apoderado.id,
      nombreCompleto: `${v.apoderado.persona.nombres} ${v.apoderado.persona.apellidos}`,
      parentesco: v.parentesco,
      esPrincipal: v.esPrincipal,
    })),
  }));
  return { items, paginacion: { pagina: f.pagina, tamano: f.tamano, total, paginas: Math.ceil(total / f.tamano) } };
}

export interface DatosEstudiante {
  dni: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  gradoIngresoId: string;
  sexo?: "FEMENINO" | "MASCULINO" | null;
  colegioProcedencia?: string | null;
  direccion?: string | null;
  apoderados: { apoderadoId: string; parentesco: Parentesco; esPrincipal: boolean; autorizado: boolean }[];
  borrador: boolean;
}

/**
 * Registra un Estudiante (US17) vinculado a uno o más apoderados existentes (exactamente uno principal).
 * Un DNI que ya es estudiante: 409 ESTUDIANTE_EXISTENTE. Si el DNI es de una persona con otro perfil, se le agrega
 * el perfil sin cambiar sus datos (D-07). Con borrador: true crea también su matrícula «En proceso» en el año en
 * matrícula, sin sección ni cronograma. Todo en una transacción con REGISTRAR_ESTUDIANTE y VINCULAR_APODERADO.
 */
export async function registrarEstudiante(admin: Autenticado, datos: DatosEstudiante, meta: MetaSolicitud) {
  verificarVinculosIniciales(datos.apoderados);
  if (!(await listarGrados()).some((g) => g.id === datos.gradoIngresoId)) throw E.gradoInvalido();

  try {
    return await prisma.$transaction(async (tx) => {
      const ids = datos.apoderados.map((a) => a.apoderadoId);
      if ((await apoderados.activosPorIds(ids, tx)).length !== ids.length) throw E.apoderadoNoEncontrado();

      const existente = await personaParaPerfil(tx, datos);
      const perfil = existente ? await estudiantes.dePersona(existente.id, tx) : null;
      const accion = accionPerfil(perfil, E.estudianteExistente);

      const personaId =
        existente?.id ??
        (
          await personas.crear(
            {
              dni: datos.dni,
              nombres: datos.nombres,
              apellidos: datos.apellidos,
              fechaNacimiento: fechaSinHora(datos.fechaNacimiento),
              sexo: datos.sexo ?? null,
              direccion: datos.direccion ?? null,
            },
            tx,
          )
        ).id;

      const academicos = { gradoIngresoId: datos.gradoIngresoId, colegioProcedencia: datos.colegioProcedencia ?? null };
      const estudiante =
        accion === "REACTIVAR"
          ? await estudiantes.reactivar(perfil!.id, academicos, tx)
          : await estudiantes.crear({ personaId, ...academicos }, tx);

      const vinculosCreados = [];
      for (const a of datos.apoderados) {
        const v = await vinculos.crear({ estudianteId: estudiante.id, ...a }, tx);
        await registrarAuditoria(
          tx,
          {
            usuarioId: admin.usuarioId,
            entidad: "vinculo_apoderado",
            entidadId: v.id,
            accion: "VINCULAR_APODERADO",
            nuevo: { estudianteId: estudiante.id, ...a },
          },
          meta,
        );
        vinculosCreados.push(v.id);
      }

      let matricula: MatriculaBorrador | null = null;
      if (datos.borrador) {
        matricula = await matriculaBorradorProvider().crearEnProceso(tx, {
          estudianteId: estudiante.id,
          registradoPorId: admin.usuarioId,
        });
      }

      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: "estudiante",
          entidadId: estudiante.id,
          accion: "REGISTRAR_ESTUDIANTE",
          nuevo: {
            personaId,
            ...academicos,
            personaExistia: Boolean(existente),
            perfilReactivado: accion === "REACTIVAR",
            apoderados: datos.apoderados.length,
            matriculaEnProcesoId: matricula?.matriculaId ?? null,
          },
        },
        meta,
      );

      return {
        estudianteId: estudiante.id,
        personaId,
        nombreCompleto: `${existente?.nombres ?? datos.nombres} ${existente?.apellidos ?? datos.apellidos}`,
        personaExistia: Boolean(existente),
        vinculos: vinculosCreados.length,
        // null si no se guardó como borrador. La confirmación de la matrícula es de US18.
        matricula: matricula && { ...matricula, estado: "EN_PROCESO" as const },
      };
    });
  } catch (e) {
    if (esDuplicado(e, "dni")) throw E.dniEnUso();
    throw e;
  }
}
