# API · Horarios: cuadrícula por sección, asignación de clases, cruces, publicación (US27–US31) y horario en los portales (US34, US48, US50)

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
- Después de confirmar la transacción se avisa **por correo** a los docentes con clases en la versión publicada («Kubo · Horario de 5° A publicado» o «… actualizado»). Si el correo falla, la publicación **no** se revierte: `aviso.enviados` indica cuántos salieron. La notificación dentro de la aplicación llega con US55.
- Sin borrador no hay nada que publicar: `409 SIN_CAMBIOS_POR_PUBLICAR`.

**Horario en los portales (US34, US48, US50)**

- Los tres portales leen **solo la versión `PUBLICADO` vigente** con las mismas consultas del bloque 3 (`horarioPublicadoDeSeccion` y `horarioPublicadoDeDocente`). El borrador en edición nunca se muestra. Cuando se publica una versión nueva, la siguiente consulta ya la devuelve: el usuario no hace nada más (la pantalla, además, vuelve a consultar al recuperar el foco).
- **Nadie elige la sección.** El docente y el alumno salen de la sesión; el apoderado envía el `{id}` de su hijo y el servidor comprueba el vínculo. Ningún endpoint de portal recibe un id de sección ni de docente.
  - `GET /horarios/mi-horario` (US34): clases del docente en sesión en **todas sus secciones publicadas** del año, cada una con `curso`, `seccion` y `aula`. Sin clases publicadas responde `200` con `clases: []` y `resumen: { bloques: 0, secciones: [] }`; la pantalla muestra «Aún no tienes cursos asignados para este periodo».
  - `GET /horarios/apoderado/hijos/{id}/horario` (US48): horario de la sección del hijo, con `curso`, `aula` y `docente` en cada clase. El hijo debe estar entre los estudiantes vinculados a la persona en sesión, con la misma regla del portal de pagos (`403 ESTUDIANTE_NO_VINCULADO` si no; ver [matricula.md](matricula.md#portal-del-apoderado-us42-us43-us44)). Sin publicar: `horario: null`; la pantalla muestra «El horario aún no ha sido publicado por la institución». Un hijo retirado se sigue viendo en el portal, pero sin sección: `seccion: null`.
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
