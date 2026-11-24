# API · Horarios: cuadrícula por sección, asignación de clases, cruces, publicación (US27–US31), horario en los portales (US34, US48, US50), asistencia de alumnos (US35, US36, US45, US52) y asistencia docente (US32)

Base: `/api/v1` · Formato: JSON · Éxito `{ "data": … }` · Error `{ "error": { "code", "message", "details" } }`
El `message` de los errores ya está redactado para mostrarse al usuario (RNF09). Pantalla: AD-13 (`/admin/horarios`) y modal M-06; ver [frontend-horarios.md](../frontend-horarios.md). Casos de prueba en [pruebas/casos-sprint3-horarios.md](../pruebas/casos-sprint3-horarios.md) y ejemplos en [horarios.http](horarios.http). El horario en los portales del docente, del apoderado y del alumno (DO-02, AP-05, AL-02) está en [frontend-portales-horario.md](../frontend-portales-horario.md), con sus casos en [pruebas/casos-sprint3-portales-horario.md](../pruebas/casos-sprint3-portales-horario.md).

La sesión, las cookies y qué hacer ante un `401` o un `403` están en [identidad.md](identidad.md).

## Modelo

- **Bloques horarios del año** (`bloque_horario`): catálogo con `orden`, `horaInicio`, `horaFin` (texto `HH:MM`), `tipo` (`CLASE` o `RECREO`) y `etiqueta`. El catálogo de un año se crea solo, la primera vez que se abre una cuadrícula de ese año, con la jornada del parámetro `BLOQUES_HORARIO` (lo cargan la migración `jornada_por_defecto` y el seed: secundaria de lunes a viernes, 7 bloques de 45 minutos de 07:45 a 13:20 y un recreo de 10:00 a 10:20). Para una jornada distinta en un año, basta registrar el parámetro con ese `anio_academico_id` antes de abrir sus horarios. Editar el catálogo desde la aplicación no es parte de este sprint.
- **Horario** (`horario`): una versión del horario de una sección, con `version` (1, 2, 3…) y estado `BORRADOR`, `PUBLICADO` o `ARCHIVADO`. Por sección hay a lo más un borrador y una versión publicada (índices `uq_horario_borrador_por_seccion` y `uq_horario_publicado_por_seccion`).
- **Clase** (`detalle_horario`): día, bloque, aula y la asignación docente (curso + docente + sección) que la respalda. Una clase por día y bloque en cada versión.

## Endpoints

| Método y ruta | Rol | Cuerpo | Respuesta `data` |
|---|---|---|---|
| `GET /horarios/secciones/{id}?version=` | Administrador | — | `Cuadricula` de la versión vigente (el borrador en edición o, si no hay, la publicada) o de la versión pedida |
| `GET /horarios/secciones/{id}/ocupacion?dia=&bloqueId=` | Administrador | — | `Ocupacion`: docentes y aulas que **otras** secciones ocupan en ese día y bloque |
| `PUT /horarios/secciones/{id}/clases/{dia}/{bloqueId}` | Administrador | `{ cursoId, docenteId, aulaId }` | `Cuadricula` con la clase asignada o cambiada |
| `DELETE /horarios/secciones/{id}/clases/{dia}/{bloqueId}` | Administrador | — | `Cuadricula` con el bloque vacío |
| `POST /horarios/secciones/{id}/borrador` | Administrador | — | `201 Cuadricula` del borrador (nuevo o el que ya existía) |
| `POST /horarios/secciones/{id}/publicar` | Administrador | — | `Cuadricula` publicada + `aviso: { docentes, enviados }` |
| `GET /horarios/secciones/{id}/publicado` | Administrador | — | `HorarioDeSeccion`: solo la versión publicada |
| `GET /horarios/docentes/{id}/publicado?anioId=` | Administrador | — | `HorarioDeDocente` |
| `GET /horarios/mi-horario?anioId=` | Docente | — | `HorarioDeDocente` del docente en sesión (US34) |
| `GET /horarios/apoderado/hijos/{id}/horario` | Apoderado | — | `HorarioDeEstudiante` del hijo, si está vinculado (US48) |
| `GET /horarios/alumno/horario` | Alumno | — | `HorarioDeEstudiante` del alumno en sesión (US50) |
| `GET /horarios/apoderado/hijos/{id}/horario/pdf` | Apoderado | — | PDF del horario publicado vigente del hijo (US66) |

`{dia}` es `LUNES`, `MARTES`, `MIERCOLES`, `JUEVES` o `VIERNES`.

- `Cuadricula`: `{ seccion, editable, motivoSoloLectura, dias, bloques, horario, hayBorrador, versiones, clases, plan, avance, pendientes }`.
  - `seccion`: `{ id, nombre, etiqueta («5° A»), estado, grado, aula, anio: { id, anio, estado } }`.
  - `editable` y `motivoSoloLectura`: `false` y el mensaje cuando la sección no es del periodo académico activo o está inactiva.
  - `dias`: los 5 días, en orden. `bloques`: `Bloque[]` del año, en orden; los de tipo `RECREO` no admiten clases.
  - `horario`: `Version` que se muestra, o `null` si la sección aún no tiene horario. `versiones`: todas, de la más reciente a la más antigua. `hayBorrador`: hay un borrador en edición.
  - `clases`: `Clase[]` de la versión mostrada.
  - `plan`: un elemento por curso del plan de estudios del grado: `{ cursoId, codigo, nombre, horasSemanales, asignados, faltan, sobran, docente }`. `docente` es quien tiene asignado el curso en la sección (US14) o `null`.
  - `avance`: `{ asignados, requeridos }` («32 / 35 bloques»): clases frente a la suma de horas semanales del plan.
  - `pendientes`: `{ cursos: [{ cursoId, nombre, horasSemanales, asignados, faltan }], bloquesLibres: [{ dia, bloqueId, horaInicio, horaFin }] }`: lo que falta para publicar (vacío si no falta nada).
- `Bloque`: `{ id, orden, horaInicio, horaFin, tipo, etiqueta }`.
- `Version`: `{ id, version, estado, publicadoEn }` (`publicadoEn` en UTC, ISO 8601).
- `Clase`: `{ id, dia, bloqueId, curso: { id, codigo, nombre }, docente: { id, nombreCompleto, nombreCorto }, aula: { id, nombre }, seccion: { id, etiqueta }, asignacionActiva }`. `asignacionActiva` es `false` si, después de armar el horario, el docente dejó de tener asignado el curso.
- `Ocupacion`: `{ docentes: [{ docenteId, seccion }], aulas: [{ aulaId, seccion }] }`. Es una ayuda para el modal («Ocupado · 4° A»); la validación definitiva ocurre al guardar.
- `HorarioDeSeccion`: `{ seccion, dias, bloques, horario, clases }`. Si la sección no tiene un horario publicado, `horario` es `null` y `clases` está vacío. Nunca incluye el borrador.
- `HorarioDeDocente`: `{ docente: { id, nombreCompleto }, anio: { id, anio } | null, dias, bloques, clases }`: las clases del docente en los horarios **publicados** de las secciones del año, cada una con su `seccion` y su `aula`. Sin `anioId` usa el año por defecto (el `EN_CURSO`; si no, el `EN_MATRICULA`; si no, el abierto más reciente); sin años abiertos, `anio` es `null`. `resumen` es `{ bloques, secciones }`: los bloques con clase en la semana y las etiquetas de las secciones en las que dicta («2° A», «3° B»), sin repetir.
- `HorarioDeEstudiante`: `{ estudiante: { estudianteId, nombres, nombreCompleto }, seccion, dias, bloques, horario, clases }`. Es el `HorarioDeSeccion` de la sección en la que el estudiante está matriculado. `horario` es `null` (y `clases`, vacío) si la sección aún no publica su horario; `seccion` es `null` si el estudiante no tiene una sección con matrícula vigente.

## Reglas

**Cuadrícula por sección (US27)**

- 5 días por los bloques del año. Los recreos quedan sin asignar.
- Solo se edita el horario de una sección **activa** del **periodo académico activo**: el año de la sección no debe estar `CERRADO`. Si no, la cuadrícula se devuelve con `editable: false` y `motivoSoloLectura: "Esta sección no pertenece al periodo académico activo"`, y cualquier escritura responde `422 SECCION_FUERA_DE_ANIO_ACTIVO`.

**Asignación manual de clase (US28)**

- Curso, docente y aula son obligatorios: «Debe completar curso, docente y aula antes de guardar».
- El curso debe estar en el plan de estudios del grado de la sección y el docente debe tenerlo asignado en esa sección (asignación docente activa, US14): «Este docente no tiene asignado el curso seleccionado».
- El aula debe estar activa. El bloque debe ser de tipo `CLASE` y del año de la sección.
- `PUT` sobre un bloque con clase la reemplaza. `DELETE` vacía el bloque.
- Los cambios se hacen siempre sobre el **borrador**. Si la sección no tiene horario, el primer `PUT` crea el borrador versión 1. Si solo tiene la versión publicada, el primer `PUT`, `DELETE` o `POST …/borrador` crea un borrador con las mismas clases (versión siguiente) y aplica ahí el cambio: la versión publicada no se toca hasta publicar.

**Cruces de docente y de aula (US29, US30)**

- En el mismo día y bloque, un docente y un aula solo pueden estar en una sección. Se valida contra el horario vigente de las **otras secciones del mismo año**: su borrador en edición **y** su versión publicada. Las versiones archivadas no cuentan.
- Los mensajes indican la sección, el día y el bloque del conflicto: «Error: Cruce de Docente · ya tiene clase en 4° A (martes 12:35 – 13:20)» y «Error: Aula Ocupada · Aula 305 está asignada a 5° B (miércoles 08:30 – 09:15)». `details` trae `{ seccion: { id, etiqueta }, dia, bloque: { id, horaInicio, horaFin }, estadoHorario }` (`BORRADOR` o `PUBLICADO`) y, en el de aula, `aula`.
- Si chocan el docente y el aula a la vez, se informa el cruce de docente.
- **Concurrencia.** Dos administradores no pueden crear el cruce al mismo tiempo: cada escritura toma un candado de transacción por año (`pg_advisory_xact_lock`), de modo que la segunda valida viendo la clase de la primera y recibe el mismo `409`. Además, la base lo impide por sí sola con dos restricciones de exclusión sobre las clases vigentes, `uq_detalle_cruce_docente` y `uq_detalle_cruce_aula` (mismo día, bloque y docente o aula en secciones distintas).

**Publicación (US31)**

- «Publicar» exige que cada curso del plan de estudios de la sección tenga **tantos bloques como horas semanales**. Si falta alguno: `422 HORARIO_INCOMPLETO` «No se puede publicar: existen bloques horarios sin asignar», con `details.cursos` (curso y cuántos bloques le faltan) y `details.bloquesLibres` (día y bloque de las celdas vacías).
- También se rechaza si un curso tiene más bloques que horas (`HORARIO_CON_EXCESO`), si alguna clase quedó con un docente que ya no tiene el curso (`CLASES_SIN_DOCENTE_VIGENTE`) o si el grado no tiene plan de estudios (`PLAN_SIN_CURSOS`).
- Al publicar, el borrador pasa a `PUBLICADO` y la versión publicada anterior a `ARCHIVADO`, en la misma transacción. Una versión archivada es de solo lectura (`GET …?version=n`) y sus clases dejan de ocupar docentes y aulas.
- Después de confirmar la transacción se avisa **por correo** a los docentes con clases en la versión publicada («Kubo · Horario de 5° A publicado» o «… actualizado»). Si el correo falla, la publicación **no** se revierte: `aviso.enviados` indica cuántos salieron y los demás quedan en la bandeja de salida para reintentarse. En la misma transacción se notifica dentro de la aplicación a los docentes, a los alumnos de la sección y a sus apoderados (US55, [notificaciones.md](notificaciones.md)).
- Sin borrador no hay nada que publicar: `409 SIN_CAMBIOS_POR_PUBLICAR`.

**Horario en los portales (US34, US48, US50)**

- Los tres portales leen **solo la versión `PUBLICADO` vigente** con las mismas consultas del bloque 3 (`horarioPublicadoDeSeccion` y `horarioPublicadoDeDocente`). El borrador en edición nunca se muestra. Cuando se publica una versión nueva, la siguiente consulta ya la devuelve: el usuario no hace nada más (la pantalla, además, vuelve a consultar al recuperar el foco).
- **Nadie elige la sección.** El docente y el alumno salen de la sesión; el apoderado envía el `{id}` de su hijo y el servidor comprueba el vínculo. Ningún endpoint de portal recibe un id de sección ni de docente.
  - `GET /horarios/mi-horario` (US34): clases del docente en sesión en **todas sus secciones publicadas** del año, cada una con `curso`, `seccion` y `aula`. Sin clases publicadas responde `200` con `clases: []` y `resumen: { bloques: 0, secciones: [] }`; la pantalla muestra «Aún no tienes cursos asignados para este periodo».
  - `GET /horarios/apoderado/hijos/{id}/horario` (US48): horario de la sección del hijo, con `curso`, `aula` y `docente` en cada clase. El hijo debe estar entre los estudiantes vinculados a la persona en sesión, con la misma regla del portal de pagos (`403 ESTUDIANTE_NO_VINCULADO` si no; ver [matricula.md](matricula.md#portal-del-apoderado-us42-us43-us44)). Sin publicar: `horario: null`; la pantalla muestra «El horario aún no ha sido publicado por la institución». Un hijo retirado se sigue viendo en el portal, pero sin sección: `seccion: null`.
  - `GET /horarios/apoderado/hijos/{id}/horario/pdf` (US66, «Descargar PDF» de AP-05): la versión publicada vigente en una tabla con una fila por bloque y, por día, «Curso · Aula · Docente»; el recreo ocupa su fila. Mismo vínculo que el horario (`403 ESTUDIANTE_NO_VINCULADO`). Sin horario publicado no se genera: `422 HORARIO_NO_PUBLICADO` «El horario aún no ha sido publicado por la institución.». Usa el generador de PDF de los recibos (US25).
  - `GET /horarios/alumno/horario` (US50): horario de la sección de la **matrícula vigente** del alumno en sesión. Sin matrícula vigente: `403 SIN_MATRICULA_VIGENTE` (ver [matricula.md](matricula.md#portal-del-alumno-us49)). Sin publicar: `horario: null`; la pantalla muestra «El horario aún no ha sido publicado».
- `GET /horarios/secciones/{id}/publicado` quedó **solo para el Administrador**. En el bloque 3 también lo podía llamar cualquier docente con el id de cualquier sección; ahora cada perfil ve únicamente su horario por su propio endpoint.
- Con otro perfil, cada endpoint responde `403 ACCESO_DENEGADO` «No tiene permisos para acceder a este recurso.»; sin sesión, `401 NO_AUTENTICADO`.

## Códigos de error

| Código | HTTP | Cuándo |
|---|---|---|
| `DATOS_INVALIDOS` | 400 | Identificador, día, versión o cuerpo con formato inválido (`details` = mensaje por campo) |
| `CLASE_INCOMPLETA` | 400 | «Debe completar curso, docente y aula antes de guardar» |
| `NO_ENCONTRADO` | 404 | No existe la sección, el bloque (o es de otro año), el aula, el docente, la versión pedida o la clase que se quiere vaciar |
| `CRUCE_DOCENTE` | 409 | «Error: Cruce de Docente · ya tiene clase en …» |
| `AULA_OCUPADA` | 409 | «Error: Aula Ocupada · … está asignada a …» |
| `SIN_CAMBIOS_POR_PUBLICAR` | 409 | Se pide publicar y la sección no tiene borrador |
| `SECCION_FUERA_DE_ANIO_ACTIVO` | 422 | «Esta sección no pertenece al periodo académico activo» |
| `SECCION_INACTIVA` | 422 | La sección está inactiva |
| `BLOQUE_DE_RECREO` | 422 | Se intenta asignar una clase en un recreo |
| `CURSO_FUERA_DEL_PLAN` | 422 | El curso no está en el plan de estudios del grado de la sección |
| `DOCENTE_SIN_CURSO` | 422 | «Este docente no tiene asignado el curso seleccionado» (también si el curso aún no tiene docente) |
| `AULA_INACTIVA` | 422 | El aula elegida está inactiva |
| `HORARIO_INCOMPLETO` | 422 | «No se puede publicar: existen bloques horarios sin asignar» |
| `HORARIO_CON_EXCESO` | 422 | Un curso tiene más bloques que horas semanales (`details.cursos`) |
| `CLASES_SIN_DOCENTE_VIGENTE` | 422 | Hay clases cuyo docente ya no tiene asignado el curso (`details.clases`) |
| `PLAN_SIN_CURSOS` | 422 | El grado de la sección no tiene cursos en su plan de estudios |
| `JORNADA_NO_CONFIGURADA` | 422 | Falta el parámetro `BLOQUES_HORARIO` o no es válido (lo carga la migración `jornada_por_defecto`; en local, también el seed) |
| `ACCESO_DENEGADO` | 403 | «No tiene permisos para acceder a este recurso.»: rol sin permiso, o `mi-horario` con un usuario sin perfil de docente |
| `ESTUDIANTE_NO_VINCULADO` | 403 | El apoderado pide el horario de un estudiante que no es su hijo (US48) |
| `SIN_MATRICULA_VIGENTE` | 403 | El alumno en sesión no tiene una matrícula vigente (US50) |

## Auditoría (RF03)

En la misma transacción que el cambio, con el valor anterior y el nuevo, el usuario, la IP y el `requestId`:

| Acción | Entidad | Anterior → nuevo |
|---|---|---|
| `ASIGNAR_CLASE` | `detalle_horario` | `null` (bloque vacío) o la clase que había → `{ seccionId, horarioId, version, dia, bloque, curso, docenteId, aulaId }` |
| `QUITAR_CLASE` | `detalle_horario` | la clase que había → `{ …, bloque: null }` |
| `PUBLICAR_HORARIO` | `horario` | `{ version, estado: "BORRADOR", publicada }` → `{ version, estado: "PUBLICADO", clases, archivada }` |

La bitácora guarda identificadores y el código del curso, no nombres de personas.

## Dependencias entre módulos

- `horarios` es dueño de `bloque_horario`, `horario` y `detalle_horario`.
- De `academico` usa, por su `index.ts`: `seccionParaHorario`, `planDeSeccion` (cursos del plan con sus horas y la asignación docente activa), `asignacionesDeClases`, `aulasPorId`, `listarAnios` y `anioPorDefecto`.
- De `comunidad`: `docentesProviderComunidad` (nombres) y `contactosDeDocentes` (correos para el aviso).
- De `matricula` (portales): `matriculaVigenteDelAlumno(sesion)` y `seccionDelHijo(sesion, estudianteId)`, que resuelven la sección y aplican el control de acceso. `horarios` queda por encima de `matricula`; `matricula` no conoce a `horarios`.
- `academico` sigue consultando a `horarios` por el puerto `HorariosProvider` (US10 y US14: un curso o una asignación con horario no se elimina).

---

# Asistencia de alumnos (US35, US36, US45, US52)

Pantallas: DO-03 «Asistencia» del docente (`/docente/asistencia`), «Asistencia de alumnos» del administrador con el modal M-20 (`/admin/asistencia`), AP-03 «Asistencia» del apoderado (`/apoderado/asistencia`) y AL-04 «Mi asistencia» del alumno (`/alumno/asistencia`); ver [frontend-asistencia.md](../frontend-asistencia.md). Casos de prueba en [pruebas/casos-sprint3-asistencia.md](../pruebas/casos-sprint3-asistencia.md) y ejemplos en [horarios.http](horarios.http).

## Modelo de la asistencia

- **Sesión de clase** (`sesion_clase`): una clase del horario **publicado** en una fecha. La abre el docente al elegir la clase (se crea si no existe: única por clase y fecha) y guarda en `cerrada_en` el instante del **primer registro** de la lista: desde ahí corre el plazo de corrección. Si el horario se vuelve a publicar el mismo día, la sesión ya abierta en ese bloque sigue siendo la misma.
- **Registro de asistencia** (`asistencia_estudiante`): un alumno en una sesión, con `estado` (`PRESENTE`, `TARDANZA`, `FALTA`, `FALTA_JUSTIFICADA`; en pantalla «Presente», «Tardanza», «Ausente» y «Justificado»), `observacion` opcional, quién y cuándo lo registró y, en cada corrección, quién y cuándo lo cambió (`modificado_por_id`, `modificado_en`), el estado que tenía antes (`estado_anterior`, columna nueva) y el motivo del administrador (`motivo_cambio`).
- **Aviso por umbral** (`aviso_asistencia`, tabla nueva): un aviso ya enviado al alumno y a su apoderado principal, único por matrícula, tipo (`FALTAS_MES`, `PORCENTAJE_AVISO`, `PORCENTAJE_RIESGO`) y periodo (el mes «2026-09» o el año «2026»). Es lo que impide repetir un aviso (US52).
- **Parámetros** (`parametro_institucion`, generales o por año): `PLAZO_CORRECCION_ASISTENCIA_H` (24), `UMBRAL_FALTAS_MES` (3), `UMBRAL_INASISTENCIA_AVISO` (0.15) y `UMBRAL_INASISTENCIA` (0.20). Los carga el seed y, en AWS y Neon, la migración `asistencia_avisos_y_parametros` si faltan (no pisa un valor ya registrado). Sin parámetro se usan esos mismos valores por defecto.

## Endpoints de asistencia

| Método y ruta | Rol | Cuerpo | Respuesta `data` |
|---|---|---|---|
| `GET /horarios/asistencia/clases-de-hoy` | Docente | — | `ClasesDeHoy` del docente en sesión |
| `POST /horarios/asistencia/sesiones` | Docente | `{ claseId, fecha? }` | `201 SesionDetalle`: abre (o retoma) la sesión de hoy de esa clase |
| `GET /horarios/asistencia/sesiones?fecha=` | Docente, Administrador | — | `{ fecha, sesiones: SesionVista[] }`. Docente: las suyas de esa fecha o, sin fecha, las de los últimos 7 días. Administrador: todas las de la fecha (por defecto, hoy) |
| `GET /horarios/asistencia/sesiones/{id}` | Docente (solo las suyas), Administrador | — | `SesionDetalle` |
| `PUT /horarios/asistencia/sesiones/{id}/registros` | Docente (solo las suyas) | `{ alumnos: [{ matriculaId, estado, observacion }] }` | `SesionDetalle` + `avisos: { avisos, correos }` |
| `POST /horarios/asistencia/registros/{id}/corregir` | Administrador | `{ estado, motivo, observacion? }` | `SesionDetalle` (vista del administrador) + `avisos` |
| `GET /horarios/apoderado/hijos/{id}/asistencia?mes=AAAA-MM` | Apoderado | — | `AsistenciaDelMes` del hijo, si está vinculado (US45) |
| `GET /horarios/alumno/asistencia` | Alumno | — | `AsistenciaDelAlumno` del alumno en sesión (US52) |

- `ClasesDeHoy`: `{ fecha, dia, sinClases, clases }`. `fecha` es hoy en Lima («AAAA-MM-DD»). `sinClases` es `null` o `{ motivo, mensaje }`, con `motivo` `FIN_DE_SEMANA` («Hoy no hay clases: es fin de semana.»), `SIN_ANIO_EN_CURSO`, `FUERA_DE_BIMESTRE` o `SIN_CLASES` («No tienes clases programadas para hoy en el horario publicado.»). Cada clase: `{ claseId, curso, seccion, aula, bloque: { id, horaInicio, horaFin, etiqueta }, sesion }`, en orden de bloque; `sesion` es `null` o `{ id, …EstadoDeRegistro }`.
- `EstadoDeRegistro`: `{ registrada, registradaEn, editableHasta, editable, motivoSoloLectura, resumen }`. `editable` es `true` si el docente puede guardar ahora: registrar por primera vez el mismo día de la clase o corregir hasta `editableHasta` (registro + plazo). Si no, `motivoSoloLectura` trae el mensaje («El plazo para modificar esta asistencia ha expirado (24 horas)»). `resumen`: `{ presentes, tardanzas, ausentes, justificados, sinMarcar }`.
- `SesionVista`: `{ id, fecha, dia, curso, seccion, aula, docente: { id, nombreCompleto, nombreCorto }, bloque, …EstadoDeRegistro }`.
- `SesionDetalle`: `SesionVista` + `{ plazoHoras, bimestre, faltasParaResaltar, alumnos }`. `alumnos` son quienes tenían matrícula «Matriculado» en la sección ese día según el historial de secciones (sin retirados ni anulados) y, en una sesión ya registrada, también quien tiene un registro aunque después se haya retirado o trasladado; ordenados por apellido. Cada uno: `{ registroId, matriculaId, nombre («Álvarez Torres, Camila»), dni (solo para el Administrador), estado, observacion, estadoAnterior, registradoPor, registradoEn, modificadoPor, modificadoEn, motivoCambio, faltas, tardanzas }`. `faltas` y `tardanzas` son las acumuladas en ese curso durante el bimestre de la sesión (`bimestre`, por ejemplo «Bimestre III»); la pantalla resalta a quien llega a `faltasParaResaltar` (`UMBRAL_FALTAS_MES`).
- `AsistenciaDelMes`: `{ estudiante, anio, mes, primerMes, ultimoMes, calendario, resumen, incidencias, alerta, anual, umbralFaltasMes }`.
  - `calendario`: los días de lunes a viernes del mes, `{ fecha, dia, estado }`, con `estado` `PRESENTE`, `TARDANZA`, `AUSENTE`, `JUSTIFICADO`, `VACACIONES` (entre bimestres), `FUERA_DEL_ANIO` o `SIN_REGISTRO`.
  - `resumen`: `{ presentes, tardanzas, ausentes, justificados, diasConClases, porcentajeAsistencia }`, en días; el porcentaje es `null` sin registros.
  - `incidencias`: de la más reciente a la más antigua, `{ fecha, alcance: "DIA" | "CLASE", estado, clase: { curso, horaInicio, docente } | null, observacion }`.
  - `alerta`: `null` o `{ mensaje: "Atención: 3 inasistencias injustificadas este mes", faltas, fechas }`.
  - `anual`: `SituacionAnual` `{ faltas, lectivos, desde, desdeMatricula, porcentaje, nivel: "SIN_RIESGO" | "AVISO" | "RIESGO", porcentajeAviso, porcentajeRiesgo, faltasAntesDelRiesgo }`. `lectivos` son los días de clase que le corresponden al alumno, contados desde `desde`; `desdeMatricula` es `true` si se matriculó después de que empezaron las clases. `faltasAntesDelRiesgo` son las faltas que todavía puede sumar sin alcanzar el umbral de riesgo.
  - `primerMes` y `ultimoMes`: entre qué meses se puede navegar (del inicio del año al mes actual, o al último del año si ya terminó).
- `AsistenciaDelAlumno`: `{ estudiante, anio, bimestre: { numero, nombre, faltas, tardanzas, justificadas } | null, delAnio: { faltas, tardanzas, justificadas, desde }, riesgo: SituacionAnual, alertaDelMes, detalle, sinInasistencias }`. `detalle` son las faltas, tardanzas y justificaciones del bimestre. `sinInasistencias` es `true` si no tiene faltas, tardanzas ni justificaciones en el año: la pantalla muestra «¡Felicidades! No registras inasistencias este periodo».

## Reglas de la asistencia

**Toma de asistencia (US35)**

- El docente ve sus clases del día según el horario **publicado** del año **en curso** y la fecha de **Lima**. En fin de semana, sin año en curso o fuera de los bimestres, la lista llega vacía con el mensaje de `sinClases`.
- Solo se abre la sesión de una clase **propia** (`403 CLASE_AJENA`), programada ese día en el horario publicado (`422 CLASE_FUERA_DE_HORARIO`) y del **día actual**: una fecha futura responde `422 FECHA_FUTURA` y un día pasado, `422 SOLO_DIA_ACTUAL`.
- Al guardar, todos los alumnos de la lista deben tener estado: si falta alguno, `422 ASISTENCIA_INCOMPLETA` «Existen alumnos sin estado de asistencia registrado» con `details.faltantes: [{ matriculaId, nombre }]`, y no se guarda nada. Un alumno que no es de la clase (o repetido) responde `422 ALUMNO_FUERA_DE_LA_CLASE`.
- La observación es opcional (hasta 200 caracteres); vacía se guarda como `null`. El apoderado la ve en «Asistencia» (US35, criterio 4).

**Plazo de corrección (US36)**

- El docente corrige la lista de su sesión hasta `PLAZO_CORRECCION_ASISTENCIA_H` horas después del **primer** registro (el plazo no se reinicia al corregir). Solo cambian los registros distintos; en cada uno quedan `modificado_por_id`, `modificado_en` y, si cambia el estado, `estado_anterior`.
- Pasado el plazo: `422 PLAZO_CORRECCION_VENCIDO` «El plazo para modificar esta asistencia ha expirado (24 horas)», y la sesión se devuelve con `editable: false` (solo lectura).
- El **administrador** corrige un registro en cualquier momento con `POST …/registros/{id}/corregir`: `motivo` obligatorio (5 a 300 caracteres) y auditoría `CORREGIR_ASISTENCIA` con el estado anterior y el nuevo. Si el estado y la observación quedan iguales: `409 ASISTENCIA_SIN_CAMBIOS`. El docente no puede usar este endpoint (`403`).
- Las escrituras bloquean la fila de la sesión o del registro (`FOR UPDATE`): dos guardados simultáneos no duplican registros.

**Asistencia del hijo (US45)**

- El día es **Ausente** solo si el alumno faltó **sin justificar** a todas sus clases registradas de ese día; **Justificado** si faltó a todas y todas las faltas están justificadas; **Tardanza** si asistió y llegó tarde a alguna; **Presente** en los demás casos. Si faltó a algunas clases y no a todas, el día es Presente (o Tardanza) y esas clases aparecen en `incidencias`.
- `alerta` aparece al llegar a `UMBRAL_FALTAS_MES` días Ausente en el mes consultado. Sin registros en el mes, `resumen.diasConClases` es 0 y la pantalla muestra «No hay registros de asistencia disponibles para este periodo».
- Solo hijos vinculados: otro estudiante responde `403 ESTUDIANTE_NO_VINCULADO`. Un hijo retirado conserva su asistencia (se usa su matrícula más reciente).

**Mi asistencia (US52) y avisos**

- Las faltas cuentan **días Ausente** (sin justificar); las tardanzas, días con tardanza. Se acumulan en el bimestre que contiene hoy (en vacaciones, el último que empezó) y en el año.
- El porcentaje es faltas del año / **días de clase que le corresponden al alumno** (D-11): de lunes a viernes dentro de los bimestres, desde su `fecha_matricula` (o desde el inicio de clases si se matriculó antes) hasta el fin del último bimestre; no descuenta feriados. Ejemplo: matriculado el 06/11/2026 con el último bimestre hasta el 15/12/2026, la base son 28 días y con 20 % el riesgo llega en la 6.ª falta. Nivel `AVISO` al llegar a `UMBRAL_INASISTENCIA_AVISO` y `RIESGO` al llegar a `UMBRAL_INASISTENCIA`; los avisos por correo usan la misma base.
- `faltasAntesDelRiesgo` cuenta las faltas que aún no llegan al umbral: con 187 días, 20 % y 1 falta, el umbral se alcanza en la falta 38 y le quedan 36.
- **Aviso único:** cuando una falta registrada o corregida hace que el alumno alcance por primera vez un umbral, se deja constancia en `aviso_asistencia` y se envía un correo al alumno y a su apoderado principal: `FALTAS_MES` una vez por mes, `PORCENTAJE_AVISO` y `PORCENTAJE_RIESGO` una vez por año. Si se alcanzan los dos porcentajes a la vez, se escribe solo el de riesgo. El correo se envía **después** de confirmar la transacción y su falla no revierte la asistencia (queda en la bandeja de salida). Los avisos del 15 % y del 20 % notifican además al apoderado principal dentro de la aplicación, en la misma transacción que la constancia (US55, [notificaciones.md](notificaciones.md)).

**Seguridad**

- Sin sesión, `401 NO_AUTENTICADO`; con otro perfil, `403 ACCESO_DENEGADO`. El docente sale de la sesión: no ve ni guarda sesiones de otro docente (`403 CLASE_AJENA`). El apoderado solo ve a sus hijos y el alumno no envía identificadores: siempre recibe lo suyo.

## Códigos de error de la asistencia

| Código | HTTP | Cuándo |
|---|---|---|
| `DATOS_INVALIDOS` | 400 | Identificador, fecha, mes, estado u observación con formato inválido; motivo vacío o corto |
| `CLASE_AJENA` | 403 | La clase o la sesión es de otro docente |
| `ESTUDIANTE_NO_VINCULADO` | 403 | El apoderado pide la asistencia de un estudiante que no es su hijo |
| `SIN_MATRICULA_VIGENTE` | 403 | El alumno en sesión no tiene matrícula vigente |
| `NO_ENCONTRADO` | 404 | No existe la clase, la sesión o el registro |
| `ASISTENCIA_SIN_CAMBIOS` | 409 | La corrección del administrador no cambia el estado ni la observación |
| `FECHA_FUTURA` | 422 | «No se puede registrar la asistencia de una fecha futura.» |
| `SOLO_DIA_ACTUAL` | 422 | «Solo se puede registrar la asistencia del día actual.» |
| `DIA_SIN_CLASES` | 422 | Fin de semana, sin año en curso o fuera de los bimestres |
| `CLASE_FUERA_DE_HORARIO` | 422 | La clase no está programada ese día en el horario publicado |
| `ASISTENCIA_INCOMPLETA` | 422 | «Existen alumnos sin estado de asistencia registrado» (`details.faltantes`) |
| `ALUMNO_FUERA_DE_LA_CLASE` | 422 | La lista trae un alumno que no es de la clase o repetido |
| `PLAZO_CORRECCION_VENCIDO` | 422 | «El plazo para modificar esta asistencia ha expirado (24 horas)» |

## Auditoría de la asistencia (RF03)

| Acción | Entidad | Anterior → nuevo |
|---|---|---|
| `CORREGIR_ASISTENCIA` | `asistencia_estudiante` | `{ estado, observacion }` → `{ estado, observacion, sesionClaseId, matriculaId, fecha, fueraDePlazo }`, con el `motivo` |

El registro y las correcciones del docente dentro del plazo no van a la bitácora: quedan en la propia fila (`registrado_por_id`, `modificado_por_id`, `modificado_en`, `estado_anterior`).

## Dependencias de la asistencia

- `horarios` es dueño de `sesion_clase`, `asistencia_estudiante` y `aviso_asistencia`.
- De `matricula`: `matriculasDeSeccionEnFecha` (lista de la clase según el historial de secciones), `datosDeMatriculas` (nuevo: estado y estudiante de cada matrícula), `matriculaVigenteDelAlumno` y `matriculaDelHijo` (nuevo: la matrícula del hijo autorizado).
- De `comunidad`: `resumenEstudiantes` (ahora también con `nombres` y `apellidos` por separado), `nombresDeUsuarios` y `contactosDeAsistencia` (nuevo: correo del estudiante y de su apoderado principal).
- De `academico`: `listarAnios`, `obtenerAnio` (bimestres), `asignacionesDeClases` y `fechaEnLima`.

# Asistencia del personal docente (US32)

Pantalla AD-14 (`/admin/asistencia-docente`). El administrador registra el ingreso diario de cada docente, su salida y la justificación de sus inasistencias. A la hora límite, la verificación automática marca con «Inasistencia» a quien no fue marcado.

## Modelo de la asistencia docente

- `asistencia_docente`: un registro por docente y fecha (clave única `docente_id + fecha`), con `hora_ingreso`, `hora_salida` (hora de Lima, `TIME`), `estado` (`PUNTUAL`, `TARDANZA`, `FALTA`, `FALTA_JUSTIFICADA`), `justificacion` y `registrado_por_id`.
- Migración `20261125120000_asistencia_docente`: `registrado_por_id` admite `NULL` (la falta de la verificación automática no la registra un usuario), índice por `fecha` y `ck_asistencia_docente_horas` (la salida necesita un ingreso y no es anterior a él).
- Parámetros generales nuevos (la migración los carga si faltan): `HORA_INICIO_JORNADA_DOCENTE` = `"07:30"` y `HORA_LIMITE_ASISTENCIA_DOCENTE` = `"08:00"`. El antiguo `HORA_LIMITE_DOCENTE` del seed ya no se usa.

## Endpoints de la asistencia docente

Todos son **solo Administrador**.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/v1/horarios/asistencia-docente?fecha=AAAA-MM-DD` | Listado del día (por defecto, hoy): docentes activos (y los inactivos con registro esa fecha) con especialidad, primera clase del horario publicado, registro y contadores |
| POST | `/api/v1/horarios/asistencia-docente/ingreso` | Marcar «Asistió»: `{ docenteId, fecha }` → `201` con el registro |
| POST | `/api/v1/horarios/asistencia-docente/salida` | Hora de salida: `{ docenteId, fecha }` → `200` |
| POST | `/api/v1/horarios/asistencia-docente/{id}/justificar` | Justificar una inasistencia: `{ motivo }` (5 a 300 caracteres) → `200` |

Respuesta del listado:

```jsonc
{ "data": {
  "fecha": "2026-09-16", "hoy": "2026-09-16", "horaActual": "07:46",
  "horaInicioJornada": "07:30", "horaLimite": "08:00", "minutosParaLimite": 14,
  "diaNoLectivo": null,
  "resumen": { "total": 28, "puntuales": 22, "tardanzas": 0, "faltas": 2, "justificadas": 1, "sinMarcar": 4 },
  "docentes": [
    { "docenteId": "…", "nombreCompleto": "Juan Pérez Salazar", "especialidad": "Matemática", "inactivo": false,
      "primeraClase": "07:45",
      "registro": { "id": "…", "estado": "PUNTUAL", "horaIngreso": "07:31", "horaSalida": null,
                    "justificacion": null, "automatica": false } }
  ] } }
```

## Reglas de la asistencia docente

- **Hora exacta (criterio 1):** el ingreso guarda la hora del servidor en Lima con segundos. Es `PUNTUAL` hasta el minuto de `HORA_INICIO_JORNADA_DOCENTE` inclusive (07:30:59 todavía es Puntual) y `TARDANZA` desde el minuto siguiente.
- **Solo el día actual (criterio 3):** el ingreso y la salida se rechazan si `fecha` no es la de hoy en Lima: `422 SOLO_DIA_ACTUAL` «Solo se puede registrar la asistencia del día actual». La justificación sí acepta cualquier fecha.
- **Días lectivos:** lunes a viernes, con un año `EN_CURSO` y dentro de uno de sus bimestres (la misma regla `motivoDiaNoLectivo` de la asistencia de alumnos). Fuera de ellos, `422 DIA_NO_LECTIVO`.
- **Verificación automática (criterio 2):** `scripts/tareasProgramadas.ts` (timer de 15 minutos en la EC2, `npm run conciliar-pagos` o `npm run tareas-programadas`) llama a `marcarFaltasDocentes()`. Desde `HORA_LIMITE_ASISTENCIA_DOCENTE`, en un día lectivo, crea `FALTA` con `registrado_por_id = NULL` para cada docente activo sin registro del día. Es idempotente: la clave única impide repetirla.
- **Llegada después de la falta:** marcar «Asistió» sobre una falta automática la convierte en `TARDANZA` con la hora real, y el registro pasa al administrador (auditado como `REEMPLAZAR_FALTA_DOCENTE`).
- Un ingreso ya registrado no se vuelve a marcar; una falta justificada tampoco admite ingreso. La salida necesita el ingreso y se registra una vez. Solo se justifica un registro `FALTA`.

## Códigos de error de la asistencia docente

| Código | HTTP | Cuándo |
|---|---|---|
| `DATOS_INVALIDOS` | 400 | Identificador o fecha con formato inválido; motivo vacío o corto |
| `NO_ENCONTRADO` | 404 | El registro que se quiere justificar no existe |
| `INGRESO_YA_REGISTRADO` | 409 | El docente ya tiene ingreso ese día |
| `FALTA_YA_JUSTIFICADA` | 409 | Se intenta marcar el ingreso sobre una falta justificada |
| `SALIDA_YA_REGISTRADA` | 409 | La salida ya se registró |
| `SOLO_DIA_ACTUAL` | 422 | «Solo se puede registrar la asistencia del día actual» |
| `DIA_NO_LECTIVO` | 422 | Fin de semana, sin año en curso o fuera de los bimestres |
| `DOCENTE_NO_DISPONIBLE` | 422 | El docente no existe o está inactivo |
| `SIN_INGRESO` | 422 | La salida se pide sin ingreso registrado |
| `SALIDA_ANTES_DEL_INGRESO` | 422 | La hora de salida sería anterior a la de ingreso |
| `NO_ES_INASISTENCIA` | 422 | Se intenta justificar un registro que no es `FALTA` |

## Auditoría de la asistencia docente (RF03)

| Acción | Usuario | Anterior → nuevo |
|---|---|---|
| `REGISTRAR_INGRESO_DOCENTE` | Administrador | — → `{ docenteId, fecha, estado, horaIngreso }` |
| `REEMPLAZAR_FALTA_DOCENTE` | Administrador | `{ estado: FALTA, automatica }` → `{ docenteId, fecha, estado: TARDANZA, horaIngreso }`, con motivo |
| `REGISTRAR_SALIDA_DOCENTE` | Administrador | `{ horaSalida: null }` → `{ docenteId, fecha, horaSalida }` |
| `JUSTIFICAR_FALTA_DOCENTE` | Administrador | `{ estado: FALTA }` → `{ docenteId, fecha, estado: FALTA_JUSTIFICADA }`, con el motivo |
| `MARCAR_FALTA_DOCENTE` | `NULL` (verificación automática) | — → `{ docenteId, fecha, estado: FALTA, horaLimite }` |

## Dependencias de la asistencia docente

- `horarios` es dueño de `asistencia_docente`.
- De `comunidad`: `personalDocente` (nuevo: docentes activos, y los indicados aunque no lo estén, con su especialidad).
- De `academico`: `listarAnios` (año en curso y bimestres) y `fechaEnLima`.
- De `platform/config`: `parametroHora` (nuevo: parámetros «HH:MM» con valor por defecto).
