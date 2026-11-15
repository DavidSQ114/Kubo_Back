# API · Horarios: cuadrícula por sección, asignación de clases, cruces y publicación (US27–US31)

Base: `/api/v1` · Formato: JSON · Éxito `{ "data": … }` · Error `{ "error": { "code", "message", "details" } }`
El `message` de los errores ya está redactado para mostrarse al usuario (RNF09). Pantalla: AD-13 (`/admin/horarios`) y modal M-06; ver [frontend-horarios.md](../frontend-horarios.md). Casos de prueba en [pruebas/casos-sprint3-horarios.md](../pruebas/casos-sprint3-horarios.md) y ejemplos en [horarios.http](horarios.http).

La sesión, las cookies y qué hacer ante un `401` o un `403` están en [identidad.md](identidad.md).

## Modelo

- **Bloques horarios del año** (`bloque_horario`): catálogo con `orden`, `horaInicio`, `horaFin` (texto `HH:MM`), `tipo` (`CLASE` o `RECREO`) y `etiqueta`. El catálogo de un año se crea solo, la primera vez que se abre una cuadrícula de ese año, con la jornada del parámetro `BLOQUES_HORARIO` (seed: secundaria de lunes a viernes, 7 bloques de 45 minutos de 07:45 a 13:20 y un recreo de 10:00 a 10:20). Para una jornada distinta en un año, basta registrar el parámetro con ese `anio_academico_id` antes de abrir sus horarios. Editar el catálogo desde la aplicación no es parte de este sprint.
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
| `GET /horarios/secciones/{id}/publicado` | Administrador, Docente | — | `HorarioDeSeccion`: solo la versión publicada |
| `GET /horarios/docentes/{id}/publicado?anioId=` | Administrador | — | `HorarioDeDocente` |
| `GET /horarios/mi-horario?anioId=` | Docente | — | `HorarioDeDocente` del docente en sesión |

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
- `HorarioDeDocente`: `{ docente: { id, nombreCompleto }, anio: { id, anio } | null, dias, bloques, clases }`: las clases del docente en los horarios **publicados** de las secciones del año, cada una con su `seccion` y su `aula`. Sin `anioId` usa el año por defecto (el `EN_CURSO`; si no, el `EN_MATRICULA`; si no, el abierto más reciente); sin años abiertos, `anio` es `null`.

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

**Para otros módulos (portales, bloque 4).** `horarioPublicadoDeSeccion(seccionId)`, `horarioPublicadoDeDocente(docenteId, anioId?)` y `miHorarioDocente(sesion, anioId?)` se exportan desde `@/modules/horarios`. El horario del alumno y del apoderado usará `horarioPublicadoDeSeccion` con la sección de la matrícula; su endpoint y su control de acceso llegan con esas pantallas.

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
| `JORNADA_NO_CONFIGURADA` | 422 | Falta el parámetro `BLOQUES_HORARIO` o no es válido (ejecutar el seed) |
| `ACCESO_DENEGADO` | 403 | Rol sin permiso, o `mi-horario` con un usuario sin perfil de docente |

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
- `academico` sigue consultando a `horarios` por el puerto `HorariosProvider` (US10 y US14: un curso o una asignación con horario no se elimina).
