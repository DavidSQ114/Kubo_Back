// Comprueba el almacenamiento de archivos (platform/archivos) con la configuración del ambiente: guarda, lee y borra un
// objeto de prueba e informa si funciona. Uso: npm run archivos:verificar (en la EC2, ver docs/DESPLIEGUE-AWS.md,
// «Archivos»). Sale con código 1 si algún paso falla. No toca la base de datos.
import { verificarAlmacen } from "@/platform/archivos";

const escribir = (texto: string) => process.stdout.write(`${texto}\n`);

async function main() {
  try {
    const r = await verificarAlmacen();
    escribir(`Almacén: ${r.almacen}`);
    for (const p of r.pasos) escribir(`  ${p.ok ? "OK   " : "FALLA"} ${p.paso}: ${p.detalle}`);
    escribir(r.ok ? "El almacenamiento de archivos funciona." : "El almacenamiento de archivos NO funciona.");
    return r.ok ? 0 : 1;
  } catch (e) {
    escribir(`El almacenamiento de archivos NO funciona: ${(e as Error)?.message ?? "Error desconocido"}`);
    return 1;
  }
}

main().then((codigo) => process.exit(codigo));
