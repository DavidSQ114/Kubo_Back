# Casos de prueba · Sprint 4, bloque M3: portal del tutor

«Mi tutoría» del docente (`/docente/tutoria`), «Grados y secciones» del coordinador (AD-03), AP-03 «Justificar
inasistencias», AP-04 y AL-03 con la conducta. API: [horarios.md](../api/horarios.md#tutoría-de-sección-bloque-m3),
[evaluacion.md](../api/evaluacion.md#tutoría-conducta-y-notas-de-la-sección-bloque-m3) y
[academico.md](../api/academico.md#tutor-y-cotutor-bloque-m3). Pantallas: [frontend-tutoria.md](../frontend-tutoria.md).

Pruebas automáticas:

- `tests/academico/secciones.test.ts` (sin base): tutor y cotutor distintos, cotutor sin tutor, una tutoría por docente
  y año, `rolDeTutoria`.
- `tests/horarios/tutoria.test.ts` (sin base): bimestre en curso y fechas válidas, alumnos con aviso solo con faltas sin
  justificar, justificación de faltas y tardanzas, reporte (conteo, porcentaje, totales y orden), plazo de 7 días del
  apoderado y revisión de una justificación pendiente.
- `tests/horarios/asistencia.test.ts`: el día con una tardanza justificada es «Presente»; el resumen de la sesión
  cuenta las tardanzas justificadas.
- `tests/evaluacion/conducta.test.ts` (sin base): periodo finalizado, alumnos de la sección, cambios de la conducta,
  visibilidad en la libreta y resumen.
- `tests/horarios/tutoria.integracion.test.ts` (PostgreSQL, en el CI; año 2076, DNI 900025xx): asignación de tutor y
  cotutor con auditoría y el trigger; docente que no es tutor y tutor de otra sección reciben 403; registro de una clase
  ajena; modificación con motivo; fuera del bimestre; justificadas fuera del umbral; reporte con CSV y PDF; conducta
  con auditoría, en la libreta solo al publicar y bloqueada con el periodo finalizado; notas por alumno y consolidado;
  justificación del apoderado con aprobación y rechazo.

**Precondición común (PC):** año **2026** «En curso» con el Bimestre IV activo (hoy dentro de él) y el horario de
3° A publicado. Docente **Rosa Docente Demo** es tutora de 3° A; **Hugo Docente Demo** dicta Matemática en 3° A y no es
tutor; **Inés Docente Demo** es tutora de 3° B. Seis alumnos en 3° A con su apoderada **Lucía**; coordinadora
**Carmen**. Solo datos ficticios (RNF14).

Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y
muestra el mensaje).

## Tutor y cotutor (fase 1)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M3-01 | básico | PC | Carmen en AD-03 edita 3° A, elige tutor y cotutor y guarda. | Tutor Rosa, cotutor Hugo | «Se actualizó la sección 3° A.» La tabla muestra a Rosa y «Cotutor: H. Docente». Auditoría `EDITAR_SECCION` con `tutorId` y `cotutorId`. |
| CP-M3-02 | excepción | CP-M3-01 | Por la API, `PATCH` de 3° A con el mismo docente como tutor y cotutor. | Rosa y Rosa | `422 TUTOR_IGUAL_COTUTOR` «El tutor y el cotutor no pueden ser el mismo docente.» En AD-03 el cotutor no ofrece al docente elegido como tutor. |
| CP-M3-03 | excepción | CP-M3-01 | Editar 3° B y elegir a Hugo (cotutor de 3° A) como tutor. | — | `409 DOCENTE_YA_ES_TUTOR` «El docente elegido como tutor ya es tutor o cotutor de 3° A este año. Un docente tiene una sola tutoría por año.» bajo el campo. |
| CP-M3-04 | excepción | Sección sin tutor | Elegir solo un cotutor. | — | En AD-03 el cotutor está deshabilitado («Elige primero al tutor»); por la API, `422 COTUTOR_SIN_TUTOR`. |

## Acceso y portal (fase 2)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M3-05 | básico | CP-M3-01 | Rosa entra al portal docente. | — | El menú muestra «Mi tutoría». Inicio con «Mi tutoría · 3° A», «Tutor de la sección», alumnos, clases de hoy registradas, faltas de hoy y alumnos con aviso. |
| CP-M3-06 | alterno | CP-M3-01 | Hugo (cotutor) entra a «Mi tutoría». | — | Ve lo mismo que la tutora, con «Cotutor de la sección». |
| CP-M3-07 | excepción | PC | Un docente sin tutoría entra al portal y luego a `/docente/tutoria` por URL. | — | No ve «Mi tutoría»; por URL: «No tienes una tutoría este año». Por la API, `GET /horarios/tutoria/{3° A}/inicio` responde `403 NO_ES_TUTOR`. |
| CP-M3-08 | excepción | PC | Inés (tutora de 3° B) pide el inicio, la asistencia, el reporte o la conducta de 3° A por la API. | — | `403 NO_ES_TUTOR` «No eres tutor ni cotutor de esta sección del año en curso.» en todas las rutas. |
| CP-M3-09 | alterno | Una falta sin justificar hoy y `UMBRAL_FALTAS_MES` alcanzado | Ver el inicio. | — | El alumno aparece en «Faltas de hoy» (con la clase) y en «Alumnos con aviso por umbral» con «Alerta del mes», «Aviso» o «Riesgo». |

## Asistencia del tutor (fase 3)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M3-10 | básico | PC; clase de Hugo hoy sin registrar | Rosa → Asistencia → hoy → «Registrar» en la clase de Hugo → marcar a todos → «Guardar asistencia». | 1 ausente, 1 tardanza | «Asistencia guardada.» La sesión sigue a nombre de Hugo (la ve en su «Asistencia»); los registros tienen a Rosa como quien registró. Auditoría `REGISTRAR_ASISTENCIA_TUTORIA`. |
| CP-M3-11 | alterno | CP-M3-10, hace más de 24 horas | Rosa abre la clase y cambia la tardanza a «Presente». | — | Aparece «Motivo de la modificación» y «Guardar cambios» se activa con 5 caracteres. Guardado: «Corregido el … · antes: Tardanza · por R. Docente». Auditoría `CORREGIR_ASISTENCIA` con `por: "TUTOR"`. |
| CP-M3-12 | excepción | CP-M3-10 | Por la API, el PUT de la lista cambia un registro sin motivo. | `motivo: null` | `400 MOTIVO_REQUERIDO`. Nada cambia. |
| CP-M3-13 | excepción | PC | Elegir una fecha del bimestre anterior (por la API) o una fecha futura. | — | `422 FUERA_DEL_BIMESTRE_EN_CURSO` / `422 FECHA_FUTURA`. En la pantalla, el selector de fecha no permite salir del bimestre en curso ni pasar de hoy. |
| CP-M3-14 | básico | Una falta guardada | «Justificar falta» → motivo → «Justificar». | «Constancia médica» | «Se justificó el registro de …». El estado queda «Justificado». Auditoría `JUSTIFICAR_ASISTENCIA`. |
| CP-M3-15 | básico | Una tardanza guardada | «Justificar tardanza». | — | Queda «Tardanza justificada»; el contador «tardanzas justificadas» sube. En AP-03 la clase aparece como «Justificado». |
| CP-M3-16 | excepción | CP-M3-14 | Por la API, justificar de nuevo el mismo registro. | — | `409 YA_JUSTIFICADO` «Este registro ya está justificado.» |
| CP-M3-17 | básico | Alumno con aviso del mes por 1 falta | Justificar esa falta y volver al inicio. | — | El alumno ya no está en «Alumnos con aviso por umbral»: solo cuentan las faltas sin justificar. |
| CP-M3-18 | excepción | Registro de 3° B | Por la API, `…/tutoria/{3° A}/registros/{registro de 3° B}/justificar`. | — | `403 REGISTRO_DE_OTRA_SECCION`. Abrir una clase de 3° B desde 3° A: `403 CLASE_DE_OTRA_SECCION`. |

## Reporte de faltas y tardanzas (fase 4)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M3-19 | básico | Registros del bimestre | «Reporte de faltas». | — | Por alumno: clases, asistencias, tardanzas, tardanzas justificadas, faltas, faltas justificadas y % de asistencia; fila «Total de la sección». Ordenado por faltas de más a menos. |
| CP-M3-20 | alterno | CP-M3-19 | Pulsar «%» dos veces y «Estudiante». | — | Ordena por porcentaje (↓ y luego ↑) y por apellido (A–Z); `aria-sort` cambia. |
| CP-M3-21 | básico | CP-M3-19 | «CSV» y «PDF». | — | `Asistencia_3A_BimestreIV_2026.csv` (tildes correctas en Excel) y el PDF con la tabla, los totales y cómo se calcula el porcentaje. |

## Nota de conducta (fase 5)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M3-22 | básico | PC | «Conducta» → valor y comentario a varios alumnos → «Guardar conducta». | AD «Ayuda a sus compañeros», B | «Conducta guardada: 2 registradas y 0 modificadas.» El resumen se actualiza. Auditoría `REGISTRAR_NOTA_CONDUCTA`. |
| CP-M3-23 | alterno | CP-M3-22 | Cambiar AD → A y guardar. | — | «… 0 registradas y 1 modificadas.» Auditoría `MODIFICAR_NOTA_CONDUCTA` con el valor anterior. |
| CP-M3-24 | excepción | Periodo FINALIZADO | Elegir ese bimestre. | — | Aviso «El bimestre está finalizado: su nota de conducta ya no se registra ni se modifica.» y solo lectura. Por la API, `409 PERIODO_FINALIZADO` (también si se escribe directo en la base, por el trigger). |
| CP-M3-25 | básico | CP-M3-22; todos los cursos del bimestre publicados | Lucía abre AP-04 y descarga el PDF; el alumno abre AL-03. | — | Tarjeta «Conducta» con el valor y el comentario; el PDF tiene el bloque «Conducta». Con algún curso sin publicar, no aparece. |

## Notas de la tutoría (fase 6)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M3-26 | básico | Registros cerrados y publicados | «Notas por alumno» → elegir un alumno. | — | Libreta del año con pestañas por bimestre, la conducta del bimestre y cada curso con «Publicado» o «Sin publicar · cerrado / en registro / sin notas». |
| CP-M3-27 | excepción | — | Por la API, las notas de un alumno de 3° B desde 3° A. | — | `403 ALUMNO_DE_OTRA_SECCION`. |
| CP-M3-28 | básico | CP-M3-26 | «Consolidado» → bimestre → «CSV». | — | Matriz alumnos × cursos con el consolidado (los cursos no publicados con «Sin publicar»), la conducta y al pie cuántos AD, A, B, C y sin consolidado por curso. CSV `Consolidado_3A_BimestreIV_2026.csv`. |

## Justificación del apoderado (fase 7)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M3-29 | básico | Una falta sin justificar de hace 2 días | Lucía en AP-03 → «Justificar» → motivo y PDF → «Enviar justificación». | PDF de 200 KB | «Justificación enviada: el tutor de la sección la revisará.» Pasa a «Justificaciones enviadas» como «Pendiente de revisión». Auditoría `ENVIAR_JUSTIFICACION`. |
| CP-M3-30 | excepción | CP-M3-29 | Volver a justificar el mismo registro por la API. | — | `409 JUSTIFICACION_PENDIENTE`. En AP-03 ese registro ya no aparece para justificar. |
| CP-M3-31 | excepción | Falta de hace 9 días | Por la API, enviar la justificación. | — | `422 JUSTIFICACION_FUERA_DE_PLAZO` «Solo puedes justificar faltas y tardanzas de los últimos 7 días.» En AP-03 no aparece. |
| CP-M3-32 | excepción | — | Adjuntar un .docx o un PDF de 6 MB. | — | «El archivo debe ser un PDF o una imagen JPG de hasta 5 MB.» (en el navegador y en el servidor). |
| CP-M3-33 | básico | CP-M3-29 | Rosa → «Justificaciones» → «Ver archivo adjunto» → «Aprobar». | — | El PDF se abre en otra pestaña. «Se aprobó la justificación…»: el registro queda «Justificado» y Lucía recibe la notificación «Justificación aprobada». |
| CP-M3-34 | alterno | Otra justificación pendiente | «Rechazar» → motivo. | «La constancia es de otra fecha» | El registro no cambia; Lucía ve «Rechazada» con el motivo y recibe la notificación. Auditoría `RECHAZAR_JUSTIFICACION`. |
