// Precarga de los formularios de registro con la persona ya registrada (bloque M5, D-07): al validar un DNI existente,
// los campos muestran los datos guardados en lugar de quedar vacíos. El backend solo completa lo que falta, así que
// enviarlos de vuelta no cambia lo que guarda.

/** Formulario cuyos campos son texto («» = vacío). */
type Formulario<T> = { [K in keyof T]: string };

/** Valor registrado de la persona para un campo, si es un texto con contenido. */
function valorDe(persona: object, clave: string): string | null {
  const valor = (persona as Record<string, unknown>)[clave];
  return typeof valor === "string" && valor !== "" ? valor : null;
}

/**
 * Copia en `datos` los valores registrados de la persona (la respuesta de GET /comunidad/personas?dni=) para las
 * `claves` indicadas. Con `reemplazar`, los pone aunque el campo ya tenga algo (campos bloqueados, que deben mostrar
 * lo registrado); sin él, solo llena los vacíos. Un valor registrado vacío o null nunca borra lo escrito.
 *   precargarDePersona(datos, persona, ["fechaNacimiento", "telefono"]);
 */
export function precargarDePersona<T extends Formulario<T>>(
  datos: T,
  persona: object,
  claves: (keyof T & string)[],
  reemplazar = false,
): T {
  const nuevo = { ...datos };
  for (const clave of claves) {
    const valor = valorDe(persona, clave);
    if (valor !== null && (reemplazar || !nuevo[clave])) nuevo[clave] = valor as T[typeof clave];
  }
  return nuevo;
}

/**
 * Al cambiar el DNI, deja vacíos los campos que todavía tienen el valor precargado de la persona anterior (lo que el
 * usuario cambió a mano se conserva).
 */
export function quitarPrecargados<T extends Formulario<T>>(datos: T, persona: object, claves: (keyof T & string)[]): T {
  const nuevo = { ...datos };
  for (const clave of claves) {
    const valor = valorDe(persona, clave);
    if (valor !== null && nuevo[clave] === valor) nuevo[clave] = "" as T[typeof clave];
  }
  return nuevo;
}
