// platform/archivos: almacén en disco (ARCHIVOS_DRIVER=disco). En desarrollo, ./.archivos (ignorado por git); en la
// EC2, el plan B si no hay bucket: /opt/kubo/shared/archivos, fuera de los releases (docs/DESPLIEGUE-AWS.md).
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { esClaveValida } from "./reglas";
import type { AlmacenArchivos } from "./puerto";

/** rwx solo para el dueño (kubo) y lectura para su grupo: nadie más lee los archivos. */
const PERMISO_CARPETA = 0o750;
const PERMISO_ARCHIVO = 0o640;

export function almacenDisco(raiz: string): AlmacenArchivos {
  const ruta = (clave: string) => {
    if (!esClaveValida(clave)) throw new Error("Clave de archivo no válida");
    return path.join(raiz, ...clave.split("/"));
  };
  return {
    descripcion: `disco (${raiz})`,

    async guardar(clave, bytes) {
      const destino = ruta(clave);
      await fs.mkdir(path.dirname(destino), { recursive: true, mode: PERMISO_CARPETA });
      // se escribe aparte y se renombra: nadie lee un archivo a medio escribir
      const temporal = `${destino}.parcial`;
      await fs.writeFile(temporal, bytes, { flag: "wx", mode: PERMISO_ARCHIVO });
      await fs.rename(temporal, destino);
    },

    async leer(clave) {
      try {
        const archivo = await fs.open(ruta(clave), "r");
        return Readable.toWeb(archivo.createReadStream()) as ReadableStream<Uint8Array>;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw e;
      }
    },

    async eliminar(clave) {
      await fs.rm(ruta(clave), { force: true });
    },
  };
}
