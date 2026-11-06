# Casos de prueba · Sprint 2, bloque 6: pago anual adelantado (US58), panel de morosidad (US24) y log de errores del sistema (US05)

Pantallas: el modal M-15 «Pago anual adelantado» en AD-11 «Pensiones y pagos» (`/admin/pagos`), AD-12 «Panel de morosidad» (`/admin/morosidad`) y AD-16 «Auditoría · Log de errores» (`/admin/auditoria`). API: [matricula.md](../api/matricula.md) e [identidad.md](../api/identidad.md#log-de-errores-del-sistema-us05-ad-16--solo-administrador-solo-lectura); ejemplos en [matricula.http](../api/matricula.http).
Las reglas puras se prueban además con Vitest (sección «Casos unitarios»).

**Precondición común (PC):** sesión iniciada como Administrador (`admin@kubo.edu.pe`) con la contraseña ya cambiada. Seed cargado. Año 2026 «En curso» y 2027 «En matrícula», ambos con montos S/ 350.00 y S/ 450.00. La apoderada ficticia Carmen Rojas Medina (teléfono 987654321) es la responsable del pago de los estudiantes ficticios Quispe Rojas:
- en 2026: Valeria en 3° B con la matrícula y octubre vencidos, Diego en 3° A con la matrícula vencida y Sofía retirada con la matrícula vencida;
- en 2027: Mateo y Lucía en 3° B, con 11 cuotas pendientes cada uno.

SMTP sin configurar. Hoy: 06/11/2026. Solo datos ficticios (RNF14).
Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y muestra el mensaje).

## US58 · Pago anual adelantado

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US58-01 | US58 | básico | PC | 1. En AD-11, abrir la cuenta de Mateo (2027). 2. «Pago anual». | — | M-15 muestra «11 cuotas del año S/ 4 850.00», «Cuotas ya pagadas (0)» y «Total a pagar hoy (11 pendientes) S/ 4 850.00», sin descuento; el monto viene precargado. |
| CP-US58-02 | US58 | excepción | PC | 1. Ingresar otro monto y «Registrar pago anual». | S/ 4 000.00 | «El monto no coincide con el total pendiente». API: `422 MONTO_NO_COINCIDE_PENDIENTE` con `details.total: "4850.00"`. No se registra nada. |
| CP-US58-03 | US58 | básico | PC | 1. Monto exacto, N.° y medio. 2. «Registrar pago anual». | S/ 4 850.00 · 00701244 · Transferencia | Una operación «Confirmado» con las 11 cuotas y un único recibo R-2026-…; las cuotas quedan «Pagado» y la modalidad, «anual». Auditoría `REGISTRAR_PAGO` (`tipoPago: "ANUAL"`) y `CAMBIAR_MODALIDAD_PAGO` (MENSUAL → ANUAL). |
| CP-US58-04 | US58 | alterno | Matrícula con cuotas ya pagadas | 1. «Pago anual». | Valeria 2026: matrícula, octubre y diciembre pendientes | El total excluye las pagadas; solo se pagan las pendientes (vencidas o no) en una operación de 3 cuotas. |
| CP-US58-05 | US58 | excepción | CP-US58-03 | 1. Pago anual otra vez por la API. | — | `422 SIN_CUOTAS_PENDIENTES`. En AD-11 ya no aparece «Pago anual». |
| CP-US58-06 | US58 | excepción | Sofía retirada | 1. Pago anual por la API. | — | `409 PAGO_ANUAL_NO_PERMITIDO`. |
| CP-US58-07 | US58 | alterno | CP-US58-03 | 1. Pago anual de Lucía con el N.° 00701244. 2. «Confirmar» en su fila. | — | Primero queda «Observado» con «Este número de operación ya fue utilizado en otro pago» y la modalidad sigue «mensual». Al confirmar, las cuotas quedan «Pagado» y la modalidad pasa a «anual» (`CAMBIAR_MODALIDAD_PAGO`). |
| CP-US58-08 | US58 | excepción | PC | 1. Pago anual sin N.° de operación. | — | «El número de operación es obligatorio». |

## US24 · Panel de morosidad

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US24-01 | US24 | básico | PC | 1. Abrir «Morosidad» del menú. | Año 2026 | Lista a Valeria (3° B · Matr., Oct · 2 cuotas · S/ 800.00 · 36 días) y Diego (3° A · Matr. · S/ 350.00), con Carmen Rojas Medina · Madre · 987654321. Indicadores: 2 estudiantes, S/ 1 150.00, 3 cuotas vencidas. |
| CP-US24-02 | US24 | básico | PC | 1. Elegir grado 3° y sección 3° A. 2. «Filtrar». | — | Solo Diego. |
| CP-US24-03 | US24 | alterno | PC | 1. «Meses adeudados: 2 o más» y ordenar por meses. 2. «Filtrar». | — | Solo Valeria. |
| CP-US24-04 | US24 | básico | CP-US24-01 | 1. Pagar la cuota vencida de Diego en AD-11. 2. Volver al panel y «Filtrar». | — | Diego ya no aparece (sin caché). |
| CP-US24-05 | US24 | alterno | PC | 1. Revisar que no salgan Sofía (retirada) ni cuotas anuladas. | — | Sofía no se lista aunque tenga una cuota vencida; una pensión anulada de Diego no suma a su deuda. |
| CP-US24-06 | US24 | alterno | Cuota que vence hoy | 1. Abrir el panel. | Vence el 06/11/2026 | No se lista: el día del vencimiento todavía no es mora. |
| CP-US24-07 | US24 | básico | CP-US24-01 | 1. Ícono de la fila de Valeria. | — | Abre AD-11 con su estado de cuenta del año. |
| CP-US24-08 | US24 | alterno | CP-US24-01 | 1. «Exportar CSV». | — | Se descarga `morosidad-2026-2026-11-06.csv` con las mismas filas, separadas por `;`. |
| CP-US24-09 | US24 | excepción | PC | 1. Consultar la API sin año. | — | `400 DATOS_INVALIDOS` «Elige el año académico». |
| CP-US24-10 | US24 | alterno | Todos al día | 1. Abrir el panel. | — | «No hay estudiantes con pensiones vencidas con estos filtros.» e indicadores en cero. |

## US05 · Log de errores del sistema

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US05-01 | US05 | básico | Error no controlado en una ruta | 1. Provocar un 500 (prueba unitaria con la base simulada). | `tests/platform/errores.test.ts` | Respuesta `500 ERROR_INTERNO` con el requestId y sin stack. En `log_error` y en el log JSON: fecha, endpoint, método, stack trace completo, el usuario de la sesión y el requestId. |
| CP-US05-02 | US05 | básico | PC | 1. Enviar un pago con datos inválidos. | `{ "conceptoIds": [], "monto": "abc" }` | `400 DATOS_INVALIDOS`. En el log, un evento `INFO` «Datos inválidos» sin stack; en `log_error`, una fila `INFO` 400 sin traza. |
| CP-US05-03 | US05 | alterno | PC | 1. Provocar un 409 (pagar una cuota ya pagada). | — | Solo un evento `INFO` «Solicitud rechazada» en el log; no hay fila en `log_error`. |
| CP-US05-04 | US05 | básico | Log con eventos | 1. Abrir «Auditoría». 2. Filtrar por nivel INFO y código 400. | — | Solo los eventos de validación, del más reciente al más antiguo, con el correo del usuario. |
| CP-US05-05 | US05 | básico | Un error 500 registrado | 1. «Ver» en su fila. | — | «Detalle del error» con endpoint, usuario, mensaje, stack trace completo y request ID. |
| CP-US05-06 | US05 | alterno | PC | 1. Filtrar «Desde» mañana. | — | «No hay registros con estos filtros.». |
| CP-US05-07 | US05 | excepción | PC | 1. Consultar la API con un nivel inexistente. | `nivel=DEBUG` | `400 DATOS_INVALIDOS` «Nivel no válido». |
| CP-US05-08 | US05 | básico | Error con datos personales en el mensaje | 1. Revisar el registro. | DNI 71234567, correo, token | El mensaje y el stack muestran `[dni]`, `[correo]` y `[token]`; ningún DNI en `log_error` ni en `logs/`. |
| CP-US05-09 | US05 | básico | `LOG_DIR` definido | 1. Superar 50 MB de log. | — | El archivo rota y el anterior queda comprimido (`…-kubo.log.gz`); se conservan los 10 más recientes (`rotating-file-stream` con `size: "50M"` y `compress: "gzip"`). |
| CP-US05-10 | US05 | excepción | Sesión de un perfil que no es Administrador | 1. Llamar a `GET /identidad/errores`. | — | `403 ACCESO_DENEGADO`. La pantalla es de solo lectura: no hay acciones para editar ni borrar. |

## Casos unitarios (Vitest)

Se ejecutan con `npm test`. No usan la base de datos (la prueba del 500 la simula) y emplean fechas fijas.

| ID | Archivo | Qué verifica | Resultado esperado |
|---|---|---|---|
| CU-US58-01 | `tests/matricula/morosidad.test.ts` | Total pendiente | Suma solo las Pendiente (sin pagadas ni anuladas), en céntimos |
| CU-US58-02 | ídem | Monto del pago anual | Exacto → válido; distinto → «El monto no coincide con el total pendiente» con `details.total` |
| CU-US58-03 | ídem | Matrícula y pendientes | Retirado → `PAGO_ANUAL_NO_PERMITIDO`; sin pendientes → `SIN_CUOTAS_PENDIENTES` |
| CU-US58-04 | ídem | Esquema | El pago anual no pide cuotas |
| CU-US24-01 | ídem | Cuota vencida | Pendiente con vencimiento anterior a hoy; el mismo día, pagada o anulada → no |
| CU-US24-02 | ídem | Meses adeudados | Matr., Ago, Set → etiquetas y 2 meses (pensiones) |
| CU-US24-03 | ídem | Días de atraso | 05/09 → 11 días al 16/09; 05/07 → 73 |
| CU-US24-04 | ídem | Filtro de meses y orden | «2 o más»; por monto o por meses, a igualdad por nombre |
| CU-US24-05 | ídem | Filtros | Año obligatorio, orden MONTO por defecto, `mesesMinimos` numérico |
| CU-US05-01 | `tests/platform/errores.test.ts` | Clasificador 500 | Error no controlado → INTERNO, ERROR, en tabla y con stack |
| CU-US05-02 | ídem | Clasificador 400 | Zod, JSON inválido y `ErrorApp` 400 → VALIDACION, INFO, sin stack |
| CU-US05-03 | ídem | Otros rechazos | 401, 409, 422 → INFO solo en el log; trigger de aforo → 422 legible |
| CU-US05-04 | ídem | Redactor | Oculta DNI, correos, JWT y «Bearer …»; no toca números de línea, horas, montos ni uuids; campos sensibles ocultos por nombre |
| CU-US05-05 | ídem | 500 controlado en `ruta()` | Fila en `log_error` con usuario (del token), endpoint, método, requestId, mensaje redactado y stack completo; respuesta sin stack |
| CU-US05-06 | ídem | 400 en `ruta()` | Evento INFO sin stack y fila INFO 400 sin traza |
| CU-US22-08 | `tests/matricula/pagos.integracion.test.ts` | Regresión del pago tras el refactor (base temporal) | Los tres casos de pagos simultáneos del bloque 5 siguen pasando |
