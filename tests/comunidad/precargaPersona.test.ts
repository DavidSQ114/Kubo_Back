// Bloque M5 · Precarga de los formularios de registro con la persona ya registrada (D-07): al validar un DNI existente,
// los campos muestran los datos guardados en lugar de quedar vacíos.
import { describe, expect, it } from "vitest";
import { precargarDePersona, quitarPrecargados } from "@/lib/personas";

interface Formulario {
  dni: string;
  fechaNacimiento: string;
  telefono: string;
  ocupacion: string;
  direccion: string;
}

const vacio: Formulario = { dni: "41200001", fechaNacimiento: "", telefono: "", ocupacion: "", direccion: "" };
const persona = {
  nombres: "Jorge Luis",
  fechaNacimiento: "1980-05-10",
  telefono: "987654321",
  ocupacion: "Comerciante",
  direccion: null,
};
const claves: (keyof Formulario)[] = ["fechaNacimiento", "telefono", "ocupacion", "direccion"];

describe("precarga con la persona registrada (bloque M5)", () => {
  it("llena los campos vacíos con lo registrado y deja vacío lo que no está registrado", () => {
    expect(precargarDePersona(vacio, persona, claves)).toEqual({
      dni: "41200001",
      fechaNacimiento: "1980-05-10",
      telefono: "987654321",
      ocupacion: "Comerciante",
      direccion: "",
    });
  });

  it("sin reemplazar conserva lo que ya escribió el usuario; con reemplazar (campos bloqueados) muestra lo registrado", () => {
    const escrito = { ...vacio, telefono: "912345678" };
    expect(precargarDePersona(escrito, persona, claves).telefono).toBe("912345678");
    expect(precargarDePersona(escrito, persona, claves, true).telefono).toBe("987654321");
    // un dato no registrado nunca borra lo escrito
    expect(precargarDePersona({ ...vacio, direccion: "Jr. Lima 1" }, persona, claves, true).direccion).toBe(
      "Jr. Lima 1",
    );
  });

  it("al cambiar el DNI se vacían solo los campos que siguen con el valor precargado", () => {
    const precargado = { ...precargarDePersona(vacio, persona, claves), ocupacion: "Ingeniero" };
    expect(quitarPrecargados(precargado, persona, claves)).toEqual({
      dni: "41200001",
      fechaNacimiento: "",
      telefono: "",
      ocupacion: "Ingeniero",
      direccion: "",
    });
  });
});
