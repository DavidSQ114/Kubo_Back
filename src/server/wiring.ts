// Conecta los puertos entre módulos. Toda ruta de la API debe importar este archivo primero:
//   import "@/server/wiring";
// Así un módulo de abajo usa lo que necesita de uno de arriba sin importarlo:
// identidad <- comunidad (perfiles) · academico <- evaluacion (cierres y notas),
// matricula (matriculados por sección), comunidad (docentes tutores y nombres de personas) y horarios (cursos en
// horarios publicados) · comunidad <- matricula (matrícula «En proceso» al registrar un estudiante, US17, y
// matrículas y pagos de un estudiante antes de eliminarlo, US69, y matrícula vigente antes de crearle el acceso al
// portal, US49). horarios está por encima de academico, de comunidad y de matricula: los usa directamente por su
// index.ts (US27–US31; la sección del alumno y la del hijo del apoderado, US48 y US50).
import { configurarPerfilesProvider } from "@/modules/identidad";
import {
  configurarCierresProvider,
  configurarDocentesProvider,
  configurarHorariosProvider,
  configurarMatriculasProvider,
  configurarPersonasProvider,
} from "@/modules/academico";
import {
  configurarMatriculaBorradorProvider,
  configurarRegistrosMatriculaProvider,
  docentesProviderComunidad,
  perfilesProviderComunidad,
  personasProviderComunidad,
} from "@/modules/comunidad";
import { cierresProviderEvaluacion } from "@/modules/evaluacion";
import { horariosProviderHorarios } from "@/modules/horarios";
import {
  matriculaBorradorProviderMatricula,
  matriculasProviderMatricula,
  registrosMatriculaProviderMatricula,
} from "@/modules/matricula";

configurarPerfilesProvider(perfilesProviderComunidad);
configurarCierresProvider(cierresProviderEvaluacion);
configurarMatriculasProvider(matriculasProviderMatricula);
configurarDocentesProvider(docentesProviderComunidad);
configurarHorariosProvider(horariosProviderHorarios);
configurarPersonasProvider(personasProviderComunidad);
configurarMatriculaBorradorProvider(matriculaBorradorProviderMatricula);
configurarRegistrosMatriculaProvider(registrosMatriculaProviderMatricula);
