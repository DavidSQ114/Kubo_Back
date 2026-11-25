# Casos de prueba · Sprint 4, bloque M4: matrícula en línea con documentos y cuotas de ingreso, mora y extraordinarias

Pantallas del coordinador: AD-10 «Matrícula» (barra y modal de montos), AD-11 «Pensiones y pagos», «Cuotas
extraordinarias», «Proceso de matrícula» y «Solicitudes de matrícula». Portal del apoderado: AP-02 «Pagos» y
«Matrícula». API: [matricula.md](../api/matricula.md#bloque-m4--cuotas-de-ingreso-mora-y-extraordinarias) y
[academico.md](../api/academico.md#montos-del-año-us21).

Pruebas automáticas:

- `tests/matricula/cuotasM4.test.ts` (sin base): cuota de ingreso del alumno nuevo, montos opcionales (0) y nombre del
  recibo de las cuotas nuevas.
- `tests/matricula/mora.test.ts` (sin base): mora por pensión vencida, idempotencia, monto 0, condonación y la mora en
  el panel de morosidad.
- `tests/matricula/ordenPago.test.ts` y `ordenCuotasPantalla.test.ts` (sin base): D-14 con la cuota de ingreso, la mora
  y las extraordinarias, en el servidor y en la selección de la pantalla.
- `tests/matricula/extraordinarias.test.ts`, `proceso.test.ts` y `solicitudes.test.ts` (sin base): destino del lote,
  validaciones y anulación; fechas y documentos del proceso; reglas de la solicitud y de la revisión.
- `tests/matricula/cuotasM4.integracion.test.ts` (PostgreSQL, en el CI; año 2074, DNI 900026xx): ingreso al confirmar,
  orden con ingreso y mora, mora idempotente, condonada y con monto 0, lote extraordinario con vista previa, avisos y
  anulación, lote sin alumnos.
- `tests/matricula/solicitudes.integracion.test.ts` (PostgreSQL, en el CI; año 2073, DNI 900027xx): fuera de fechas,
  documento faltante o no permitido, solicitud con aviso a los coordinadores, permisos de los documentos, observar,
  reemplazar, aprobar y asignar la sección con la cuota de ingreso.

**Precondición común (PC):** año **2027** «En matrícula» con montos matrícula S/ 300, pensión S/ 400, ingreso S/ 250 y
mora S/ 20; secciones 1° A y 1° B. Coordinadora **Carmen**; apoderada **Lucía** con sus hijos **Mateo** (nuevo, sin
matrícula) y **Sofía** (estudió en el colegio en 2026). Apoderado **Jorge**, sin vínculo con ellos. Solo datos
ficticios (RNF14).

Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y
muestra el mensaje).

## Montos y cuota de ingreso (fase 1)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M4-01 | básico | PC | Carmen en AD-10 abre «Editar montos», completa ingreso y mora y guarda. | Ingreso 250, mora 20 | La barra muestra «Ingreso (alumno nuevo) S/ 250.00» y «Mora por pensión vencida S/ 20.00». Auditoría `GUARDAR_MONTOS_ANIO` con los cuatro montos. |
| CP-M4-02 | alterno | PC | Guardar la mora en 0. | Mora 0 | La barra dice «No se cobra». La tarea programada no genera moras de ese año. |
| CP-M4-03 | excepción | PC | Guardar un ingreso con tres decimales. | 250.555 | «Ingresa la cuota de ingreso con hasta dos decimales (por ejemplo, 350.00)» y no se guarda. |
| CP-M4-04 | básico | PC | Matricular a Mateo (alumno nuevo) en 1° A. | — | El cronograma trae «Cuota de ingreso 2027» de S/ 250.00 con el mismo vencimiento que la matrícula. |
| CP-M4-05 | alterno | PC | Matricular a Sofía (ya estudió en 2026). | — | El cronograma no trae cuota de ingreso. |

## Mora (fase 2)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M4-06 | básico | Mateo con la pensión de marzo vencida | Correr `npm run tareas-programadas`. | — | Aparece «Mora de la pensión de marzo 2027» de S/ 20.00 que vence hoy, en el estado de cuenta, en AP-02 y (desde mañana) en morosidad como «Mora Mar». |
| CP-M4-07 | alterno | CP-M4-06 | Correr la tarea otra vez. | — | No se crea otra mora para marzo (la log dice `creadas: 0`). |
| CP-M4-08 | básico | CP-M4-06 | En AD-11, «Condonar» la mora con motivo. | «Acuerdo con la familia» | «Mora condonada». La cuota queda «Anulado» con «Condonada: Acuerdo con la familia». Auditoría `CONDONAR_MORA`. La tarea no la vuelve a generar. |
| CP-M4-09 | excepción | Mora pagada | Condonarla por la API. | — | `409 MORA_PAGADA` «La mora ya fue pagada: no se puede condonar.» |

## Orden de pago (fase 3)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M4-10 | básico | CP-M4-04 | Abrir «Registrar pago». | — | La matrícula y la cuota de ingreso aparecen marcadas juntas; desmarcar una desmarca la otra. |
| CP-M4-11 | excepción | CP-M4-04 | Por la API, pagar solo la matrícula. | — | `409 INGRESO_CON_MATRICULA` «La matrícula y la cuota de ingreso se pagan juntas: incluye también «Cuota de ingreso 2027».» |
| CP-M4-12 | excepción | Matrícula pagada, ingreso pendiente | Pagar la pensión de marzo. | — | `409 MATRICULA_PENDIENTE` «Primero deben pagarse la matrícula 2027 y la cuota de ingreso. …» |
| CP-M4-13 | básico | CP-M4-06 | Marcar la pensión de marzo en M-01 o en «Pagar en línea». | — | Su mora se marca con ella; el total suma S/ 420.00. |
| CP-M4-14 | excepción | CP-M4-06 | Por la API, pagar marzo sin su mora. | — | `409 MORA_CON_PENSION` «La «Pensión de marzo 2027» y su mora se pagan en la misma operación: incluye las dos.» |
| CP-M4-15 | alterno | CP-M4-06 | Pago anual adelantado. | — | El total incluye la mora pendiente y las extraordinarias pendientes. |

## Cuotas extraordinarias (fase 4)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M4-16 | básico | 1° A con 2 matriculados | «Nueva cuota extraordinaria» → «Ver vista previa». | Paseo, S/ 45, destino 1° A | La vista previa muestra 2 cuotas, total S/ 90.00 y los dos alumnos. |
| CP-M4-17 | básico | CP-M4-16 | «Generar 2 cuotas». | — | «Se generaron 2 cuotas «Paseo» por S/ 90.00.» Auditoría `CREAR_LOTE_EXTRAORDINARIO`. Lucía recibe «Nueva cuota extraordinaria» en la campana. |
| CP-M4-18 | alterno | CP-M4-17 | Lucía paga en línea solo el paseo, con la matrícula pendiente. | — | Se puede: la extraordinaria no entra en el orden. El recibo dice «Paseo». |
| CP-M4-19 | excepción | Grado sin matriculados | Vista previa con destino ese grado. | — | `422 LOTE_SIN_MATRICULAS` «No hay alumnos matriculados en el destino elegido…». |
| CP-M4-20 | básico | CP-M4-18 | «Anular» el lote con motivo. | «Actividad cancelada» | Las cuotas sin pagar quedan «Anulado»; la pagada se conserva. Aviso a los apoderados de las anuladas. |
| CP-M4-21 | excepción | CP-M4-17 | Vencimiento de ayer. | — | `422 VENCIMIENTO_PASADO` «El vencimiento no puede ser anterior a hoy.» |

## Proceso de matrícula (fase 5)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M4-22 | básico | PC | Carmen abre «Proceso de matrícula» del 2027. | — | «Sin configurar» con la lista propuesta (partida, DNI, libreta, constancia de no adeudo opcional). |
| CP-M4-23 | básico | CP-M4-22 | Fija fechas y guarda. | 20/11/2026–28/02/2027 | «Se guardó el proceso de matrícula 2027.» Estado «Abierto». Auditoría `CONFIGURAR_PROCESO_MATRICULA`. |
| CP-M4-24 | excepción | CP-M4-22 | Fin antes del inicio. | — | «La fecha de fin no puede ser anterior al inicio». |
| CP-M4-25 | excepción | CP-M4-22 | Dos documentos con el mismo nombre. | «DNI» y «dni» | `409 DOCUMENTO_REPETIDO` «El documento «dni» está repetido.» |

## Matrícula en línea del apoderado (fase 6)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M4-26 | básico | CP-M4-23 | Lucía (sin hijos matriculados) entra a su portal. | — | «Matricular a mi hijo» lleva a «Matrícula» con el proceso 2027 y una tarjeta por hijo. |
| CP-M4-27 | básico | CP-M4-26 | «Matricular» a Mateo: confirma datos, 1.er grado, responsable Lucía, sube los PDF/JPG y envía. | Archivos de prueba | «Enviaste la matrícula de Mateo…». La tarjeta muestra «Documentos en revisión» y cada documento «En revisión». Carmen recibe «Nueva solicitud de matrícula». |
| CP-M4-28 | excepción | Proceso con inicio mañana | Abrir «Matrícula». | — | Sin botón «Matricular»: «La matrícula en línea empieza el [fecha].» |
| CP-M4-29 | excepción | Proceso cerrado ayer | Enviar por la API. | — | `422 MATRICULA_CERRADA` «La matrícula en línea terminó el [fecha]. Comunícate con la coordinación…». |
| CP-M4-30 | excepción | CP-M4-27 | Enviar otra vez. | — | `409 SOLICITUD_EXISTENTE`. Un hijo ya Matriculado: «Tu hijo ya está matriculado en 2027.» |
| CP-M4-31 | excepción | CP-M4-26 | Subir un .txt renombrado como .pdf, o un archivo de 6 MB. | — | «Cada documento debe ser un PDF o una imagen JPG de hasta 5 MB.» (en la pantalla y en el servidor). |

## Verificación de documentos (fase 7)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M4-32 | básico | CP-M4-27 | Carmen en «Solicitudes de matrícula» abre la de Mateo y un documento. | — | Se abre el PDF/JPG en otra pestaña. |
| CP-M4-33 | excepción | CP-M4-27 | Jorge pide el archivo por la API. | — | `403 ESTUDIANTE_NO_VINCULADO`. Sin sesión: 401. |
| CP-M4-34 | básico | CP-M4-27 | Observar la partida con motivo. | «No se lee» | Solicitud «Con observaciones». Lucía recibe el aviso y ve «Observación: No se lee» con «Reemplazar». Auditoría `REVISAR_DOCUMENTO_MATRICULA`. |
| CP-M4-35 | básico | CP-M4-34 | Lucía reemplaza la partida. | — | El documento vuelve a «En revisión»; Carmen recibe el aviso. |
| CP-M4-36 | excepción | CP-M4-34 | Asignar la sección antes de aprobar todo. | — | `422 DOCUMENTOS_PENDIENTES` con los nombres que faltan. |
| CP-M4-37 | básico | CP-M4-35 | Aprobar los obligatorios y «Confirmar matrícula» en 1° A. | Mensual | Mateo queda Matriculado con su cronograma (con la cuota de ingreso). La solicitud «Matriculado»; Lucía recibe «Matrícula confirmada». |
| CP-M4-38 | excepción | CP-M4-35 | Por la API, asignar una sección de 2.° grado. | — | `422 SECCION_OTRO_GRADO` «La sección debe ser de 1er grado, el grado de la solicitud.» |
