# Casos de prueba · Sprint 2, bloque 4: traslado de sección (US19), retiro del estudiante (US57) y ficha de matrícula en PDF (US20)

Las tres acciones están en el detalle de una matrícula «Matriculado» de AD-10 «Matrícula» (`/admin/matricula`): los modales M-05 «Traslado de sección» y M-18 «Retirar estudiante», y el botón «Generar ficha PDF». API: [matricula.md](../api/matricula.md); ejemplos en [matricula.http](../api/matricula.http).
Las reglas puras se prueban además con Vitest (sección «Casos unitarios»).

**Precondición común (PC):** sesión iniciada como Administrador (`admin@kubo.edu.pe`) con la contraseña ya cambiada. Seed cargado. Año 2026 «En curso» (02/03/2026 al 18/12/2026) con montos S/ 350.00 y S/ 450.00. Secciones de 3° de secundaria A (aforo 30), B (aforo 30) y C (aforo 1, ocupada), y 4° A. La apoderada ficticia Carmen Rojas Medina es la principal y responsable del pago de los estudiantes ficticios Valeria, Diego y Sofía Quispe Rojas, matriculados el 06/11/2026: Valeria y Diego en 3° B y Sofía en 3° C. Mateo Quispe Rojas tiene una matrícula «En proceso». Hoy: 06/11/2026. Solo datos ficticios (RNF14).
Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y muestra el mensaje).

## US19 · Traslado de sección

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US19-01 | US19 | básico | PC | 1. «Ver» la matrícula de Valeria. 2. «Trasladar». 3. Elegir 3° A. 4. Escribir el motivo. 5. «Trasladar». | Motivo «Reorganización de secciones» | Aviso «Se trasladó a Valeria Quispe Rojas a 3° A.». En el detalle, la sección es 3° A y el «Historial de secciones» muestra 3° B hasta el 06/11/2026 y 3° A desde el 06/11/2026 con el motivo. 3° A suma una matrícula y 3° B libera una vacante. Auditoría `TRASLADAR_SECCION` con las secciones antes y después. |
| CP-US19-02 | US19 | excepción | PC | 1. Trasladar a Valeria por la API a 4° A. | `seccionDestinoId` de 4° A | `422 TRASLADO_OTRO_GRADO` «Solo se permite el traslado entre secciones del mismo grado». En M-05 solo se listan las secciones de su grado. |
| CP-US19-03 | US19 | excepción | PC | 1. En M-05, revisar la tarjeta de 3° C. 2. Trasladar por la API a 3° C. | — | La tarjeta muestra «Sin vacantes» con candado y no se puede elegir. API: `409 DESTINO_SIN_VACANTES` «La sección destino no tiene vacantes disponibles» con `details { matriculados: 1, aforo: 1 }`. |
| CP-US19-04 | US19 | excepción | Sección con una sola vacante; dos matriculados en otra sección del grado | 1. Enviar al mismo tiempo los dos traslados a esa sección. | Prueba de integración | Solo uno se acepta; el otro recibe «La sección destino no tiene vacantes disponibles» y conserva su sección y su historial (`tests/matricula/traslado.integracion.test.ts`). |
| CP-US19-05 | US19 | excepción | PC | 1. Trasladar por la API a la misma sección. | 3° B | `422 MISMA_SECCION`. |
| CP-US19-06 | US19 | excepción | PC | 1. Trasladar sin sección de destino. | — | `400 DATOS_INVALIDOS` «Elige la sección de destino» (en M-05, el mismo texto bajo las tarjetas). |
| CP-US19-07 | US19 | excepción | PC | 1. Trasladar con fecha posterior al fin del año. | 19/12/2026 | `422 FECHA_TRASLADO_INVALIDA` «La fecha del traslado no puede ser posterior al fin del año académico.». |
| CP-US19-08 | US19 | excepción | CP-US57-01 | 1. Trasladar a Diego (Retirado) por la API. | — | `409 MATRICULA_NO_TRASLADABLE`. En el detalle ya no aparece «Trasladar». |
| CP-US19-09 | US19 | básico | CP-US19-01 | 1. Consultar la sección de Valeria en una fecha (`seccionDeMatriculaEnFecha`). | 05/11/2026 · 06/11/2026 | 05/11 → 3° B; 06/11 → 3° A: el día del traslado ya cuenta en la sección destino. Lo usarán asistencia y notas. |

## US57 · Retiro de estudiante

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US57-01 | US57 | básico | PC | 1. «Ver» la matrícula de Diego. 2. «Registrar retiro». 3. Dejar la fecha de hoy. 4. Elegir «Motivos económicos» y escribir el detalle. 5. «Registrar retiro». | Detalle «La familia se muda a Arequipa» | Aviso «Se registró el retiro de Diego Quispe Rojas.». El detalle muestra «Retirado el 06/11/2026 · Motivos económicos». 3° B libera la vacante. La pensión de diciembre (vence 05/12) pasa a «Anulado» y la cuota de matrícula (vence 06/11) se conserva. Auditoría `RETIRAR_ESTUDIANTE` con las cuotas anuladas. |
| CP-US57-02 | US57 | excepción | PC | 1. En M-18, «Registrar retiro» sin elegir el motivo. 2. Retirar por la API sin motivo. | — | «Seleccione el motivo del retiro» bajo el selector. API: `422 MOTIVO_RETIRO_REQUERIDO` con el mismo mensaje. |
| CP-US57-03 | US57 | alterno | PC | 1. Registrar el retiro sin detalle. | Motivo «Otro motivo» | Se registra: el detalle es opcional. |
| CP-US57-04 | US57 | excepción | PC | 1. Retirar con una fecha anterior a la matrícula. | 01/11/2026 | `422 FECHA_RETIRO_INVALIDA` «La fecha de retiro no puede ser anterior a la fecha de matrícula.». |
| CP-US57-05 | US57 | excepción | PC | 1. Retirar con una fecha posterior al fin del año. | 19/12/2026 | `422 FECHA_RETIRO_INVALIDA` «La fecha de retiro no puede ser posterior al fin del año académico.». |
| CP-US57-06 | US57 | alterno | Sofía con la pensión de diciembre pagada | 1. Retirar a Sofía con fecha 20/11/2026. | Motivos de salud | Se conservan la cuota de matrícula y la pensión pagada; no se anula ninguna cuota (`cuotasAnuladas: []`). 3° C libera su única vacante. |
| CP-US57-07 | US57 | excepción | CP-US57-01 | 1. Registrar otra vez el retiro de Diego por la API. | — | `409 MATRICULA_NO_RETIRABLE` «Solo se registra el retiro de una matrícula «Matriculado». Esta está «Retirado».». En el detalle ya no aparecen «Registrar retiro» ni «Trasladar». |
| CP-US57-08 | US57 | básico | PC | 1. En M-18, cambiar la fecha de retiro. | 04/10/2026 → 06/11/2026 | La tabla «Efecto en el cronograma de cobros» se actualiza: «Se anula» para cada pensión pendiente que vence después de la fecha y «Se conservan» con el total del resto. |
| CP-US57-09 | US57 | básico | CP-US57-01 | 1. Revisar la auditoría, los logs y el historial. | — | `RETIRAR_ESTUDIANTE` guarda el estado anterior, la fecha, el motivo y las cuotas anuladas. El historial de secciones de Diego queda cerrado el 06/11/2026. Ningún DNI en la auditoría ni en `logs/`. |

## US20 · Ficha de matrícula en PDF

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US20-01 | US20 | básico | PC | 1. «Ver» la matrícula de Valeria. 2. «Generar ficha PDF». | — | Se descarga `ficha-matricula-2026-<id>.pdf` (`application/pdf`). Contiene los datos del estudiante (con DNI), los apoderados con parentesco, Principal y «Responsable del pago», año, grado, sección, aula, tutor, fecha de matrícula, modalidad, estado y la fecha de generación. Tildes y ñ se ven bien. Auditoría `GENERAR_FICHA_MATRICULA` sin el contenido. |
| CP-US20-02 | US20 | excepción | Valeria sin fecha de nacimiento | 1. «Generar ficha PDF». | — | Alerta «No se puede generar la ficha: existen datos obligatorios pendientes» y no se descarga nada. API: `422 FICHA_DATOS_PENDIENTES` con `details.pendientes: ["Fecha de nacimiento"]`. |
| CP-US20-03 | US20 | excepción | Mateo «En proceso» | 1. Generar la ficha por la API. | — | `422 FICHA_DATOS_PENDIENTES` con «Sección» y «Apoderado responsable del pago» pendientes. En el detalle no aparece el botón. |
| CP-US20-04 | US20 | alterno | CP-US57-01 | 1. Generar la ficha de Diego (Retirado). | — | Se descarga como constancia: «Constancia de matrícula · estudiante retirado», con la fecha y el motivo del retiro. |
| CP-US20-05 | US20 | básico | CP-US20-01 | 1. Cambiar el teléfono de Carmen. 2. Generar la ficha otra vez. | — | La ficha muestra el dato nuevo y la cantidad de matrículas no cambia: no se crean registros. |
| CP-US20-06 | US20 | excepción | Matrícula «Anulado» | 1. Generar la ficha por la API. | — | `409 FICHA_NO_DISPONIBLE`. |
| CP-US20-07 | US20 | excepción | Falla al generar el PDF | 1. Provocar un error en `generarPdf`. | Prueba unitaria | `500 ERROR_INTERNO`; `log_error` guarda «No se pudo generar el PDF «ficha-matricula» (TypeError)», sin datos personales. |

## Casos unitarios (Vitest)

Se ejecutan con `npm test`. No usan la base de datos y emplean fechas fijas. Las pruebas de integración se ejecutan aparte (CU-US19-06 y CU-US18-10).

| ID | Archivo | Qué verifica | Resultado esperado |
|---|---|---|---|
| CU-US19-01 | `tests/matricula/cambios.test.ts` | Mismo grado y año | 3° B → 3° A válido; 4° A u otro año → `TRASLADO_OTRO_GRADO` con el mensaje del Backlog |
| CU-US19-02 | ídem | Misma sección o inactiva | `MISMA_SECCION` · `SECCION_INACTIVA` |
| CU-US19-03 | ídem | Vacantes del destino | 29/30 → válido; 30/30 → `DESTINO_SIN_VACANTES` «La sección destino no tiene vacantes disponibles» |
| CU-US19-04 | ídem | Estado y fecha | Solo Matriculado; fecha entre el ingreso a la sección actual y el fin del año |
| CU-US19-05 | ídem | Sección en una fecha | Antes del traslado → origen; desde el día del traslado → destino; antes de matricularse o desde el retiro → ninguna |
| CU-US19-06 | `tests/matricula/traslado.integracion.test.ts` | Dos traslados simultáneos a la última vacante (base temporal) | Uno aceptado, otro `DESTINO_SIN_VACANTES`; dos tramos en el historial del trasladado. Con `KUBO_PRUEBA_INTEGRACION=1` y `DATABASE_URL` de una base temporal |
| CU-US57-01 | `tests/matricula/cambios.test.ts` | Motivo | Sin motivo → `MOTIVO_RETIRO_REQUERIDO` «Seleccione el motivo del retiro»; detalle opcional |
| CU-US57-02 | ídem | Fechas del retiro | Desde la matrícula (y desde el último traslado) hasta el fin del año |
| CU-US57-03 | ídem | Qué cuotas se anulan | Solo Pendiente, sin pagos y con vencimiento posterior al retiro; la que vence ese mismo día se conserva |
| CU-US57-04 | ídem | Estados y `retirado_en` | Retirado o Anulado → `MATRICULA_NO_RETIRABLE`; `retirado_en` = medianoche de Lima |
| CU-US20-01 | ídem | Datos obligatorios de la ficha | Completa → válida; sin fecha de nacimiento, responsable o apoderados → `FICHA_DATOS_PENDIENTES` con la lista |
| CU-US20-02 | ídem | Estados de la ficha | Matriculado y Retirado → válida; En proceso → `FICHA_DATOS_PENDIENTES`; Anulado → `FICHA_NO_DISPONIBLE` |
| CU-US20-03 | `tests/platform/pdf.test.ts` | Servicio de PDF | Conserva tildes, ñ, ° y «»; genera un PDF válido de varias páginas; si falla, el error no contiene los datos |
| CU-US19-07 | `tests/matricula/cambios.test.ts` | Esquemas | Traslado sin destino o con fecha inexistente → inválido; retiro sin motivo aceptado por el esquema |
| CU-US18-10 | `tests/matricula/anulacion.integracion.test.ts` | Anular un borrador «En proceso» sin sección (base temporal) | Queda «Anulado» (corrige el CHECK con la migración `20261106120000_anular_matricula_en_proceso`) |
