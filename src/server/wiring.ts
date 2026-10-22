// Conecta los puertos entre módulos. Toda ruta de la API debe importar este archivo primero:
//   import "@/server/wiring";
// Así un módulo de abajo usa lo que necesita de uno de arriba sin importarlo:
// identidad ← comunidad (perfiles) · academico ← evaluacion (cierres de calificación).
import { configurarPerfilesProvider } from "@/modules/identidad";
import { configurarCierresProvider } from "@/modules/academico";
import { perfilesProviderComunidad } from "@/modules/comunidad";
import { cierresProviderEvaluacion } from "@/modules/evaluacion";

configurarPerfilesProvider(perfilesProviderComunidad);
configurarCierresProvider(cierresProviderEvaluacion);
