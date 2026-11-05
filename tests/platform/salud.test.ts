// Pruebas del estado de la aplicación (GET /api/v1/salud): versión desplegada y conexión a la base de datos.
import { afterEach, describe, expect, it, vi } from "vitest";

const consulta = vi.hoisted(() => vi.fn());
vi.mock("@/platform/db/prisma", () => ({ prisma: { $queryRaw: consulta } }));
vi.mock("@/platform/logger", () => ({ logger: { warn: vi.fn() } }));

const { verificarSalud, versionDesplegada } = await import("@/platform/salud");

afterEach(() => {
  vi.unstubAllEnvs();
  consulta.mockReset();
});

describe("versión desplegada", () => {
  it("usa el sha corto de KUBO_VERSION (AWS)", () => {
    vi.stubEnv("KUBO_VERSION", "1e42e02a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e");
    expect(versionDesplegada()).toBe("1e42e02");
  });
  it("usa el commit de Vercel si no hay KUBO_VERSION", () => {
    vi.stubEnv("KUBO_VERSION", "");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "fd459bf0123456789");
    expect(versionDesplegada()).toBe("fd459bf");
  });
  it("en local informa «desarrollo»", () => {
    vi.stubEnv("KUBO_VERSION", "");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    expect(versionDesplegada()).toBe("desarrollo");
  });
});

describe("estado de la aplicación", () => {
  it("ok cuando la base de datos responde al SELECT 1", async () => {
    consulta.mockResolvedValue([{ "?column?": 1 }]);
    expect(await verificarSalud()).toMatchObject({ estado: "ok", baseDatos: "ok" });
  });
  it("error cuando la base de datos falla, sin exponer el detalle", async () => {
    consulta.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:5432"));
    const salud = await verificarSalud();
    expect(salud).toMatchObject({ estado: "error", baseDatos: "error" });
    expect(JSON.stringify(salud)).not.toContain("ECONNREFUSED");
  });
});
