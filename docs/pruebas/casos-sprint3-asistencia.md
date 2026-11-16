# Casos de prueba · Sprint 3, bloque 5: asistencia de alumnos (US35, US36, US45, US52)

Pantallas DO-03 «Asistencia» del docente (`/docente/asistencia`), «Asistencia de alumnos» y M-20 del administrador (`/admin/asistencia`), AP-03 «Asistencia» del apoderado (`/apoderado/asistencia`) y AL-04 «Mi asistencia» del alumno (`/alumno/asistencia`). Pantallas: [frontend-asistencia.md](../frontend-asistencia.md). API: [horarios.md](../api/horarios.md#asistencia-de-alumnos-us35-us36-us45-us52).

Las reglas puras se prueban con Vitest en `tests/horarios/asistencia.test.ts` (plazo de 24 horas, estado del día, calendario, umbrales y aviso único). El registro, la corrección del docente y del administrador con auditoría, el aviso único y los permisos de cada endpoint se prueban en `tests/horarios/asistencia.integracion.test.ts`, que corre en el CI con PostgreSQL y fechas fijas.

**Precondición común (PC):** seed cargado (parámetros `PLAZO_CORRECCION_ASISTENCIA_H` = 24, `UMBRAL_FALTAS_MES` = 3, `UMBRAL_INASISTENCIA_AVISO` = 0.15 y `UMBRAL_INASISTENCIA` = 0.20) y año **2026** «En curso» con sus cuatro bimestres. Solo datos ficticios (RNF14):
- Sección **3° A** con horario **publicado**: Matemática los lunes y miércoles a las 09:15 con **Juan Pérez Salazar**; Inglés los lunes a las 07:45 con **Luis Campos Ruiz**. Ambos con cuenta.
- Siete estudiantes matriculados en 3° A, entre ellos **Diego Quispe Rojas** (con cuenta de alumno) y **Valeria Quispe Rojas**, cuya apoderada principal es **Carmen Rojas Medina** (con cuenta y correo). Un octavo estudiante con la matrícula **anulada** y otro **retirado**.
- Otra sección, **3° B**, con su propio docente y sus alumnos.

Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y muestra el mensaje).

## US35 · Toma de asistencia diaria

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US35-01 | US35 | básico | PC; lunes; sesión de Juan Pérez | 1. Menú «Asistencia». | — | «Clase de hoy» ofrece «Matemática · 3° A · 09:15». Debajo, «Asistencia · Matemática 3° A», la fecha de hoy, «09:15 – 10:00 · Aula 204 · 7 estudiantes» y la lista ordenada por apellido, todos «Sin marcar». No aparecen el estudiante anulado ni el retirado. La sesión queda creada (`sesion_clase`). |
| CP-US35-02 | US35 | básico | CP-US35-01 | 1. «Marcar todos como presentes». 2. Cambiar a Valeria a «Ausente» y a Diego a «Justificado» con la nota «Cita médica con constancia». 3. «Guardar asistencia». | — | Los contadores cambian al marcar (5 presentes · 1 ausente · 1 justificado · 0 sin marcar). Al guardar: «Asistencia guardada.», el pie dice «Puedes corregir este registro hasta el … a las …» (24 h después) y la clase figura «registrada». Cada registro guarda el estado, la observación, quién y cuándo. La columna «Faltas» de Valeria sube en 1. |
| CP-US35-03 | US35 | excepción | CP-US35-01 | 1. Marcar solo a cinco alumnos. 2. «Guardar asistencia». | — | Alerta roja «Existen alumnos sin estado de asistencia registrado» con «Falta marcar a: …» y los nombres; sus filas se resaltan en rojo. No se guarda nada (`422 ASISTENCIA_INCOMPLETA` con `details.faltantes`). Al marcarlos dejan de resaltarse. |
| CP-US35-04 | US35 | básico | CP-US35-02; sesión de Carmen Rojas | 1. Menú «Asistencia» del apoderado. 2. Abrir el mes actual. | — | Debajo, en «Inasistencias y tardanzas», la clase de Valeria aparece con su estado. La observación de un registro («Cita médica con constancia» en el caso de Diego) se ve en la asistencia de su apoderado. |
| CP-US35-05 | US35 | alterno | PC; sábado o domingo; sesión de Juan Pérez | 1. Menú «Asistencia». | — | Tarjeta «Hoy no hay clases: es fin de semana.» y «La asistencia se registra el mismo día de la clase…». No hay selector de clase. Los registros anteriores siguen visibles. |
| CP-US35-06 | US35 | alterno | PC; martes; sesión de Juan Pérez (no tiene clases los martes) | 1. Menú «Asistencia». | — | «No tienes clases programadas para hoy en el horario publicado.». |
| CP-US35-07 | US35 | excepción | Sesión de Juan Pérez | 1. `POST /horarios/asistencia/sesiones` con la clase de 3° A y `"fecha": "2099-03-02"`. 2. Con la fecha de ayer. | — | `422 FECHA_FUTURA` «No se puede registrar la asistencia de una fecha futura.» y `422 SOLO_DIA_ACTUAL` «Solo se puede registrar la asistencia del día actual.». No se crea la sesión. |
| CP-US35-08 | US35 | excepción | Sesión de Juan Pérez | 1. `POST /horarios/asistencia/sesiones` con la clase de Inglés de Luis Campos. 2. `GET` y `PUT` de una sesión de Luis Campos. | — | `403 CLASE_AJENA` «Esta clase no está a tu cargo: solo puedes registrar la asistencia de tus propias clases.» en los tres casos. |
| CP-US35-09 | US35 | excepción | CP-US35-01 | 1. `PUT …/registros` incluyendo un alumno de 3° B. | — | `422 ALUMNO_FUERA_DE_LA_CLASE`. No se guarda nada. |
| CP-US35-10 | US35 | excepción | Sin sesión; luego con sesión de Apoderado y de Alumno | 1. `GET /horarios/asistencia/clases-de-hoy`. 2. `POST /horarios/asistencia/sesiones`. 3. `PUT …/registros`. | — | Sin sesión: `401 NO_AUTENTICADO`. Con otro perfil: `403 ACCESO_DENEGADO` «No tiene permisos para acceder a este recurso.». |
| CP-US35-11 | US35 | alterno | Sesión de Juan Pérez en un celular (390 px) | 1. «Asistencia». 2. Marcar y guardar. | — | Cada alumno es una tarjeta con su nombre, la lista desplegable a todo el ancho, «Faltas · Tardanzas» y la nota. No hay desplazamiento horizontal. |

## US36 · Plazo de 24 horas para modificar la asistencia

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US36-01 | US36 | básico | CP-US35-02, menos de 24 h después | 1. Cambiar a Valeria de «Ausente» a «Tardanza». 2. «Guardar cambios». | — | «Asistencia guardada.». Bajo el nombre de Valeria: «Corregido el … · antes: Ausente». El registro guarda `modificado_por_id`, `modificado_en` y `estado_anterior = FALTA`. Los demás registros no cambian. El plazo sigue contando desde el registro original. |
| CP-US36-02 | US36 | excepción | CP-US35-02, más de 24 h después | 1. «Asistencia» → «Registros anteriores» → «Ver» la sesión. 2. `PUT …/registros` con otro estado. | — | Alerta «El plazo para modificar esta asistencia ha expirado (24 horas)» con «Si necesitas corregirla, solicítalo a la administración…»; listas y notas deshabilitadas, sin botón de guardar. La API responde `422 PLAZO_CORRECCION_VENCIDO` con ese mensaje. |
| CP-US36-03 | US36 | básico | CP-US36-02; sesión de Administrador | 1. «Asistencia de alumnos». 2. Elegir la fecha de la clase. 3. «Ver lista». 4. «Corregir» en Valeria. 5. Elegir «Justificado» y escribir el motivo. 6. «Guardar corrección». | Motivo: «La apoderada presentó el certificado médico fuera del plazo.» | Modal M-20 con el alumno, la sesión, el estado actual, quién y cuándo lo registró, y el aviso de auditoría. Al guardar: «Corrección guardada: la asistencia de … quedó registrada en la bitácora.»; la fila muestra «Justificado», la fecha, el administrador, «antes: …» y el motivo. Queda `CORREGIR_ASISTENCIA` en la bitácora con el estado anterior, el nuevo, `fueraDePlazo: true` y el motivo. |
| CP-US36-04 | US36 | excepción | CP-US36-03 abierto | 1. Dejar el motivo vacío o con 3 caracteres. 2. `POST …/corregir` sin motivo. | — | «Guardar corrección» no se habilita. La API responde `400 DATOS_INVALIDOS` («Indica el motivo de la corrección…»). |
| CP-US36-05 | US36 | excepción | CP-US36-03 | 1. `POST …/corregir` otra vez con el mismo estado. | — | `409 ASISTENCIA_SIN_CAMBIOS`. No se agrega otra fila a la bitácora. |
| CP-US36-06 | US36 | excepción | Sesión de Juan Pérez | 1. `POST /horarios/asistencia/registros/{id}/corregir`. | Motivo válido | `403 ACCESO_DENEGADO`: corregir fuera de plazo es solo del administrador. |
| CP-US36-07 | US36 | alterno | Sesión de Administrador | 1. «Asistencia de alumnos» con una fecha sin clases. | — | «No hay asistencia registrada en esta fecha» y qué hacer. |

## US45 · Asistencia del hijo (apoderado)

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US45-01 | US45 | básico | PC; asistencia registrada en noviembre; sesión de Carmen Rojas | 1. Menú «Asistencia». | — | «Asistencia · Resumen mensual de la asistencia de Valeria por día de clases.» Selector «noviembre de 2026» con flechas. Calendario de lunes a viernes con la insignia de cada día; resumen con días Presente, Tardanza, Ausente y Justificado y el porcentaje de asistencia; lista «Inasistencias y tardanzas» con las observaciones del docente. |
| CP-US45-02 | US45 | básico | Valeria faltó a Inglés y a Matemática el lunes 2; el martes 3 solo faltó a una de dos clases | 1. Ver noviembre. | — | El lunes 2 figura «Ausente» (fondo rojo claro) y en la lista «Ausente todo el día». El martes 3 figura «Presente» y en la lista aparece solo la clase a la que faltó, con su curso y hora. |
| CP-US45-03 | US45 | básico | Valeria acumula 3 días Ausente sin justificar en noviembre | 1. Ver noviembre. | — | Alerta «Atención: 3 inasistencias injustificadas este mes» con las fechas («faltó el 2, 4 y 9 de noviembre sin justificación»). |
| CP-US45-04 | US45 | alterno | CP-US45-03; el administrador justifica uno de esos días | 1. Volver a «Asistencia». | — | El día figura «Justificado» y la alerta del mes desaparece (2 faltas injustificadas, por debajo del umbral). |
| CP-US45-05 | US45 | excepción | Sesión de Carmen Rojas | 1. Elegir con las flechas un mes sin registros (por ejemplo, abril si aún no hubo clases registradas). | — | «No hay registros de asistencia disponibles para este periodo», en lugar de un calendario vacío. |
| CP-US45-06 | US45 | excepción | Sesión de Carmen Rojas | 1. `GET /horarios/apoderado/hijos/{id de un alumno de 3° B}/asistencia`. 2. `?mes=2026-13`. | — | `403 ESTUDIANTE_NO_VINCULADO` «No tienes acceso a la información de este estudiante.» y `400 DATOS_INVALIDOS` («Mes no válido…»). |
| CP-US45-07 | US45 | excepción | Sin sesión; luego con sesión de Docente | 1. `GET /horarios/apoderado/hijos/{id}/asistencia`. | — | `401 NO_AUTENTICADO` y `403 ACCESO_DENEGADO`. |
| CP-US45-08 | US45 | alterno | Sesión de Carmen Rojas en un celular (390 px) | 1. «Asistencia». | — | El calendario se reemplaza por la lista de días con estado; resumen e inasistencias debajo. Sin desplazamiento horizontal. |

## US52 · Mis inasistencias (alumno)

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US52-01 | US52 | básico | PC; Diego con faltas y tardanzas en el año; sesión de Diego | 1. Menú «Mi asistencia». | — | Cuatro indicadores: faltas y tardanzas del bimestre en curso («Bimestre IV») y del año («Desde el 02/03/2026»); «Nivel de riesgo» con el porcentaje del año, el umbral institucional (20 %), la barra y «Te quedan N faltas antes del umbral»; «Detalle del bimestre IV» con fecha, clase, tipo y detalle. |
| CP-US52-02 | US52 | básico | Diego llega al 15 % de inasistencias del año | 1. El docente registra la falta que lo lleva al 15 %. 2. Diego entra a «Mi asistencia». | — | Insignia «En aviso» y alerta «Te acercas al límite de inasistencias». Se envía **un** correo a Diego y otro a su apoderado principal («Kubo · Aviso por inasistencias») y queda la fila `PORCENTAJE_AVISO` del año en `aviso_asistencia`. |
| CP-US52-03 | US52 | básico | CP-US52-02; Diego sigue faltando y llega al 20 % | 1. Registrar la falta que lo lleva al 20 %. 2. «Mi asistencia». | — | Insignia «En riesgo» y alerta «Estás en riesgo por inasistencias» con «Acumulas el … % de inasistencias. Conversa con tu tutor…». Sale **un** correo de riesgo a Diego y a su apoderado; no se repite el de aviso. |
| CP-US52-04 | US52 | excepción | CP-US52-02 | 1. Registrar otra falta de Diego por encima del 15 % (sin llegar al 20 %). 2. Corregir otra falta a «Ausente». | — | No sale ningún correo nuevo: cada umbral se avisa **una sola vez** (`aviso_asistencia` no cambia). |
| CP-US52-05 | US52 | básico | Diego acumula su 3.ª falta injustificada de noviembre | 1. El docente guarda la lista con esa falta. 2. Diego entra a «Mi asistencia». | — | Alerta «Atención: 3 inasistencias injustificadas este mes». Sale un correo «Kubo · 3 inasistencias injustificadas en noviembre» a Diego y a su apoderado, una sola vez en el mes; en diciembre puede volver a avisarse. |
| CP-US52-06 | US52 | alterno | PC; un alumno sin faltas, tardanzas ni justificaciones en el año | 1. «Mi asistencia». | — | «¡Felicidades! No registras inasistencias este periodo» en lugar de los contadores en cero. |
| CP-US52-07 | US52 | alterno | El servidor de correo no responde | 1. Registrar la falta que alcanza un umbral. | — | La asistencia se guarda igual; el aviso queda registrado con `correos_enviados = 0`. El fallo no revierte ni bloquea el registro. |
| CP-US52-08 | US52 | excepción | Sin sesión; luego con sesión de Apoderado | 1. `GET /horarios/alumno/asistencia`. | — | `401 NO_AUTENTICADO` y `403 ACCESO_DENEGADO`. El alumno no envía identificadores: la respuesta siempre es la suya. |
| CP-US52-09 | US52 | excepción | Sesión de Diego; el administrador anula su matrícula | 1. «Mi asistencia». | — | «Tu portal aún no está disponible» y `403 SIN_MATRICULA_VIGENTE`. |
