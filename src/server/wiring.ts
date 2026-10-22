// Conecta los puertos entre módulos. Toda ruta de la API debe importar este archivo primero:
//   import "@/server/wiring";
// Así un módulo de abajo usa lo que necesita de uno de arriba sin importarlo:
// identidad <- comunidad (perfiles) · academico <- evaluacion (cierres y notas),
// matricula (matriculados por sección), comunidad (docentes tutores) y horarios (cursos en horarios publicados).
import { configurarPerfilesProvider } from "@/modules/identidad";
import {
  configurarCierresProvider,
  configurarDocentesProvider,
  configurarHorariosProvider,
  configurarMatriculasProvider,
} from "@/modules/academico";
import { docentesProviderComunidad, perfilesProviderComunidad } from "@/modules/comunidad";
import { cierresProviderEvaluacion } from "@/modules/evaluacion";
import { horariosProviderHorarios } from "@/modules/horarios";
import { matriculasProviderMatricula } from "@/modules/matricula";

configurarPerfilesProvider(perfilesProviderComunidad);
configurarCierresProvider(cierresProviderEvaluacion);
configurarMatriculasProvider(matriculasProviderMatricula);
configurarDocentesProvider(docentesProviderComunidad);
configurarHorariosProvider(horariosProviderHorarios);
