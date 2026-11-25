// comunidad/domain: «Mi perfil» (bloque M1, todos los roles). Cada usuario cambia solo su teléfono y su dirección;
// el correo y el DNI los cambia el administrador (US69). Reglas puras para saber qué cambió y qué se audita.

/** Datos que cada persona modifica en su propio perfil. */
export const CAMPOS_PERFIL_PROPIO = ["telefono", "direccion"] as const;
export type CampoPerfilPropio = (typeof CAMPOS_PERFIL_PROPIO)[number];

export type DatosPerfilPropio = Partial<Record<CampoPerfilPropio, string | null>>;

/**
 * Campos enviados que de verdad cambian, con su valor anterior y nuevo (lo que se guarda en ACTUALIZAR_PERFIL). Un
 * campo que no se envía no cambia; uno vacío o null se borra.
 */
export function cambiosDePerfilPropio(
  actual: Record<CampoPerfilPropio, string | null>,
  enviados: DatosPerfilPropio,
): { anterior: DatosPerfilPropio; nuevo: DatosPerfilPropio } {
  const anterior: DatosPerfilPropio = {};
  const nuevo: DatosPerfilPropio = {};
  for (const campo of CAMPOS_PERFIL_PROPIO) {
    if (!(campo in enviados) || enviados[campo] === undefined) continue;
    const valor = enviados[campo]?.trim() || null;
    if (valor === actual[campo]) continue;
    anterior[campo] = actual[campo];
    nuevo[campo] = valor;
  }
  return { anterior, nuevo };
}
