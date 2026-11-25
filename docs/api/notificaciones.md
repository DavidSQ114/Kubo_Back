# API · Notificaciones internas (US55)

> **Bloque M1:** la configuración académica, la matrícula, los pagos, los horarios, las notas y la asistencia de alumnos son del rol `COORDINADOR` (Coordinador académico); usuarios, aulas, parámetros, asistencia docente y auditoría, del `ADMINISTRADOR`. La tabla exacta de cada endpoint está en [ACCESOS.md](../ACCESOS.md).

Base: `/api/v1` · Formato: JSON · Éxito `{ "data": … }` · Error `{ "error": { "code", "message", "details" } }`
Las tres rutas exigen sesión con **cualquier perfil** (Administrador, Coordinador académico, Docente, Apoderado o Alumno; ver [identidad.md](identidad.md)) y trabajan solo con las notificaciones del **usuario en sesión**: nadie lee ni marca notificaciones ajenas. Ejemplos en [notificaciones.http](notificaciones.http). Pantallas: [frontend-notificaciones.md](../frontend-notificaciones.md). Diseño: [arquitectura/AD-17](../arquitectura/AD-17-notificaciones-y-bandeja-de-salida.md).

## Endpoints

| Método y ruta | Cuerpo / consulta | Respuesta `data` |
|---|---|---|
| `GET /notificaciones/no-leidas` | — | `{ noLeidas }`: el número de la campana (la cabecera lo pide al cargar y cada 60 s) |
| `GET /notificaciones` | `?estado=todas` (por defecto) o `?estado=no-leidas` | `{ noLeidas, items: Notificacion[] }` |
| `POST /notificaciones/marcar-leidas` | `{ ids?: string[] }` (hasta 50) | `{ marcadas, noLeidas }` |

`Notificacion`: `{ id, tipo, titulo, mensaje, enlace, leida, creadaEn, leidaEn }`.

- `tipo`: `NOTAS`, `HORARIO`, `PAGO`, `RECTIFICACION`, `ASISTENCIA`, `RECORDATORIO` (y `MATERIAL`, `TRABAJO`, `SISTEMA`, reservados). El panel elige el ícono según el tipo.
- `enlace`: ruta de la pantalla del portal («/apoderado/notas»). Solo se guardan rutas internas; un enlace externo se descarta.
- El panel trae las de los **últimos 30 días**, las más recientes primero, hasta 50. `noLeidas` cuenta las no leídas de esos 30 días.
- **«Marcar como leídas»** sin `ids` marca todas las no leídas del usuario. Con `ids`, solo esas; si alguna no es del usuario (o no existe) responde `404 NOTIFICACION_NO_ENCONTRADA` «La notificación no existe.» y no marca ninguna (no revela de quién es).

| Código | Estado | Cuándo |
|---|---|---|
| `NO_AUTENTICADO` | 401 | Sin sesión o sesión vencida |
| `DATOS_INVALIDOS` | 400 | `estado` distinto de `todas` / `no-leidas`; `ids` que no son UUID o más de 50 |
| `NOTIFICACION_NO_ENCONTRADA` | 404 | Algún id no es del usuario en sesión |

## Qué genera notificaciones

Cada evento crea la notificación **en la misma transacción** que la operación; el correo que ya existía se mantiene y sale después de confirmar, por la bandeja de salida (si falla, se reintenta sin revertir la operación).

| Evento | Destinatarios (con cuenta) | Tipo · enlace | Correo |
|---|---|---|---|
| Notas publicadas (US39) | Apoderados vinculados y alumnos de esos registros | `NOTAS` · `/apoderado/notas`, `/alumno/notas` | A los apoderados (como antes) |
| Horario publicado o nueva versión (US31) | Docentes con clases, apoderados y alumnos matriculados en la sección | `HORARIO` · `/docente/horario`, `/apoderado/horario`, `/alumno/horario` | A los docentes (como antes) |
| Pago confirmado en Tesorería, pago anual, observado confirmado o pasarela (US22, US58, US23, US70) | Apoderado responsable del pago | `PAGO` · `/apoderado/pagos` | La copia del recibo (US25), sin cambios |
| Registro de notas cerrado (US39) | Coordinadores académicos activos | `NOTAS` · `/coordinador/notas` | A los coordinadores |
| Solicitud de rectificación nueva (US41) | Coordinadores académicos activos | `RECTIFICACION` · `/coordinador/notas` | A los coordinadores |
| Rectificación aprobada o rechazada (US41) | Docente del registro | `RECTIFICACION` · `/docente/notas` | Al docente |
| Inasistencias del 15 % y del 20 % (US52) | Apoderado principal | `ASISTENCIA` · `/apoderado/asistencia` | Al alumno y al apoderado (como antes); el aviso mensual sigue solo por correo |
| Recordatorio de pago (US59) | Apoderado responsable del pago | `RECORDATORIO` · `/apoderado/pagos` | Al apoderado, con el detalle de la deuda |

Las personas sin cuenta (o con la cuenta dada de baja) no reciben notificación; si tienen correo, siguen recibiendo el correo.

## Bandeja de salida de correos (US55, criterio 3)

Los correos de estos avisos se guardan en `outbox_evento` (`tipo_evento = 'CORREO'`, `payload { para, asunto, texto }`) dentro de la transacción y se intentan enviar al confirmarla. Si el envío falla, quedan `PENDIENTE` y los reintenta `npm run conciliar-pagos` (timer de 15 minutos en la EC2) con espera creciente (5, 10, 20 y 40 minutos). Al quinto intento fallido quedan `FALLIDO`. La operación que los originó nunca se revierte ni se bloquea. A mano: `npm run reintentar-correos`.
