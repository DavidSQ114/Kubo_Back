// Descarga los íconos, logos y la decoración del Figma de Kubo a public/figma/.
// Uso (una sola vez, desde la raíz del proyecto):  node scripts/descargar-assets-figma.mjs
// Los enlaces de Figma vencen 7 días después de generarse (1/10/2026). Si fallan con 403/404,
// pide a Claude que vuelva a generarlos desde el Figma.
import fs from "node:fs/promises";
import path from "node:path";

const destino = path.resolve("public/figma");
const lista = JSON.parse(await fs.readFile(new URL("./assets-figma.json", import.meta.url), "utf8"));
await fs.mkdir(destino, { recursive: true });

let ok = 0;
const fallos = [];
for (const [nombre, url] of Object.entries(lista)) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const texto = await res.text();
    if (!texto.includes("<svg")) throw new Error("la respuesta no es un SVG");
    await fs.writeFile(path.join(destino, `${nombre}.svg`), texto);
    ok++;
  } catch (e) {
    fallos.push(`${nombre}: ${e.message}`);
  }
}
console.log(`Descargados ${ok} de ${Object.keys(lista).length} archivos en public/figma/`);
if (fallos.length) {
  console.log("Fallaron:\n  " + fallos.join("\n  "));
  process.exitCode = 1;
}
