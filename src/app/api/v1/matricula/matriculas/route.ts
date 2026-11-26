// GET  /api/v1/matricula/matriculas?anioId= · Matrículas del año con filtros y búsqueda (US18, AD-10) · Solo Coordinador académico
// POST /api/v1/matricula/matriculas · Matricular en sección y generar el cronograma (US18, US21, AD-10) · Solo
//      Coordinador académico · JSON o, para un alumno nuevo sin solicitud en línea, multipart/form-data con los mismos
//      campos y un PDF o JPG de hasta 5 MB por documento del proceso del año en «documento:<id>»
import "@/server/wiring";
import { archivoDelFormulario, leerFormulario, TAMANO_MAXIMO_ARCHIVO, type ArchivoRecibido } from "@/platform/archivos";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import {
  confirmarMatricula,
  esquemasMatricula,
  listarMatriculas,
  MAXIMO_DOCUMENTOS_REQUERIDOS,
  MENSAJE_ARCHIVO_MATRICULA,
  ROLES_MATRICULA,
} from "@/modules/matricula";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const filtro = esquemasMatricula.FiltroMatriculasSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await listarMatriculas(filtro));
});

/** Campos y archivos del formulario multipart (los archivos van en «documento:<id del documento requerido>»). */
async function leerFormularioMatricula(req: Request) {
  // un archivo de hasta 5 MB por documento: se rechaza antes de leer un cuerpo mayor
  const formulario = await leerFormulario(req, {
    mensaje: MENSAJE_ARCHIVO_MATRICULA,
    tamanoMaximo: TAMANO_MAXIMO_ARCHIVO * MAXIMO_DOCUMENTOS_REQUERIDOS,
  });
  const texto = (campo: string) => {
    const valor = formulario.get(campo);
    return typeof valor === "string" && valor ? valor : undefined;
  };
  const datos = esquemasMatricula.MatricularSchema.parse({
    estudianteId: texto("estudianteId"),
    anioAcademicoId: texto("anioAcademicoId"),
    seccionId: texto("seccionId"),
    vinculoResponsableId: texto("vinculoResponsableId"),
    modalidadPago: texto("modalidadPago"),
  });
  const archivos: Record<string, ArchivoRecibido> = {};
  for (const campo of new Set(formulario.keys())) {
    if (!campo.startsWith(esquemasMatricula.PREFIJO_CAMPO_DOCUMENTO)) continue;
    const documentoId = esquemasMatricula.IdSchema.parse(campo.slice(esquemasMatricula.PREFIJO_CAMPO_DOCUMENTO.length));
    const archivo = await archivoDelFormulario(formulario, campo);
    if (archivo) archivos[documentoId] = archivo;
  }
  return { ...datos, archivos };
}

export const POST = ruta(async (req, { meta }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const multipart = (req.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data");
  const datos = multipart
    ? await leerFormularioMatricula(req)
    : await leerCuerpo(req, esquemasMatricula.MatricularSchema);
  return ok(await confirmarMatricula(coordinador, datos, meta), 201);
});
