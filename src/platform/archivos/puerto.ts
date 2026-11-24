// platform/archivos: puerto del almacén de archivos. Lo implementan el bucket privado de S3 (s3.ts) y el disco
// (disco.ts); index.ts elige uno con ARCHIVOS_DRIVER. Nadie fuera de platform/archivos lo usa directamente.

export interface AlmacenArchivos {
  /** «s3://kubo-archivos (us-east-1)» o «disco (/opt/kubo/shared/archivos)»: para el script de verificación. */
  descripcion: string;
  guardar(clave: string, bytes: Uint8Array, mime: string): Promise<void>;
  /** El contenido como flujo, o null si la clave no existe. */
  leer(clave: string): Promise<ReadableStream<Uint8Array> | null>;
  /** Borrar una clave que no existe no es un error. */
  eliminar(clave: string): Promise<void>;
}
