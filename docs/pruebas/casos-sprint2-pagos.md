# Casos de prueba · Sprint 2, bloque 5: pago manual (US22), pago duplicado (US23), log de auditoría de pagos (US04) y recibo en PDF (US25)

Pantalla AD-11 «Pensiones y pagos» (`/admin/pagos`) con sus modales M-01 «Registrar pago manual» y M-02 «Anular pago», y el recibo M-03. API: [matricula.md](../api/matricula.md#pensiones-y-pagos-ad-11); ejemplos en [matricula.http](../api/matricula.http).
Las reglas puras se prueban además con Vitest (sección «Casos unitarios»).

**Precondición común (PC):** sesión iniciada como Administrador (`admin@kubo.edu.pe`) con la contraseña ya cambiada. Seed cargado. Año 2027 «En matrícula» con montos S/ 350.00 y S/ 450.00. La estudiante ficticia Valeria Quispe Rojas está matriculada en 3° B de 2027, con la apoderada ficticia Carmen Rojas Medina como responsable del pago, y tiene 11 cuotas «Pendiente» (matrícula y pensiones de marzo a diciembre de 2027). SMTP sin configurar. Hoy: 06/11/2026. Solo datos ficticios (RNF14).
Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y muestra el mensaje).

## US22 · Registro de pago manual

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US22-01 | US22 | básico | PC | 1. Abrir «Pensiones y pagos». 2. Buscar a Valeria. 3. «Registrar pago». 4. Marcar marzo y abril. 5. Ingresar los datos. 6. «Registrar pago». | S/ 900.00 · 06/11/2026 · N.° 00561207 · Transferencia | Aviso «Operación registrada correctamente · Operación 00561207 · 2 cuotas (…) · S/ 900.00» con «Ver recibo». Marzo y abril quedan «Pagado» con la fecha, el N.° y el recibo R-2026-000001; la operación aparece «Confirmado». Auditoría `REGISTRAR_PAGO`. |
| CP-US22-02 | US22 | excepción | PC | 1. Registrar marzo y abril con otro monto. | S/ 899.99 | «El monto ingresado no coincide con el total de las cuotas seleccionadas». API: `422 MONTO_NO_COINCIDE` con `details.total: "900.00"`. No se registra nada. |
| CP-US22-03 | US22 | excepción | PC | 1. Registrar con el N.° de operación vacío o solo con espacios. | `"   "` | «El número de operación es obligatorio» bajo el campo. API: `422 NUMERO_OPERACION_REQUERIDO`. |
| CP-US22-04 | US22 | excepción | PC | 1. Registrar con una fecha de pago futura. | 07/11/2026 | `422 FECHA_PAGO_FUTURA`; el calendario no deja elegir días posteriores a hoy. |
| CP-US22-05 | US22 | alterno | PC | 1. En el cronograma, «Registrar pago» en la fila de julio. | — | M-01 se abre con julio marcado y el monto S/ 450.00. Al marcar otra cuota, el total y el monto se actualizan. |
| CP-US22-06 | US22 | excepción | PC | 1. Registrar por la API cuotas de dos estudiantes distintos. | — | `422 CUOTAS_DE_VARIOS_ESTUDIANTES`. |
| CP-US22-07 | US22 | básico | CP-US22-01 | 1. Revisar los totales del estado de cuenta. | — | «Pagado» S/ 900.00 (2 cuotas); «Pendiente» y «Vencido» con el resto; la suma se hace en céntimos, sin decimales perdidos. |

## US23 · Validación de pago duplicado

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US23-01 | US23 | excepción | CP-US22-01 | 1. Registrar otra vez el pago de marzo. | N.° 00999999 | «Esta pensión ya fue cancelada el 06/11/2026». API: `409 CUOTA_YA_PAGADA`. En M-01 marzo ya no aparece entre las pendientes. |
| CP-US23-02 | US23 | excepción | Una cuota pendiente | 1. Enviar al mismo tiempo dos pagos de esa cuota. | Prueba de integración | Solo uno se registra; el otro recibe «Esta pensión ya fue cancelada el …». Queda una sola fila `pago` para la cuota (`tests/matricula/pagos.integracion.test.ts`). |
| CP-US23-03 | US23 | alterno | CP-US22-01 | 1. Registrar mayo con el mismo N.° 00561207. | — | Aviso «Operación observada · Este número de operación ya fue utilizado en otro pago». La operación queda «Observado» con «Número ya usado en R-2026-000001»; mayo sigue «Pendiente» (marcado «Observado») y no descuenta la deuda; sin recibo. |
| CP-US23-04 | US23 | básico | CP-US23-03 | 1. «Confirmar» en la fila de la operación observada. | — | Pasa a «Confirmado» con el recibo R-2026-000002; mayo queda «Pagado». `confirmado_por` = el administrador. Auditoría `CONFIRMAR_PAGO_OBSERVADO`. |
| CP-US23-05 | US23 | alterno | Otra operación observada (junio) | 1. «Descartar» en su fila. | — | Pasa a «Anulado» con «Pago duplicado», el responsable y la fecha; junio sigue «Pendiente». Auditoría `ANULAR_PAGO` con `decision: "DESCARTAR_OBSERVADO"`. |
| CP-US23-06 | US23 | excepción | CP-US23-04 | 1. Confirmar otra vez por la API. | — | `409 PAGO_NO_OBSERVADO`. |
| CP-US23-07 | US23 | básico | Pago de junio confirmado con N.° 00700001 y luego anulado | 1. Registrar otra vez junio con el mismo N.° 00700001. | — | Se registra «Confirmado» con un recibo nuevo: el pago anulado no cuenta como duplicado. |
| CP-US23-08 | US23 | excepción | Dos cuotas pendientes | 1. Enviar al mismo tiempo dos pagos con el mismo N.° de operación. | Prueba de integración | Uno queda «Confirmado» y el otro «Observado» con el aviso del Backlog y sin recibo. |

## US04 · Log de auditoría de pagos

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US04-01 | US04 | básico | CP-US22-01 | 1. Revisar «Log de auditoría de pagos» y la bitácora. | — | Registro con fecha y hora, «Op. 00561207 · R-2026-000001 · … · S/ 900.00 · Pagado» y el usuario. `REGISTRAR_PAGO` guarda `administradorId`, `fechaHora`, `monto`, `conceptos`, `numeroOperacion` y `estadoResultante: "PAGADO"`. |
| CP-US04-02 | US04 | excepción | CP-US22-01 | 1. Anular la operación (ícono de prohibido). 2. «Anular pago» sin elegir motivo. | — | «Selecciona el motivo de la anulación.»; no se anula. API: `422 MOTIVO_ANULACION_REQUERIDO`. |
| CP-US04-03 | US04 | excepción | CP-US22-01 | 1. Elegir «Otro» sin observación. | — | «Con el motivo «Otro», describe la anulación en la observación.». API: `422 DETALLE_ANULACION_REQUERIDO`. |
| CP-US04-04 | US04 | básico | CP-US22-01 | 1. Elegir «Error de digitación», escribir la observación y anular. | «Monto mal digitado» | Aviso «Pago anulado». La operación queda «Anulado el … por A. Kubo · Error de digitación: Monto mal digitado»; marzo y abril vuelven a «Pendiente». Auditoría `ANULAR_PAGO` con el motivo y las cuotas revertidas. Nada se borra. |
| CP-US04-05 | US04 | excepción | CP-US04-04 | 1. Anular otra vez por la API. | — | `409 PAGO_YA_ANULADO`. |
| CP-US04-06 | US04 | básico | CP-US04-04 | 1. Revisar la bitácora y los logs. | — | Ningún DNI en `registro_auditoria` de pagos ni en `logs/`; los registros no se pueden modificar (trigger de auditoría inmutable). |
| CP-US04-07 | US04 | excepción | Matrícula con un pago confirmado | 1. Anular la matrícula (M-19). | — | `409 MATRICULA_CON_PAGOS`; el modal enlaza «Ir a Pensiones y pagos». |

## US25 · Comprobante de pago en PDF

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US25-01 | US25 | básico | CP-US22-01 | 1. «Ver recibo». | — | Se descarga `recibo-R-2026-000001.pdf` con estudiante, sección, apoderado responsable, cuotas con vencimiento y monto, total, fecha de pago, N.° de operación, medio y quién lo registró. Tildes y ñ se ven bien. |
| CP-US25-02 | US25 | excepción | CP-US23-03 | 1. Descargar el recibo de la operación observada por la API. | — | `422 RECIBO_NO_CONFIRMADO` «No se puede generar un recibo de un pago no confirmado»; no se genera el archivo. En la pantalla no hay botón de descarga. |
| CP-US25-03 | US25 | básico | CP-US23-04 | 1. Descargar el recibo. 2. Comparar su SHA-256 con `comprobante.checksum_sha256`. | — | Coinciden: el PDF es determinista (sin «generado el»). `archivo_url` = `/api/v1/matricula/pagos/{id}/comprobante`. |
| CP-US25-04 | US25 | alterno | CP-US04-04 | 1. Descargar el recibo de la operación anulada. | — | Se descarga con la marca de agua «ANULADO» y «Estado: Anulado». |
| CP-US25-05 | US25 | básico | Dos pagos confirmados a la vez | 1. Revisar sus comprobantes. | Prueba de integración | Números seguidos (por ejemplo R-2026-000003 y R-2026-000004), sin repetir ni saltar. |
| CP-US25-06 | US25 | alterno | SMTP sin configurar (como en AWS) | 1. Registrar un pago. | — | El pago se registra; el aviso dice «El correo no está configurado: entrega el recibo descargándolo.». `enviado_en` queda vacío y el log tiene «SMTP no configurado: no se envió la copia del recibo» solo con el número del recibo. |
| CP-US25-07 | US25 | básico | SMTP configurado (Mailtrap) | 1. Registrar un pago. | — | El apoderado responsable recibe el correo con el PDF adjunto; `enviado_en` se llena. Si el envío falla, el pago se conserva. |

## Casos unitarios (Vitest)

Se ejecutan con `npm test`. No usan la base de datos y emplean fechas fijas. Las pruebas de integración se ejecutan aparte (CU-US23-05).

| ID | Archivo | Qué verifica | Resultado esperado |
|---|---|---|---|
| CU-US22-01 | `tests/matricula/pagos.test.ts` | Suma exacta | Marzo + abril = 90000 céntimos; «900.00» y «900» coinciden |
| CU-US22-02 | ídem | Monto distinto | 899.99 o 450 → `MONTO_NO_COINCIDE` con el mensaje del Backlog |
| CU-US22-03 | ídem | Sin float | 0.10 + 0.20 = 0.30 exacto |
| CU-US22-04 | ídem | Número de operación | Vacío, espacios o nulo → «El número de operación es obligatorio»; «  op  00561207 » → «OP 00561207» |
| CU-US22-05 | ídem | Cuotas | Ninguna, repetida, inexistente, de otro estudiante o anulada → error |
| CU-US22-06 | ídem | Fecha de pago | Hoy → válido; mañana → `FECHA_PAGO_FUTURA` |
| CU-US23-01 | ídem | Cuota ya pagada | «Esta pensión ya fue cancelada el 03/07/2026» |
| CU-US23-02 | ídem | Estado inicial | Número usado → Observado; si no → Confirmado |
| CU-US23-03 | ídem | Confirmar o descartar | Solo Observado; Confirmado o Anulado → `PAGO_NO_OBSERVADO` |
| CU-US23-04 | ídem | Pago tras anulación | Una cuota que volvió a Pendiente se paga otra vez |
| CU-US23-05 | `tests/matricula/pagos.integracion.test.ts` | Pagos simultáneos (base temporal) | Misma cuota: uno y `CUOTA_YA_PAGADA`; mismo número: Confirmado y Observado; distintos: correlativos seguidos. Con `KUBO_PRUEBA_INTEGRACION=1` y `DATABASE_URL` de una base temporal |
| CU-US04-01 | `tests/matricula/pagos.test.ts` | Motivo de anulación | Sin motivo → `MOTIVO_ANULACION_REQUERIDO`; «Otro» sin detalle → `DETALLE_ANULACION_REQUERIDO` |
| CU-US04-02 | ídem | Estados anulables | Confirmado y Observado → válido; Anulado → `PAGO_YA_ANULADO` |
| CU-US25-01 | ídem | Correlativo | «R-2026-000001»; tras «R-2026-000041» → «R-2026-000042»; otro año empieza en 1 |
| CU-US25-02 | ídem | Recibo disponible | Confirmado o Anulado con comprobante → válido; Observado o sin comprobante → «No se puede generar un recibo de un pago no confirmado» |
| CU-US25-03 | `tests/platform/pdf.test.ts` | PDF determinista y marca | Con fecha fija, los mismos bytes; con «ANULADO», otros bytes; la fecha queda en los metadatos |
| CU-US22-07 | `tests/matricula/pagos.test.ts` | Esquema del pago | Montos con tres decimales, negativos o en texto, medios fuera de la lista y sin cuotas → inválido |
