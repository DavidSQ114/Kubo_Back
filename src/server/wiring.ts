// Conecta los puertos entre módulos. Toda ruta de la API debe importar este archivo primero:
//   import "@/server/wiring";
// Así un módulo de abajo usa lo que necesita de uno de arriba sin importarlo:
// identidad <- comunidad (perfiles) · academico <- evaluacion (cierres de calificación),
// matricula (matriculados por sección) y comunidad (docentes tutores).
import { configurarPerfilesProvider } from "@/modules/identidad";
import {
  configurarCierresProvider,
  configurarDocentesProvider,
  configurarMatriculasProvider,
} from "@/modules/academico";
import { docentesProviderComunidad, perfilesProviderComunidad } from "@/modules/comunidad";
import { cierresProviderEvaluacion } from "@/modules/evaluacion";
import { matriculasProviderMatricula } from "@/modules/matricula";

configurarPerfilesProvider(perfilesProviderComunidad);
configurarCierresProvider(cierresProviderEvaluacion);
configurarMatriculasProvider(matriculasProviderMatricula);
configurarDocentesProvider(docentesProviderComunidad);
