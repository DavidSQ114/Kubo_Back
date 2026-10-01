// Conecta los puertos entre módulos. Toda ruta de la API debe importar este archivo primero:
//   import "@/server/wiring";
// Así un módulo de abajo (identidad) usa lo que necesita de uno de arriba (comunidad) sin importarlo.
import { configurarPerfilesProvider } from "@/modules/identidad";
import { perfilesProviderComunidad } from "@/modules/comunidad";

configurarPerfilesProvider(perfilesProviderComunidad);
