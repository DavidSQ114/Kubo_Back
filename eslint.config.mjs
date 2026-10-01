// Reglas de Next.js más las reglas propias de Kubo (docs/ESTANDAR-PROGRAMACION.md, sección 11.3).
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";

const CODIGO = ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"];

// Patrones de no-restricted-imports. En flat config un bloque posterior REEMPLAZA las opciones de la regla
// (no las suma), así que cada bloque de abajo lleva la lista completa que le corresponde.
const SOLO_POR_INDEX = {
  group: ["@/modules/*/*"],
  message: "Importa el módulo solo por su index.ts (estándar 3.3).",
};
const SIN_CLIENTE_PRISMA = {
  group: ["@/generated/prisma/*"],
  message: "El cliente de Prisma solo se usa en infrastructure/ y en platform/db (estándar 3.3).",
};
const DOMINIO_PURO = {
  group: ["next", "next/*", "@/platform/db/*", "@/generated/prisma/*"],
  message: "El dominio es puro: sin Next.js, Prisma ni base de datos (estándar 3.2).",
};
const restringir = (...patterns) => ["error", { patterns }];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    name: "kubo/estandar",
    files: CODIGO,
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": "error",
      "no-restricted-imports": restringir(SOLO_POR_INDEX, SIN_CLIENTE_PRISMA),
      // Los imports de efecto (import "@/server/wiring") no se reordenan: se quedan donde están, primero.
      "import/order": [
        "error",
        {
          groups: [["builtin", "external"], "internal", ["parent", "sibling", "index"]],
          pathGroups: [{ pattern: "@/**", group: "internal" }],
          "newlines-between": "never",
        },
      ],
    },
  },
  {
    name: "kubo/prisma-permitido",
    files: ["src/modules/*/infrastructure/**", "src/platform/db/**"],
    rules: { "no-restricted-imports": restringir(SOLO_POR_INDEX) },
  },
  {
    name: "kubo/dominio-puro",
    files: ["src/modules/*/domain/**"],
    rules: { "no-restricted-imports": restringir(SOLO_POR_INDEX, DOMINIO_PURO) },
  },
  {
    name: "kubo/pruebas",
    files: ["tests/**"],
    rules: { "no-restricted-imports": restringir(SIN_CLIENTE_PRISMA) },
  },
  {
    name: "kubo/consola-permitida",
    files: ["src/platform/logger/**", "src/platform/correo/**"],
    rules: { "no-console": "off" },
  },
  // Al final: apaga las reglas de formato que chocan con Prettier.
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Código generado y copias de trabajo de otras ramas
    "src/generated/**",
    "coverage/**",
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
