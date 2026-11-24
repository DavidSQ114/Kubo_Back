// platform/archivos: almacén en un bucket PRIVADO de S3 (ARCHIVOS_DRIVER=s3). Las credenciales salen de la cadena por
// defecto del SDK (en la EC2, el perfil de la instancia): nunca se escriben en el código ni en el .env. El SDK se
// carga solo con este driver, para que el modo disco no lo necesite.
import type * as ClienteS3 from "@aws-sdk/client-s3";
import type { AlmacenArchivos } from "./puerto";

type Sdk = typeof ClienteS3;

export function almacenS3(opciones: { bucket: string; region: string | undefined }): AlmacenArchivos {
  const { bucket, region } = opciones;
  let conexion: Promise<{ sdk: Sdk; cliente: InstanceType<Sdk["S3Client"]> }> | undefined;
  const s3 = () =>
    (conexion ??= import("@aws-sdk/client-s3").then((sdk) => ({
      sdk,
      cliente: new sdk.S3Client(region ? { region } : {}),
    })));

  return {
    descripcion: `s3://${bucket}${region ? ` (${region})` : ""}`,

    async guardar(clave, bytes, mime) {
      const { sdk, cliente } = await s3();
      await cliente.send(
        new sdk.PutObjectCommand({
          Bucket: bucket,
          Key: clave,
          Body: bytes,
          ContentType: mime,
          ContentLength: bytes.byteLength,
        }),
      );
    },

    async leer(clave) {
      const { sdk, cliente } = await s3();
      try {
        const r = await cliente.send(new sdk.GetObjectCommand({ Bucket: bucket, Key: clave }));
        return r.Body ? (r.Body.transformToWebStream() as ReadableStream<Uint8Array>) : null;
      } catch (e) {
        if (e instanceof sdk.NoSuchKey) return null;
        throw e;
      }
    },

    async eliminar(clave) {
      const { sdk, cliente } = await s3();
      await cliente.send(new sdk.DeleteObjectCommand({ Bucket: bucket, Key: clave }));
    },
  };
}
