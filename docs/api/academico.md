# API · Académico: año, periodos, grados, secciones, aulas, cursos y competencias (US06–US11)

Base: `/api/v1` · Formato: JSON · Éxito `{ "data": … }` · Error `{ "error": { "code", "message", "details" } }`
El `message` de los errores ya está redactado para mostrarse al usuario (RNF09). Pantalla: AD-02 (`/admin/anio`).

Todas las rutas exigen sesión con el rol `ADMINISTRADOR`. La sesión, las cookies y qué hacer ante un `401` o un `403` están en [identidad.md](identidad.md).

Las fechas sin hora viajan como texto `AAAA-MM-DD` (por ejemplo `"2026-03-02"`), sin zona horaria. Los rangos son inclusivos: dos rangos que comparten un día se solapan.

## Endpoints · solo `ADMINISTRADOR`

| Método y ruta | Cuerpo | Respuesta `data` |
|---|---|---|
| `GET /academico/anios` | — | `AnioAcademico[]`, del más reciente al más antiguo |
| `POST /academico/anios` | `{ anio, fechaInicio, fechaFin }` | `201 AnioAcademico` en estado `PLANIFICADO` |
| `GET /academico/anios/{id}` | — | `AnioAcademico` |
| `PATCH /academico/anios/{id}` | `{ anio?, fechaInicio?, fechaFin? }` (al menos uno) | `AnioAcademico` |
| `POST /academico/anios/{id}/estado` | `{ estado }` | `AnioAcademico` con el nuevo estado |
| `GET /academico/anios/{id}/periodos` | — | `Periodo[]` ordenados por número |
| `PUT /academico/anios/{id}/periodos` | `{ periodos: [{ numero, fechaInicio, fechaFin }] × 4 }` | `Periodo[]` guardados |

- `AnioAcademico`: `{ id, anio, fechaInicio, fechaFin, estado, periodos: Periodo[] }`.
- `Periodo`: `{ id, numero, nombre, fechaInicio, fechaFin, estado }` (en `GET …/periodos` también `anioAcademicoId`). El nombre lo pone el sistema: «Bimestre I» … «Bimestre IV». Un bimestre nuevo nace `INACTIVO`.
- `estado` del año: `PLANIFICADO` → `EN_MATRICULA` → `EN_CURSO` → `EN_CIERRE` → `CERRADO`.

## Reglas

**Año académico (US06)**

- Se crea en `PLANIFICADO`. `anio` es único y está entre 2000 y 2100.
- `fechaFin` debe ser posterior a `fechaInicio`.
- `anio` debe ser el año de `fechaInicio` (el año puede terminar al año siguiente).
- No puede solaparse con otro año que no esté `CERRADO`.
- El estado solo avanza, de uno en uno. Pasar a `EN_MATRICULA` es «Abrir matrícula» y habilita el módulo de matrícula.
- Solo puede haber un año `EN_CURSO` (índice único parcial `uq_anio_en_curso`). Si dos solicitudes lo intentan a la vez, la segunda recibe `409 ANIO_EN_CURSO_EXISTENTE`.
- Para pasar a `CERRADO`, todos los `cierre_calificacion` de los periodos del año deben estar `PUBLICADO`. Si falta alguno, o si no hay ninguno, se rechaza.
- Un año `CERRADO` no se edita ni cambia de estado, y sus bimestres tampoco.
- `PATCH` solo cambia número y fechas; los bimestres ya guardados deben seguir dentro del nuevo rango.

**Periodos de evaluación (US07)**

- Se guardan los 4 bimestres juntos (números 1 a 4, sin repetir).
- Cada bimestre: fin posterior al inicio y dentro del rango del año.
- Los bimestres no pueden solaparse entre sí y van en orden: cada uno empieza después de que termina el anterior.
- Un bimestre `FINALIZADO` no cambia: sus fechas deben llegar iguales (se pueden editar los demás).

**Para otros módulos.** `periodoVigente(anioId, fecha?)` (en `@/modules/academico`) devuelve el bimestre en el que cae la fecha (por defecto hoy, en hora de Lima) si el año está `EN_CURSO` y el bimestre no está `FINALIZADO`; si no, `null`. Lo usará el registro de notas (US07, criterio 3).

## Códigos de error

| Código | HTTP | Cuándo |
|---|---|---|
| `DATOS_INVALIDOS` | 400 | Falta un campo, la fecha no tiene formato `AAAA-MM-DD` o no existe, o no llegan 4 bimestres (`details` = mensaje por campo) |
| `FECHAS_INVALIDAS` | 400 | «La fecha de fin debe ser posterior a la fecha de inicio» (en un bimestre, con su nombre al inicio) |
| `ANIO_NO_COINCIDE` | 400 | «El año debe coincidir con la fecha de inicio» |
| `PERIODOS_INCOMPLETOS` | 400 | Los números de los bimestres no son 1, 2, 3 y 4 sin repetir |
| `NO_AUTENTICADO` · `SESION_INVALIDA` | 401 | Sin sesión o sesión vencida |
| `CAMBIO_PASSWORD_REQUERIDO` · `ACCESO_DENEGADO` | 403 | Debe cambiar su contraseña, o el rol activo no es `ADMINISTRADOR` |
| `NO_ENCONTRADO` | 404 | El año académico no existe |
| `ANIO_SOLAPADO` | 409 | «Ya existe un año académico activo en ese rango de fechas» |
| `ANIO_DUPLICADO` | 409 | Ya existe un año con ese número (solo puede pasar si el otro está `CERRADO`; si no, se detecta antes el solapamiento) |
| `ANIO_EN_CURSO_EXISTENTE` | 409 | Ya hay otro año `EN_CURSO` |
| `TRANSICION_NO_PERMITIDA` | 422 | El estado pedido no es el siguiente (retroceder, saltar o repetir) |
| `NOTAS_SIN_PUBLICAR` | 422 | «No se puede cerrar el año: existen notas sin publicar» |
| `ANIO_CERRADO` | 422 | El año está cerrado y no se puede modificar |
| `PERIODO_FUERA_DEL_ANIO` | 422 | Un bimestre sale del rango del año |
| `PERIODOS_SOLAPADOS` | 422 | «Los periodos de evaluación no pueden solaparse» |
| `PERIODOS_DESORDENADOS` | 422 | «Los bimestres deben registrarse en orden» |
| `PERIODO_FINALIZADO` | 422 | Se intentó cambiar las fechas de un bimestre finalizado |
| `PERIODOS_FUERA_DEL_ANIO` | 422 | Con las nuevas fechas del año, algún bimestre guardado quedaría fuera |
| `ERROR_INTERNO` | 500 | Error no controlado; `details.requestId` sirve para buscarlo en el log |

## Auditoría (RF03)

Se registran en `registro_auditoria`, en la misma transacción que el cambio y con el administrador, IP y requestId:

| Acción | Valor anterior → nuevo |
|---|---|
| `CREAR_ANIO_ACADEMICO` | — → año creado |
| `EDITAR_ANIO_ACADEMICO` | número y fechas antes → después |
| `CAMBIAR_ESTADO_ANIO_ACADEMICO` | `{ estado }` → `{ estado }` |
| `GUARDAR_PERIODOS_EVALUACION` | bimestres antes → después |

## Dependencias entre módulos

`academico` no lee `cierre_calificacion` (es de `evaluacion`): declara el puerto `CierresProvider` en `puertos.ts`, `evaluacion` lo implementa y `src/server/wiring.ts` los conecta.

---

# Grados, secciones y aulas (US08, US09)

Pantalla: AD-03 (`/admin/grados`). Todas las rutas exigen el rol `ADMINISTRADOR`.

## Endpoints · solo `ADMINISTRADOR`

| Método y ruta | Cuerpo / consulta | Respuesta `data` |
|---|---|---|
| `GET /academico/grados` | — | `Grado[]` activos (`{ id, numero, nombre }`), del 1° al 5° |
| `GET /academico/secciones` | `?anioId=` (obligatorio) | `Seccion[]` ordenadas por grado y nombre |
| `POST /academico/secciones` | `{ anioAcademicoId, gradoId, nombre, aforoMaximo, aulaId?, tutorId? }` | `201 Seccion` en estado `ACTIVA` |
| `PATCH /academico/secciones/{id}` | `{ gradoId?, nombre?, aforoMaximo?, aulaId?, tutorId? }` (al menos uno; `null` quita aula o tutor) | `Seccion` |
| `DELETE /academico/secciones/{id}` | — | `{ seccionId, eliminada: true }` |
| `POST /academico/secciones/{id}/estado` | `{ estado: "ACTIVA" \| "INACTIVA" }` | `Seccion` |
| `GET /academico/aulas` | `?anioId=` (opcional) | `Aula[]`, activas primero |
| `POST /academico/aulas` | `{ nombre, ubicacion?, aforo }` | `201 Aula` activa |
| `PATCH /academico/aulas/{id}` | `{ nombre?, ubicacion?, aforo? }` (al menos uno) | `Aula` |
| `POST /academico/aulas/{id}/estado` | `{ activo: boolean }` | `Aula` |
| `GET /comunidad/docentes` | — | `{ id, nombreCompleto, nombreCorto, activo }[]`: docentes activos para elegir tutor |

- `Seccion`: `{ id, anioAcademicoId, nombre, aforoMaximo, estado, grado, aula: { id, nombre, aforo, activo } | null, tutor: { id, nombreCompleto, nombreCorto } | null, vacantes }`.
- `vacantes`: `{ matriculados, aforo, disponibles, completo }`. `matriculados` cuenta las matrículas en estado `MATRICULADO`; `completo` es «Aforo completo».
- `Aula`: `{ id, nombre, ubicacion, aforo, activo, secciones }`. Con `anioId`, `secciones` lista las de ese año que usan el aula, con sus `matriculados` (columnas «Sección asignada» y «Ocupación»).
- `ubicacion` es un texto libre con pabellón y piso, por ejemplo «Pabellón A · 1er piso».

## Reglas

**Aulas (US09)**

- Nombre único, ubicación opcional y aforo entero mayor a 0.
- Se desactivan, no se borran. Un aula que usan secciones activas de un año no cerrado no se desactiva hasta quitarla de ellas.
- Su aforo no puede quedar por debajo del de esas secciones.
- Un aula desactivada no se asigna a ninguna sección.

**Secciones (US08)**

- Pertenecen a un año que no esté `CERRADO` y a un grado activo. El nombre son letras (A, B, C…) y se guarda en mayúsculas.
- El nombre no se repite en el mismo grado y año (índice único de `seccion`).
- `aforoMaximo` es un entero mayor a 0. Si tiene aula, no puede superar su aforo: lo valida el trigger `tg_seccion_aforo_aula` y su mensaje llega con ambos números.
- El aula y el tutor son opcionales; el tutor debe ser un docente activo.
- Solo se elimina una sección sin matrículas (en cualquier estado) ni otros registros (cursos asignados, horarios…). Si no, se inactiva: deja de recibir matrículas y conserva a sus alumnos.

**Para la matrícula.** `vacantesSeccion(seccionId)` (en `@/modules/academico`) devuelve `{ seccionId, estado, matriculados, aforo, disponibles, completo }`. `verificarVacantes(estado, vacantes)` rechaza con `409 SECCION_SIN_VACANTES` («Sección sin vacantes disponibles (30/30)») o `409 SECCION_INACTIVA`.

## Códigos de error

| Código | HTTP | Cuándo |
|---|---|---|
| `DATOS_INVALIDOS` | 400 | Falta un campo o tiene formato incorrecto. El aforo: «El aforo debe ser un número entero mayor a 0» |
| `NOMBRE_SECCION_INVALIDO` | 400 | El nombre de la sección no son solo letras |
| `NO_ENCONTRADO` | 404 | El año, la sección, el grado o el aula no existen |
| `SECCION_DUPLICADA` | 409 | «Ya existe una sección con ese nombre en este grado» |
| `SECCION_CON_MATRICULADOS` | 409 | «No se puede eliminar una sección con alumnos matriculados…» (sugiere inactivarla) |
| `SECCION_CON_REGISTROS` | 409 | La sección tiene cursos, horarios u otros registros |
| `AULA_DUPLICADA` | 409 | Ya existe un aula con ese nombre |
| `AULA_EN_USO` | 409 | Se intentó desactivar un aula asignada a secciones activas |
| `AFORO_EXCEDE_AULA` | 422 | El aforo de la sección supera el del aula (mensaje del trigger, con los dos números en `details`) |
| `AFORO_MENOR_QUE_SECCIONES` | 422 | El aforo nuevo del aula es menor que el de sus secciones |
| `AULA_INACTIVA` | 422 | Se intentó asignar un aula desactivada |
| `TUTOR_NO_DISPONIBLE` | 422 | El tutor no es un docente activo |
| `ANIO_CERRADO` | 422 | El año de la sección está cerrado |

## Auditoría

`CREAR_SECCION`, `EDITAR_SECCION`, `ACTIVAR_SECCION`, `INACTIVAR_SECCION`, `ELIMINAR_SECCION`, `CREAR_AULA`, `EDITAR_AULA`, `ACTIVAR_AULA` y `DESACTIVAR_AULA`, en la misma transacción que el cambio.

## Dependencias entre módulos

- Las vacantes y el bloqueo al eliminar leen `matricula` (de `matricula`) por el puerto `MatriculasProvider`, que implementa un módulo `matricula` mínimo.
- El tutor se valida y se muestra con `DocentesProvider`, que implementa `comunidad` (dueño de `docente`).

---

# Cursos y competencias (US10, US11)

Pantalla: AD-04 (`/admin/cursos`). Todas las rutas exigen el rol `ADMINISTRADOR`. Un **plan de estudio** es curso + grado + año, con sus horas semanales; sus competencias son las que se evalúan con la escala AD, A, B y C.

## Endpoints · solo `ADMINISTRADOR`

| Método y ruta | Cuerpo / consulta | Respuesta `data` |
|---|---|---|
| `GET /academico/areas` | — | `Area[]` activas: `{ id, codigo, nombre, competencias: { id, areaCurricularId, codigo, nombre, activo }[] }` |
| `GET /academico/cursos` | `?areaId=&estado=ACTIVO\|INACTIVO&anioId=` (todos opcionales) | `Curso[]`, activos primero y por nombre |
| `POST /academico/cursos` | `{ codigo, nombre, descripcion?, areaCurricularId, plan? }` | `201 Curso` `ACTIVO` |
| `PATCH /academico/cursos/{id}` | `{ codigo?, nombre?, descripcion?, areaCurricularId? }` (al menos uno) | `Curso` |
| `DELETE /academico/cursos/{id}` | — | `{ cursoId, eliminado: true }` |
| `POST /academico/cursos/{id}/estado` | `{ estado: "ACTIVO" \| "INACTIVO" }` | `Curso` |
| `GET /academico/cursos/{id}/planes` | `?anioId=` (obligatorio) | `{ cursoId, anioAcademicoId, grados: { grado, plan: PlanResumen \| null }[] }`, los 5 grados |
| `PUT /academico/cursos/{id}/planes` | `?anioId=` y `{ planes: { gradoId, horasSemanales }[] }` | Igual que el GET |
| `GET /academico/planes/{id}/competencias` | — | `{ plan, competencias, disponibles }` |
| `PUT /academico/planes/{id}/competencias` | `{ competencias: { competenciaId, orden?, peso? }[] }` | Igual que el GET |

- `Curso`: `{ id, codigo, nombre, descripcion, estado, areaCurricular: { id, codigo, nombre }, planes: PlanResumen[], competencias, uso }`. Con `anioId`, `planes` trae los grados de ese año y `competencias` cuenta las competencias distintas que evalúa; sin `anioId`, `planes` viene vacío.
- `uso`: `{ docentes, seccionesConHorario }`: docentes distintos con alguna asignación del curso y secciones con el curso en un horario publicado (de cualquier año). Son los datos «Docentes asignados» y «Horarios publicados» de AD-04.
- `PlanResumen`: `{ id, grado: { id, numero, nombre }, horasSemanales, competencias, asignaciones }`.
- `plan` (opcional en `POST /cursos`): `{ anioAcademicoId, grados: { gradoId, horasSemanales }[], competencias: competenciaId[] }`. Crea el curso, sus grados del año y las mismas competencias en cada grado, todo en una transacción (formulario «Registrar nuevo curso»).
- `PUT /cursos/{id}/planes` deja el curso exactamente en los grados enviados: agrega los nuevos, cambia horas y quita los que faltan (con sus competencias).
- `GET /planes/{id}/competencias`: `plan` = `{ id, anioAcademicoId, grado, horasSemanales, curso: { id, codigo, nombre, area } }`; `competencias` = `{ id, orden, peso, notas, competencia: { id, codigo, nombre } }[]` (el `id` es el de `competencia_plan`, que usan las notas); `disponibles` = competencias del área del curso.
- `PUT /planes/{id}/competencias` reemplaza la lista: el orden, si falta, es la posición en la lista; el `peso` es opcional.

## Reglas

**Cursos (US10)**

- Código único, de 2 a 12 letras, números o guiones; se guarda en mayúsculas («Ya existe un curso registrado con ese código»).
- Nombre obligatorio, descripción opcional y área curricular obligatoria y activa («Debe seleccionar el área curricular del curso»).
- El área no cambia mientras el curso tenga competencias configuradas (de su área actual).
- Un curso con docentes asignados o en un horario publicado no se elimina: «No se puede eliminar un curso asignado; desactívalo en su lugar». Sin uso, se elimina junto con sus planes de todos los años.
- Se desactiva y se activa con `/estado`: un curso inactivo conserva sus planes y notas.

**Grados del curso (plan de estudio del año)**

- Cada grado una vez, con horas semanales enteras de 1 a 40.
- Solo en un año que no esté `CERRADO`.
- No se quita un grado con docentes asignados o con notas registradas (`PLAN_EN_USO`).

**Competencias del plan (US11, RF09)**

- Una o más («Debes seleccionar al menos una competencia»), sin repetir.
- Solo del área curricular del curso: «La competencia no pertenece al área del curso».
- Una competencia desactivada en el catálogo no se agrega, pero puede quedarse si ya estaba.
- Peso opcional y mayor a 0. El orden es la posición en la lista si no se envía.
- No se quita una competencia con notas registradas: «No se puede eliminar una competencia con notas registradas.»
- Solo en un año que no esté `CERRADO`.

**Para el registro de notas.** `competenciasDelPlan(planEstudioId)` (en `@/modules/academico`) devuelve `{ competenciaPlanId, competenciaId, codigo, nombre, orden, peso }[]` en orden. `verificarCompetenciasConfiguradas(lista)` rechaza una lista vacía con `422 CURSO_SIN_COMPETENCIAS`: «Este curso no tiene competencias configuradas. Contacte al administrador.»

## Códigos de error

| Código | HTTP | Cuándo |
|---|---|---|
| `DATOS_INVALIDOS` | 400 | Falta un campo o tiene formato incorrecto (sin área: «Debe seleccionar el área curricular del curso»; horas o peso no válidos) |
| `CODIGO_CURSO_INVALIDO` | 400 | El código no tiene de 2 a 12 letras, números o guiones |
| `GRADO_REPETIDO` | 400 | Un grado aparece dos veces en los planes |
| `HORAS_INVALIDAS` | 400 | Horas semanales que no son un entero mayor a 0 |
| `COMPETENCIAS_REQUERIDAS` | 400 | La lista de competencias está vacía |
| `COMPETENCIA_DUPLICADA` | 400 | Una competencia aparece dos veces |
| `PESO_INVALIDO` | 400 | Peso de 0 o negativo |
| `AREA_REQUERIDA` | 400 | El área no existe o está desactivada |
| `NO_ENCONTRADO` | 404 | El curso, el año, el grado o el plan no existen |
| `CURSO_DUPLICADO` | 409 | «Ya existe un curso registrado con ese código» |
| `CURSO_ASIGNADO` | 409 | Eliminar un curso con docentes asignados o en un horario publicado (`details`: `{ docentes, seccionesConHorario }`) |
| `AREA_CON_COMPETENCIAS` | 409 | Cambiar el área de un curso que ya tiene competencias |
| `PLAN_EN_USO` | 409 | Quitar un grado con docentes asignados o notas |
| `COMPETENCIA_CON_NOTAS` | 409 | Quitar una competencia con notas (`details`: `{ competencia, notas }`) |
| `COMPETENCIA_FUERA_DEL_AREA` | 422 | La competencia no es del área del curso (RF09) |
| `COMPETENCIA_INACTIVA` | 422 | Agregar una competencia desactivada en el catálogo |
| `ANIO_CERRADO` | 422 | El año del plan está cerrado |

## Auditoría (RF03)

`CREAR_CURSO`, `EDITAR_CURSO`, `ACTIVAR_CURSO`, `DESACTIVAR_CURSO`, `ELIMINAR_CURSO` (entidad `curso`), `GUARDAR_PLAN_ESTUDIO` (entidad `curso`, con los grados y horas antes y después) y `GUARDAR_COMPETENCIAS_PLAN` (entidad `plan_estudio`, con los códigos antes y después), en la misma transacción que el cambio.

## Dependencias entre módulos

- Las notas por competencia se leen de `evaluacion` (dueño de `nota`) por el mismo puerto `CierresProvider`, que suma `notasPorCompetenciaPlan`.
- Las secciones con el curso en un horario publicado se leen de `horarios` (dueño de `horario` y `detalle_horario`) por el puerto nuevo `HorariosProvider`, que implementa un módulo `horarios` mínimo.
- Las asignaciones docentes (`asignacion_docente`) son de `academico`, así que se leen en su propio repositorio.
