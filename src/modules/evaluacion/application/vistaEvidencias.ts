// evaluacion/application: cómo sale una evidencia pedagógica hacia la pantalla (DO-04, AP-04, AL-03; US38 y US47).
// Lo usan el registro de notas, la libreta y los casos de uso de evidencias. Nunca expone la clave del almacén.
import { tipoDeMime } from "@/platform/archivos";
import type { EvidenciaVista } from "../domain/evidencias";
import type { EvidenciaFila } from "../infrastructure/repositorio";

export function vistaDeEvidencia(
  e: Pick<
    EvidenciaFila,
    "id" | "comentario" | "archivoClave" | "nombreArchivo" | "mimeType" | "tamanoBytes" | "createdAt"
  >,
): EvidenciaVista {
  return {
    id: e.id,
    comentario: e.comentario,
    archivo:
      e.archivoClave && e.nombreArchivo && e.mimeType && e.tamanoBytes != null
        ? { nombre: e.nombreArchivo, tipo: tipoDeMime(e.mimeType), mime: e.mimeType, tamanoBytes: e.tamanoBytes }
        : null,
    subidoEn: e.createdAt.toISOString(),
  };
}
