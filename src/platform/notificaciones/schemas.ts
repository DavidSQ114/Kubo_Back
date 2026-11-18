// platform/notificaciones: validación de las entradas del panel de notificaciones (US55, RNF16).
import { z } from "zod";
import { MAXIMO_IDS_POR_MARCADO } from "./reglas";

/** GET /notificaciones?estado=no-leidas: la pestaña «No leídas» del panel; por defecto, «Todas». */
export const ListadoSchema = z.object({
  estado: z.enum(["todas", "no-leidas"], { message: "Filtro de notificaciones no válido" }).default("todas"),
});

/** «Marcar como leídas»: sin ids, todas las no leídas del usuario. */
export const MarcarLeidasSchema = z.object({
  ids: z
    .array(z.string().uuid("Notificación no válida"), { message: "Notificaciones no válidas" })
    .max(MAXIMO_IDS_POR_MARCADO, "Demasiadas notificaciones a la vez")
    .optional(),
});
