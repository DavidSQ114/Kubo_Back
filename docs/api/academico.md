# API · Académico: año académico, periodos, grados, secciones y aulas (US06–US09)

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
