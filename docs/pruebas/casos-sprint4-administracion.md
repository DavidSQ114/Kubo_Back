# Casos de prueba · Sprint 4, bloque 4: administración (US32, US56, D-12, D-13)

Pantallas AD-14 «Asistencia del personal docente» (`/admin/asistencia-docente`), AD-04 «Cursos y competencias», pestaña «Catálogo oficial» (`/admin/cursos`), el detalle de una persona en AD-06 (`/admin/usuarios`) y los inicios del apoderado (AP-01, `/apoderado`) y del alumno (AL-01, `/alumno`). Pantallas: [frontend-administracion.md](../frontend-administracion.md). API: [horarios.md](../api/horarios.md#asistencia-del-personal-docente-us32), [academico.md](../api/academico.md#catálogo-oficial-de-competencias-us56) y [comunidad.md](../api/comunidad.md#vínculos-de-una-persona-d-12-pantalla-ad-06).

Pruebas automáticas:

- `tests/horarios/asistenciaDocente.test.ts` (sin base): Puntual y Tardanza en los **límites exactos** (07:29:59, 07:30:00, 07:30:59 y 07:31:00), hora límite justo a las 08:00 y un segundo antes, minutos que faltan, hora de Lima, fecha pasada y futura, día no lectivo (sábado, vacaciones, sin año en curso), la falta automática que pasa a Tardanza, ingreso repetido o sobre una falta justificada, falta automática **idempotente**, salida y justificación.
- `tests/academico/competencias.test.ts` (sin base): código normalizado y rechazos, no eliminar con calificaciones o en un plan, cambios con el valor anterior y el nuevo, sin cambios y competencia desactivada en los planes.
- `tests/horarios/asistenciaDocente.integracion.test.ts` (PostgreSQL, en el CI): 401 y 403 en el listado, el ingreso y la justificación; 422 `SOLO_DIA_ACTUAL` por la API sin guardar nada; hora exacta con segundos; verificación automática antes y a la hora límite, dos veces y en sábado; la falta que pasa a Tardanza con auditoría; salida; justificación con motivo y auditoría; listado del día.
- `tests/academico/competencias.integracion.test.ts` (PostgreSQL, en el CI): 401 y 403; registro con código único y su asociación a un plan; **eliminación de una competencia con notas** (`409 COMPETENCIA_CON_CALIFICACIONES` por la API) y en un plan; desactivada que no se asocia a un plan nuevo y que el plan anterior conserva; auditoría de desactivar y editar con valor anterior y nuevo; eliminación de una sin uso.

**Precondición común (PC):** seed cargado (trae `HORA_INICIO_JORNADA_DOCENTE` = 07:30 y `HORA_LIMITE_ASISTENCIA_DOCENTE` = 08:00); año **2026** «En curso» con el bimestre de hoy; sesión de la administradora **Rosa Huamán Torres**. Docentes activos **Juan Pérez Salazar** (Matemática, primera clase 07:45 en el horario publicado), **Mónica Torres Aguilar** (Comunicación) y **Raúl Salas Ochoa** (Ciencia y Tecnología); **Patricia Ríos Lazo** desactivada. Apoderada **Carmen Quispe** (madre, principal y responsable del pago) con sus hijos **Diego Quispe Rojas** (1° A, Matriculado) y **Ana Quispe Rojas** (sin matrícula); **Luis Quispe** (padre) vinculado a Diego. Solo datos ficticios (RNF14).

Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y muestra el mensaje).

## US32 · Registro de ingreso de docentes (AD-14)

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US32-01 | US32 | básico | PC; hoy, antes de las 07:30 | 1. Menú «Asistencia docente». 2. Buscar «Pérez». 3. «Marcar “Asistió”». | — | Alerta «Ingreso de Juan Pérez Salazar registrado a las 07:2x (Puntual).»; la fila muestra la hora de ingreso, «Puntual» verde y «✓ Registrado 07:2x». El contador «Puntuales» sube. En `asistencia_docente` la hora tiene segundos; en `registro_auditoria`, `REGISTRAR_INGRESO_DOCENTE`. |
| CP-US32-02 | US32 | alterno | PC; hoy, a las 07:30:59 | Marcar «Asistió» a Mónica Torres. | — | «Puntual»: se compara al minuto, como se ve en pantalla. |
| CP-US32-03 | US32 | alterno | PC; hoy, a las 07:31:00 o después | Marcar «Asistió» a Raúl Salas. | — | «Tardanza» (celeste) con la hora real. |
| CP-US32-04 | US32 | excepción | CP-US32-01 | Por la API, `POST /horarios/asistencia-docente/ingreso` del mismo docente y día. | — | `409 INGRESO_YA_REGISTRADO` «El ingreso de este docente ya se registró a las 07:2x.»; en pantalla, la fila ya no ofrece el botón. |
| CP-US32-05 | US32 | excepción | PC | 1. Elegir la fecha de ayer en el calendario. 2. «Marcar “Asistió”» en un docente sin marcar. | Ayer | Alerta roja «Solo se puede registrar la asistencia del día actual» con «Se intentó registrar el dd/mm/aaaa…». No se guarda nada. Igual por la API con otra fecha (`422 SOLO_DIA_ACTUAL`), aunque el reloj del navegador esté cambiado: el servidor usa la fecha de Lima. |
| CP-US32-06 | US32 | básico | PC; nadie marcó a Raúl Salas; hora ≥ 08:00 de un día lectivo | Ejecutar `npm run tareas-programadas` (o esperar el timer de 15 minutos). Recargar AD-14. | — | Raúl aparece con «Inasistencia» (fila rosada) y «Verificación automática»; el contador «Faltas» sube. En la bitácora, `MARCAR_FALTA_DOCENTE` sin usuario. El log dice «Verificación de la asistencia docente terminada» con `marcadas`. |
| CP-US32-07 | US32 | alterno | CP-US32-06 | Ejecutar otra vez `npm run tareas-programadas`. | — | `marcadas: 0`: no se duplica ninguna falta (idempotente). |
| CP-US32-08 | US32 | alterno | PC; antes de las 08:00 | Ejecutar `npm run tareas-programadas`. | — | `omitida: "Aún no llega la hora límite (08:00)."`; nadie queda con falta. La tarjeta «Sin marcar» dice «Se marcarán como inasistencia a las 08:00» y «Hora actual», los minutos que faltan. |
| CP-US32-09 | US32 | alterno | Sábado o fecha fuera de los bimestres | Ejecutar `npm run tareas-programadas`; abrir AD-14. | — | `omitida` con «Es fin de semana…»; sin faltas. AD-14 muestra el aviso de día no lectivo y «Asistió» responde `422 DIA_NO_LECTIVO`. |
| CP-US32-10 | US32 | básico | CP-US32-06; Raúl llega a las 08:20 | «Marcar “Asistió”» en la fila de Raúl. | — | Pasa a «Tardanza» con 08:20; desaparece «Verificación automática». En la bitácora, `REEMPLAZAR_FALTA_DOCENTE` con el estado anterior FALTA, la hora real y el motivo «El docente llegó después de la hora límite». |
| CP-US32-11 | US32 | básico | CP-US32-01 | En la fila de Juan, «Salida». | — | «Hora de salida» con la hora actual; el botón desaparece. Auditoría `REGISTRAR_SALIDA_DOCENTE`. Por la API, otra vez: `409 SALIDA_YA_REGISTRADA`; sin ingreso: `422 SIN_INGRESO`. |
| CP-US32-12 | US32 | básico | Un docente con «Inasistencia» de cualquier fecha (también pasada) | 1. Elegir la fecha. 2. «Justificar». 3. Escribir el motivo. 4. «Guardar justificación». | «Presentó descanso médico por dos días» | Queda «Falta justificada» con el motivo bajo la insignia; «Faltas» cuenta «1 con justificación». Auditoría `JUSTIFICAR_FALTA_DOCENTE` con el motivo. |
| CP-US32-13 | US32 | excepción | CP-US32-12 | 1. «Justificar» con un motivo de 3 letras. 2. Por la API, justificar un registro Puntual. | «Doc» | El botón queda deshabilitado (mínimo 5 caracteres; por la API `400`). Justificar algo que no es inasistencia: `422 NO_ES_INASISTENCIA`. |
| CP-US32-14 | US32 | excepción | Sesión de docente | Abrir `/api/v1/horarios/asistencia-docente`; `POST …/ingreso`. Sin sesión, lo mismo. | — | `403 ACCESO_DENEGADO`; sin sesión, `401 NO_AUTENTICADO`. |
| CP-US32-15 | US32 | alterno | PC | Filtrar «Estado: Sin marcar» y buscar «tor». | — | Solo las filas que coinciden; «Mostrando n de 3 docentes». Patricia Ríos (desactivada) no aparece salvo en una fecha en que tenga registro (con «· Inactivo»). |

## US56 · Actualización del catálogo de competencias (AD-04, «Catálogo oficial»)

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US56-01 | US56 | básico | PC | 1. Menú «Cursos y competencias». 2. Pestaña «Catálogo oficial». 3. En «Registrar nueva competencia», área, código, nombre y descripción. 4. «Guardar». | Matemática, `mat-c5`, «Usa el pensamiento computacional» | Alerta «Competencia MAT-C5 registrada…»; aparece en la tarjeta de Matemática con «Sin planes de estudios». En «Malla curricular → Matemática → Competencias del curso» ya se puede marcar. Auditoría `REGISTRAR_COMPETENCIA`. |
| CP-US56-02 | US56 | excepción | CP-US56-01 | Registrar otra con el mismo código. | `MAT-C5` | «Ya existe una competencia registrada con ese código» (`409 COMPETENCIA_CODIGO_EN_USO`). |
| CP-US56-03 | US56 | excepción | PC | Registrar con un código con espacios. | `MAT C5` | `400 CODIGO_COMPETENCIA_INVALIDO` con el formato esperado. |
| CP-US56-04 | US56 | excepción | Competencia C1 de Matemática con notas registradas | «Eliminar» → «Eliminar». | — | En el modal, «No se puede eliminar una competencia con calificaciones registradas: solo puedes desactivarla.» y el botón «Desactivar en su lugar». La competencia sigue en el catálogo. |
| CP-US56-05 | US56 | excepción | MAT-C5 asociada a un plan, sin notas | «Eliminar» → «Eliminar». | — | «No se puede eliminar una competencia asociada a un plan de estudios: solo puedes desactivarla.» |
| CP-US56-06 | US56 | básico | CP-US56-04 | «Desactivar en su lugar» (o «Desactivar» en la fila). | — | Insignia «Desactivada» y nombre en gris; alerta «…ya no se asocia a cursos nuevos; los planes que la tienen la conservan.». Auditoría `DESACTIVAR_COMPETENCIA` con `activo: true → false`. |
| CP-US56-07 | US56 | alterno | CP-US56-06 | 1. En la malla, un curso de Matemática que no la tenía: marcarla. 2. En el curso que ya la tenía, «Guardar competencias». | — | 1: `422 COMPETENCIA_INACTIVA` «La competencia está desactivada en el catálogo oficial». 2: se guarda y la conserva. |
| CP-US56-08 | US56 | básico | PC | «Editar» una competencia; cambiar la descripción; «Guardar cambios». | Descripción nueva | Alerta «…actualizada. El cambio quedó en la bitácora.». En «Auditoría», `EDITAR_COMPETENCIA` con la descripción anterior y la nueva. Guardar sin cambios: «No hay cambios que guardar en la competencia.». |
| CP-US56-09 | US56 | alterno | Competencia recién creada, sin uso | «Eliminar» → «Eliminar». | — | Desaparece del catálogo; auditoría `ELIMINAR_COMPETENCIA`. |
| CP-US56-10 | US56 | excepción | Sesión de docente | `GET` y `POST /api/v1/academico/competencias`. | — | `403`; sin sesión, `401`. |

## D-12 · Vínculos en el detalle de una persona (AD-06)

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-D12-01 | D-12 | básico | PC | 1. «Usuarios». 2. Buscar a Diego y «Ver detalle». | — | Sección «Apoderados» con «Carmen Quispe · Madre · Principal · Responsable del pago» y «Luis Quispe · Padre». |
| CP-D12-02 | D-12 | básico | PC | Ver el detalle de Carmen Quispe. | — | Sección «Hijos (estudiantes vinculados)»: «Diego Quispe Rojas — 1° A · Matriculado (2026)» y «Ana Quispe Rojas — Sin matrícula». |
| CP-D12-03 | D-12 | alterno | CP-D12-02 | Clic en el nombre de Diego. | — | El modal pasa al detalle de Diego (sus datos, apoderados e historial) sin cerrar ni volver a buscar. |
| CP-D12-04 | D-12 | alterno | Una persona sin vínculos (un docente) | Ver su detalle. | — | No aparece la sección de vínculos. |
| CP-D12-05 | D-12 | excepción | — | `GET /api/v1/comunidad/personas/{id}/vinculos` con un id inexistente; con sesión de apoderado. | — | `404 NO_ENCONTRADO`; `403` con otro perfil. |

## D-13 · Inicio del apoderado y «Próximamente» (AP-01, AL-01)

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-D13-01 | D-13 | básico | Apoderada con un hijo | Abrir el Inicio. | — | Ya no está la tarjeta «Próximamente»: hay una tarjeta «Notas · Ver la libreta de …» que lleva a `/apoderado/notas`. |
| CP-D13-02 | D-13 | básico | Hijo con una pensión vencida; pago en línea activo (`PASARELA`) | Abrir el Inicio. | — | El aviso rojo dice «…Puedes pagar en línea con «Pagar» o regularizarlo en tesorería.» y su botón es «Pagar», que lleva a Pagos. |
| CP-D13-03 | D-13 | alterno | Igual, sin pasarela configurada | Abrir el Inicio. | — | El aviso conserva «Regulariza el pago en tesorería o por transferencia.» y el botón «Ver mis pagos». |
| CP-D13-04 | D-13 | básico | Sesión de alumno | Abrir el Inicio del alumno. | — | «Mis notas» tiene «Ver notas» y lleva a `/alumno/notas`; «Notificaciones» explica que se abren con la campana. Ninguna tarjeta dice «Próximamente». |
| CP-D13-05 | D-13 | alterno | Cada portal | Revisar los menús de administrador, docente, apoderado y alumno. | — | Ningún módulo que ya funciona aparece como «Próximamente» o deshabilitado; «Asistencia docente» del administrador ya abre AD-14. |
