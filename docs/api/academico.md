# API · Académico: año, periodos, grados, secciones, aulas, cursos, competencias, reglas, asignaciones y montos del año (US06–US12, US14, US21)

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
| `DELETE /academico/anios/{id}` | — | `{ id, eliminado: true }` |
| `GET /academico/anios/actual` | — | `SituacionAnio` o `null` · **cualquier rol con sesión** |
| `POST /academico/anios/{id}/estado` | `{ estado }` | `AnioAcademico` con el nuevo estado |
| `GET /academico/anios/{id}/periodos` | — | `Periodo[]` ordenados por número |
| `PUT /academico/anios/{id}/periodos` | `{ periodos: [{ numero, fechaInicio, fechaFin }] × 4 }` | `Periodo[]` guardados |

- `AnioAcademico`: `{ id, anio, fechaInicio, fechaFin, estado, periodos: Periodo[] }`.
- `Periodo`: `{ id, numero, nombre, fechaInicio, fechaFin, estado, vigente }` (en `GET …/periodos` también `anioAcademicoId` y no trae `vigente`). El nombre lo pone el sistema: «Bimestre I» … «Bimestre IV». Un bimestre nuevo nace `INACTIVO`. `vigente` es `true` si el año está `EN_CURSO` y hoy (en Lima) cae en ese bimestre: AD-02 lo marca «Vigente»; no es un estado guardado.
- `SituacionAnio`: `{ anio, estado, detalle, etiqueta }` del año por defecto (el `EN_CURSO`, si no el `EN_MATRICULA`, si no el abierto más reciente). `etiqueta` es la insignia de la barra superior: «Año 2026 · En matrícula», «Año 2026 · Bimestre IV en curso» (año en curso y hoy dentro de un bimestre) o «Año 2026 · Vacaciones» (en curso, fuera de los bimestres); en otros estados, el nombre del estado. Sin años abiertos, `null` y la insignia no se muestra.
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
- `PATCH` solo cambia número y fechas; los bimestres ya guardados deben seguir dentro del nuevo rango. AD-02 («Editar año») solo envía las fechas: el número sigue debiendo coincidir con la fecha de inicio.
- `DELETE` solo elimina un año `PLANIFICADO` sin secciones, planes de estudio ni matrículas. Borra también sus bimestres, sus versiones de regla y sus parámetros propios.

**Periodos de evaluación (US07)**

- Se guardan los 4 bimestres juntos (números 1 a 4, sin repetir).
- Cada bimestre: fin posterior al inicio y dentro del rango del año.
- Los bimestres no pueden solaparse entre sí y van en orden: cada uno empieza después de que termina el anterior.
- Un bimestre `FINALIZADO` no cambia: sus fechas deben llegar iguales (se pueden editar los demás). En AD-02 los bimestres se muestran sin edición hasta pulsar «Editar bimestres».

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
| `ANIO_NO_ELIMINABLE` | 409 | «Solo se puede eliminar un año en estado «Planificado». Este año está «…».» |
| `ANIO_CON_REGISTROS` | 409 | «No se puede eliminar el año porque ya tiene secciones, planes de estudio o matrículas. Puedes editar sus fechas.» (`details`: `{ secciones, planes, matriculas }`) |
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
| `ELIMINAR_ANIO_ACADEMICO` | año, fechas y bimestres → — |
| `CAMBIAR_ESTADO_ANIO_ACADEMICO` | `{ estado }` → `{ estado }` |
| `GUARDAR_PERIODOS_EVALUACION` | bimestres antes → después |

## Dependencias entre módulos

`academico` no lee `cierre_calificacion` (es de `evaluacion`): declara el puerto `CierresProvider` en `puertos.ts`, `evaluacion` lo implementa y `src/server/wiring.ts` los conecta. Para eliminar un año cuenta sus matrículas con `MatriculasProvider.matriculasDelAnio` (dueño: `matricula`).

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
- Peso opcional y mayor a 0, en **todas** las competencias del plan o en **ninguna** (`400 PESOS_INCOMPLETOS`, Sprint 2): el promedio ponderado (US12) no tiene un cálculo claro con pesos a medias. AD-04 muestra los pesos solo si la regla vigente del año es «Promedio ponderado». El orden es la posición en la lista si no se envía.
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
| `PESOS_INCOMPLETOS` | 400 | «Indica el peso de todas las competencias del curso o de ninguna.» |
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

---

# Reglas de consolidación (US12, RF10)

Pantalla: AD-05 «Reglas de evaluación» (`/admin/reglas`). Todas las rutas exigen el rol `ADMINISTRADOR`. La regla dice cómo se calcula un logro a partir de varios: el cierre del bimestre (US39, Sprint 3) usará la regla vigente del año.

## Endpoints · solo `ADMINISTRADOR`

| Método y ruta | Cuerpo | Respuesta `data` |
|---|---|---|
| `GET /academico/anios/{id}/reglas` | — | `ReglasDelAnio` |
| `POST /academico/anios/{id}/reglas` | `{ metodo, criterioDesempate?, rigeDesdeId? }` | `201 ReglasDelAnio` con la nueva versión vigente |
| `POST /academico/reglas/simular` | `{ metodo, criterioDesempate?, logros: Logro[], pesos?: (number \| null)[] }` | `{ logro, frecuencias, empatados, promedio }` |

- `ReglasDelAnio`: `{ anio: { id, anio, estado }, editable, vigente: VersionRegla | null, historial: VersionRegla[], periodos }`. `editable` es `false` si el año está `CERRADO`. `historial` va de la versión más nueva a la más antigua e incluye la vigente.
- `VersionRegla`: `{ id, version, nombre, metodo, criterioDesempate, estado: "VIGENTE" | "ARCHIVADA", rigeDesde: { id, numero, nombre } | null, aplicadaA, responsable, creadaEn }`. `aplicadaA` es el texto de la columna del historial: «Desde Bimestre III», «Bimestres I y II», «Todo el año» o «Sin aplicar (reemplazada)». `responsable` es «Nombre Apellido» de quien la guardó.
- `periodos`: `{ id, numero, nombre, estado, cerrado }[]`. `cerrado` es `true` si el bimestre está `FINALIZADO` o tiene algún cierre de calificación `CERRADO` o `PUBLICADO`.
- `metodo`: `MODA` o `PONDERADO`. `criterioDesempate`: `MAYOR_JERARQUIA` (por defecto) o `MENOR_JERARQUIA`; en el ponderado no se usa y se guarda `MAYOR_JERARQUIA`.
- `simular`: `frecuencias` cuenta cada logro (`{ AD, A, B, C }`), `empatados` lista los logros empatados en la moda (vacío si no hay empate) y `promedio` es el valor del ponderado sin redondear (`null` en la moda). No guarda nada: es la vista previa de AD-05.

## Reglas

**Cálculo (`consolidarLogro`)**

- **Moda:** el logro que más se repite. Si empatan dos o más, decide el criterio: `MAYOR_JERARQUIA` elige el más alto (AD > A > B > C) y `MENOR_JERARQUIA`, el más bajo. Los pesos no cuentan.
- **Promedio ponderado:** AD = 4, A = 3, B = 2, C = 1. Cada logro se multiplica por su peso (`competencia_plan.peso`) y se divide entre la suma de pesos. Sin pesos (o todos `null`), todos pesan igual. Los pesos son relativos: 25/25/50 da lo mismo que 1/1/2.
- **Redondeo del ponderado:** al logro más cercano. **Un empate exacto ,5 sube al logro mayor** (`MITAD_HACIA_ARRIBA`): 1,5 → B, 2,5 → A, 3,5 → AD. Así un estudiante a medio camino no baja de nivel. Antes de redondear se conservan 6 decimales, para que un 3,4999999… de coma flotante cuente como 3,5.
- Lista vacía → `422 LOGROS_VACIOS`. Un peso por logro, todos o ninguno, y mayores a 0 (`PESOS_NO_CORRESPONDEN`, `PESOS_INCOMPLETOS`, `PESO_INVALIDO`).

**Versiones**

- Cada guardado crea una versión nueva (`version` + 1, empezando en 1) en estado `VIGENTE`; la anterior pasa a `ARCHIVADA` y queda como historial de solo lectura. No se editan versiones. Una sola vigente por año (`uq_regla_vigente_por_anio`).
- La versión rige desde el bimestre elegido (`rigeDesdeId`). Si el año tiene bimestres es obligatorio y debe ser un bimestre del año que no esté cerrado. Sin bimestres, rige desde el inicio del año (`rigeDesde: null`).
- Un bimestre usa la versión más reciente cuyo «rige desde» es ese bimestre o uno anterior (`versionAplicable`). Los bimestres ya cerrados conservan la versión con que se calcularon: AD-05 avisa «Este cambio no afectará los bimestres ya cerrados» antes de confirmar.
- Guardar el mismo método y criterio que la vigente → `409 REGLA_SIN_CAMBIOS`.
- Año `CERRADO` → `422 ANIO_CERRADO`.
- La configuración guardada (`configuracion`) incluye la escala, el redondeo y quién la registró, para que el cálculo sea reproducible.

**Fuera de alcance.** «El docente no puede cerrar el bimestre sin calificar todas las competencias» es parte del cierre de bimestre (US39, Sprint 3). AD-05 lo muestra bloqueado.

**Para otros módulos.** `@/modules/academico` exporta `consolidarLogro(logros, regla, pesos?)`, `versionAplicable(versiones, numeroBimestre)`, `LOGROS`, `VALOR_LOGRO` y `REDONDEO_PONDERADO`. Ejemplo para US39:

```ts
import { consolidarLogro } from "@/modules/academico";
const logro = consolidarLogro(["AD", "A", "AD", "A"], { metodo: "MODA", criterioDesempate: "MAYOR_JERARQUIA" }); // "AD"
```

## Códigos de error

| Código | HTTP | Cuándo |
|---|---|---|
| `DATOS_INVALIDOS` | 400 | Método o criterio no válidos (`ULTIMO_REGISTRO` no se configura en US12), logros que no son AD, A, B o C |
| `RIGE_DESDE_REQUERIDO` | 400 | «Elige el bimestre desde el que regirá la nueva versión.» |
| `PESOS_INCOMPLETOS` | 400 | «Indica el peso de todas las competencias del curso o de ninguna.» |
| `PESOS_NO_CORRESPONDEN` | 400 | Simulación con una cantidad de pesos distinta a la de logros |
| `PESO_INVALIDO` | 400 | Peso de 0 o negativo |
| `NO_ENCONTRADO` | 404 | El año no existe |
| `REGLA_SIN_CAMBIOS` | 409 | «La regla vigente ya usa ese método y criterio de desempate.» |
| `RIGE_DESDE_INVALIDO` | 422 | «El bimestre elegido no pertenece a este año académico.» |
| `RIGE_DESDE_CERRADO` | 422 | «Ese bimestre ya está cerrado: la nueva versión debe regir desde un bimestre abierto.» |
| `LOGROS_VACIOS` | 422 | «No hay logros para consolidar.» |
| `ANIO_CERRADO` | 422 | El año está cerrado |

## Auditoría (RF03)

`CREAR_VERSION_REGLA_CONSOLIDACION` (entidad `regla_consolidacion`): versión anterior (método, criterio, rige desde) → nueva, en la misma transacción.

## Dependencias entre módulos

- Los bimestres con cierres cerrados o publicados se leen de `evaluacion` por `CierresProvider.periodosConCierres`.
- El nombre del responsable se lee de `comunidad` por el puerto nuevo `PersonasProvider`.

---

# Asignación de cursos a docentes (US14)

Pantalla: AD-07 (`/admin/usuarios/registrar-docente`), bloque «Carga académica». El docente ve lo suyo en «Mis cursos» (`/inicio`). Una asignación es plan de estudio (curso + grado + año) + sección + docente, con `activo`.

## Endpoints

| Método y ruta | Rol | Cuerpo / consulta | Respuesta `data` |
|---|---|---|---|
| `GET /academico/asignaciones` | `ADMINISTRADOR` | `?docenteId=` (obligatorio) `&anioId=` (opcional) | `Asignacion[]` activas, por año, grado, sección y curso |
| `POST /academico/asignaciones` | `ADMINISTRADOR` | `{ docenteId, seccionId, cursoId }` | `201 Asignacion` |
| `DELETE /academico/asignaciones/{id}` | `ADMINISTRADOR` | — | `{ asignacionId, resultado: "ELIMINADA" \| "DESACTIVADA" }` |
| `GET /academico/mis-cursos` | `DOCENTE` | — | `Asignacion[]` activas del docente en sesión, de todos los años |

- `Asignacion`: `{ id, docenteId, anio: { id, anio }, curso: { id, codigo, nombre }, grado: { id, numero, nombre }, seccion: { id, nombre }, horasSemanales, horarioPublicado }`.
- El curso se busca en el plan de estudios del grado y año de la sección: la asignación guarda ese `plan_estudio`.

## Reglas

- El año de la sección no puede estar `CERRADO`. El docente, la sección y el curso deben estar activos.
- El curso debe dictarse en el grado y año de la sección (tener plan de estudio): si no, «El curso no corresponde al grado de la sección».
- Un curso tiene un solo docente activo por sección (índice `uq_asignacion_activa`):
  - Si es el mismo docente: «Este docente ya tiene asignado este curso en esta sección».
  - Si es otro docente: «Este curso ya tiene otro docente asignado en esta sección». Si dos administradores asignan a la vez, el índice deja pasar solo una asignación y la otra recibe este mismo mensaje, no un 500.
  - Si el mismo docente tenía esa asignación desactivada, se reactiva en vez de crear otra fila.
- Al quitar una asignación:
  - Con notas u horarios, se desactiva (`activo = false`) y conserva su historia.
  - Sin ellos, se elimina.
  - Si otra tabla todavía la referencia (cierres, material…), también se desactiva.

## Códigos de error

| Código | HTTP | Cuándo |
|---|---|---|
| `DATOS_INVALIDOS` | 400 | Falta el docente, la sección o el curso, o un id no es válido |
| `NO_ENCONTRADO` | 404 | El docente, la sección, el curso o la asignación no existen |
| `ASIGNACION_DUPLICADA` | 409 | «Este docente ya tiene asignado este curso en esta sección» |
| `CURSO_CON_DOCENTE` | 409 | «Este curso ya tiene otro docente asignado en esta sección» |
| `CURSO_NO_CORRESPONDE` | 422 | «El curso no corresponde al grado de la sección» |
| `DOCENTE_INACTIVO` | 422 | «El docente está inactivo y no puede recibir cursos.» |
| `SECCION_INACTIVA` | 422 | «La sección está inactiva. Actívala antes de asignarle cursos.» |
| `CURSO_INACTIVO` | 422 | «El curso está inactivo. Actívalo en «Cursos y competencias» para asignarlo.» |
| `ANIO_CERRADO` | 422 | «El año académico está cerrado y ya no se puede modificar.» |

## Auditoría (RF03)

`ASIGNAR_CURSO_DOCENTE` (con `reactivada` si volvió a activarse) y `QUITAR_ASIGNACION_DOCENTE` (con `resultado`: `ELIMINADA` o `DESACTIVADA`), entidad `asignacion_docente`, en la misma transacción.

## Dependencias entre módulos

- El docente se valida con `DocentesProvider` (comunidad), que suma `docentePorPersona` para «Mis cursos».
- Las notas de la asignación se cuentan con `CierresProvider.notasPorAsignacion` (evaluacion).
- Los bloques de horario y si alguno está publicado salen de `HorariosProvider.horariosPorAsignacion` (horarios).

# Montos del año (US21)

Requisito del cronograma de pagos: la cuota de matrícula y la pensión mensual de cada año. Se guardan en `parametro_institucion` con el año (`anio_academico_id`) y las claves `MONTO_MATRICULA` y `MONTO_PENSION`, como texto «350.00» (nunca float). Los parámetros generales del seed (sin año) solo se sugieren al configurar: **un año sin montos propios no admite matrículas** (`422 SIN_MONTOS`, ver [matricula.md](matricula.md)).

## Endpoints · solo `ADMINISTRADOR`

| Método y ruta | Cuerpo | Respuesta `data` |
|---|---|---|
| `GET /academico/anios/{id}/montos` | — | `{ anioAcademicoId, anio, montoMatricula, montoPension, configurados, sugeridos: { montoMatricula, montoPension } }` |
| `PUT /academico/anios/{id}/montos` | `{ montoMatricula, montoPension }` | Lo mismo, con los montos guardados |

## Reglas

- Cada monto: mayor a 0, hasta dos decimales y hasta S/ 99 999.99 (texto «350», «450.5» o número). Se guardan normalizados («450.50»). Si no: `400 MONTO_INVALIDO` «Ingresa un monto mayor a 0 con hasta dos decimales (por ejemplo, 350.00).».
- Año cerrado: `422 ANIO_CERRADO`. Año inexistente: `404 NO_ENCONTRADO`.
- Los cambios solo afectan a las matrículas que se confirmen después: los cronogramas ya generados no cambian.
- Auditoría `GUARDAR_MONTOS_ANIO` (entidad `anio_academico`) con los montos anteriores y nuevos.

## Dependencias entre módulos

- matricula los lee con `montosDelAnio` y bloquea la sección con `seccionBloqueadaParaMatricula(tx, id)` (`SELECT … FOR UPDATE`), ambos por el `index.ts` de académico.
