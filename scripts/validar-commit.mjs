// Valida la primera línea del mensaje de commit (Conventional Commits, estándar de programación 10.2).
// Lo ejecuta el hook .husky/commit-msg:  node scripts/validar-commit.mjs <archivo-del-mensaje>
/* eslint-disable no-console -- script de línea de comandos: la consola es su salida */
import fs from "node:fs";

const FORMATO = /^(feat|fix|docs|style|refactor|test|chore|perf|build|ci)(\([a-z0-9-]+\))?!?: .+/;
const LARGO_MAXIMO = 100;
// Mensajes que genera Git por su cuenta y no siguen el formato
const GENERADOS_POR_GIT = /^(Merge|Revert)/;

const archivo = process.argv[2];
if (!archivo) {
  console.error("Uso: node scripts/validar-commit.mjs <archivo-del-mensaje>");
  process.exit(1);
}

const primeraLinea = fs.readFileSync(archivo, "utf8").split(/\r?\n/)[0].trim();

const problemas = [];
if (!GENERADOS_POR_GIT.test(primeraLinea)) {
  if (!FORMATO.test(primeraLinea)) problemas.push("no sigue el formato tipo(alcance): descripción");
  if (primeraLinea.length > LARGO_MAXIMO) {
    problemas.push(`tiene ${primeraLinea.length} caracteres (máximo ${LARGO_MAXIMO})`);
  }
}

if (problemas.length > 0) {
  console.error(`
✖ Mensaje de commit rechazado: ${problemas.join(" y ")}.

  Tu mensaje:  ${primeraLinea || "(vacío)"}

  Formato:     tipo(alcance): descripción      (el alcance es opcional)
  Tipos:       feat, fix, docs, style, refactor, test, chore, perf, build, ci
  Ejemplo:     feat(identidad): login con bloqueo por intentos

  Detalle en docs/ESTANDAR-PROGRAMACION.md, sección 10.2.
`);
  process.exit(1);
}
