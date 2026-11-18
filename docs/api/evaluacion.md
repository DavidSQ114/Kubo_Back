# API · Evaluación: registro de notas cualitativas (US37), cierre y consolidación del bimestre (US39) y bloqueo del registro cerrado (US40)

Base: `/api/v1` · Formato: JSON · Éxito `{ "data": … }` · Error `{ "error": { "code", "message", "details" } }`
El `message` de los errores ya está redactado para mostrarse al usuario (RNF09). Pantallas: DO-04 «Registro de notas» (`/docente/notas`) y el modal M-10 «Cerrar registro del bimestre»; ver [frontend-notas.md](../frontend-notas.md). Casos de prueba en [pruebas/casos-sprint3-notas.md](../pruebas/casos-sprint3-notas.md) y ejemplos en [evaluacion.http](evaluacion.http).

La sesión, las cookies y qué hacer ante un `401` o un `403` están en [identidad.md](identidad.md).

## Modelo

- **Registro de notas** (`cierre_calificacion`): el de un curso y sección (asignación docente, US14) en un bimestre. Se crea `ABIERTO` con la primera nota guardada y pasa a `CERRADO` al cerrarlo (US39). `PUBLICADO` (US39, criterio 4) llega con la publicación a los apoderados, que no es de esta entrega. Guarda la versión de la regla de consolidación (`regla_consolidacion_id`) con la que se cerró, quién lo cerró y cuándo. Uno por asignación y bimestre (`@@unique`).
- **Nota** (`nota`): logro `AD`, `A`, `B` o `C` de un alumno (matrícula) en una competencia del plan (`competencia_plan`) dentro de un registro. Guarda quién la registró y cuándo (`registrado_por_id`, `created_at`) y, si se cambió, el **valor anterior**, quién lo cambió y cuándo (`logro_anterior`, `modificado_por_id`, `modificado_en`). La bitácora completa de cambios de notas es US03, que no es de esta entrega.
- **Resultado consolidado** (`resultado_consolidado`): logro del curso de cada alumno al cerrar, con `detalle_calculo` (la versión de la regla, el método, el criterio de desempate y los logros con sus pesos).
- **Trigger `tg_nota_registro_cerrado`** (migración `notas_cambios_y_bloqueo`): ninguna nota se crea ni se cambia en un registro `CERRADO` o `PUBLICADO`, aunque la escritura no pase por la aplicación (US40). La aplicación lo traduce a `409 REGISTRO_CERRADO`.

## Endpoints

Todos son **solo del Docente** y solo para sus propios cursos y secciones (asignaciones activas): el docente sale de la sesión, nunca de la URL.

| Método y ruta | Cuerpo | Respuesta `data` |
|---|---|---|
| `GET /evaluacion/registros` | — | `MisRegistros` |
| `GET /evaluacion/registros/{asignacionId}/bimestres/{periodoId}` | — | `RegistroDeNotas` |
| `PUT /evaluacion/registros/{asignacionId}/bimestres/{periodoId}/notas` | `{ notas: [{ matriculaId, competenciaPlanId, logro }] }` | `RegistroDeNotas` + `guardado: { nuevas, modificadas, sinCambio }` |
| `POST /evaluacion/registros/{asignacionId}/bimestres/{periodoId}/cerrar` | — | `RegistroDeNotas` cerrado + `aviso: { administradores, enviados }` |

- `MisRegistros`: `{ anio: { id, anio, estado } | null, bimestres: Bimestre[], bimestreActivoId, cursos: CursoDelDocente[] }`. El año es el `EN_CURSO` (o, si el docente no tiene cursos en él, su año más reciente). Sin cursos asignados, `anio` es `null` y las listas están vacías.
- `Bimestre`: `{ id, numero, nombre, fechaInicio, fechaFin, estado, activo }`. `activo` es `true` si hoy (en Lima) se califica en él: año `EN_CURSO`, hoy entre sus fechas y el bimestre no `FINALIZADO`.
- `CursoDelDocente`: `{ asignacionId, curso: { id, codigo, nombre }, grado, seccion: { id, nombre }, etiqueta («3° B»), estados }`. `estados` da el estado del registro en cada bimestre, por id de bimestre: `ABIERTO`, `CERRADO` o `PUBLICADO`.
- `RegistroDeNotas`:
  - `asignacionId`, `curso`, `seccion: { id, nombre, etiqueta }`, `anio: { id, anio }`, `bimestre: Bimestre`.
  - `estado`: `ABIERTO`, `CERRADO` o `PUBLICADO`. `cerradoEn` (UTC, ISO 8601) y `cerradoPor` («J. Pérez») si está cerrado.
  - `editable`: el docente puede guardar y cerrar. Si no, `motivoSoloLectura` es `REGISTRO_CERRADO` o `PERIODO_NO_ACTIVO` y `mensaje` trae el texto del backlog. En un registro cerrado, `correccion` dice cómo pedir una corrección (ver US40).
  - `regla`: `{ version, nombre, metodo, criterioDesempate }` de la regla de consolidación: la usada al cerrar o, si está abierto, la que rige en el bimestre (US12). `null` si el año no tiene reglas.
  - `competencias`: `[{ competenciaPlanId, codigo, nombre, orden, peso }]`, en el orden del plan (columnas C1, C2…).
  - `alumnos`: `[{ matriculaId, nombre («Apellidos, Nombres»), notas, completo, consolidado }]`, por apellido. `notas` va por `competenciaPlanId`: `{ logro, logroAnterior, registradoPor, registradoEn, modificadoPor, modificadoEn }`. `consolidado` es el logro guardado al cerrar o, en un registro abierto con todas las competencias del alumno, el que resultaría con la regla del bimestre (vista previa); `null` si le faltan competencias.
  - `avance`: `{ calificadas, total, porcentaje, alumnosPendientes }` («Avance del registro: 72 %»).
  - `pendientes`: `Pendiente[]` (vacío si está completo o cerrado).
- `Pendiente`: `{ matriculaId, nombre, competencias: [{ competenciaPlanId, codigo, nombre }] }`.

## Reglas

**Registro de notas (US37)**

- Lista de alumnos: los que **hoy** tienen matrícula vigente (`MATRICULADO`) en la sección, según el historial de secciones; un alumno trasladado o retirado sale de la lista y sus notas se conservan. Columnas: las competencias del plan de estudio del curso en el grado (US11). Un curso sin competencias responde `422 CURSO_SIN_COMPETENCIAS` al guardar.
- Solo `AD`, `A`, `B` o `C` (mayúsculas). Cualquier otro valor, también por la API: `400 VALOR_NO_PERMITIDO` «Solo se permiten los valores AD, A, B o C», con `details.celdas: [{ matriculaId, competenciaPlanId, valor }]`. No se guarda nada del pedido.
- Se puede guardar una parte del registro y volver luego. Solo se envían las celdas que cambian; una celda con el mismo valor cuenta como `sinCambio`. Cada cambio guarda el logro anterior, quién y cuándo.
- Solo en el **bimestre activo**: año `EN_CURSO`, hoy (Lima) entre las fechas del bimestre y bimestre no `FINALIZADO`. Fuera de él, el registro se ve en solo lectura con «Este periodo de evaluación no está activo.» y las escrituras responden `422 PERIODO_NO_ACTIVO`.
- Para crear el registro hace falta una regla de consolidación para el bimestre (US12): si el año no tiene ninguna, `422 SIN_REGLA_CONSOLIDACION`.
- El primer guardado crea el registro con `INSERT … ON CONFLICT DO NOTHING` y cada guardado bloquea su fila (`SELECT … FOR UPDATE`): dos guardados o un guardado y un cierre del mismo registro se esperan uno al otro.

**Cierre y consolidación (US39)**

- Exige todas las competencias de todos los alumnos de la lista. Si falta alguna: `422 NOTAS_INCOMPLETAS` «Existen registros de notas incompletos», con `details.pendientes: Pendiente[]`. Una sección sin alumnos: `422 REGISTRO_SIN_ALUMNOS`.
- En una sola transacción, con la fila del registro bloqueada: vuelve a comprobar que siga abierto y completo, calcula el logro consolidado del curso de cada alumno con la **versión de la regla que rige en ese bimestre** (la más reciente cuyo «rige desde» es ese bimestre o uno anterior, aunque después haya quedado archivada, US12), guarda los resultados con el detalle del cálculo, guarda la versión usada en el registro y lo pasa a `CERRADO`. Registra `CERRAR_REGISTRO_NOTAS` en la bitácora.
- El cálculo es `consolidarLogro` de académico, el mismo de la vista previa de AD-05: **moda** con el criterio de desempate de la versión (mayor o menor jerarquía) o **promedio ponderado** con AD = 4, A = 3, B = 2, C = 1, los pesos de cada competencia del plan (US11) y redondeo al logro más cercano (la mitad sube).
- Dos cierres a la vez del mismo registro: el segundo espera el bloqueo y responde `409 REGISTRO_CERRADO`. Se consolida una sola vez.
- Después de confirmar el cierre, avisa por correo a los administradores activos que el registro de ese curso y sección está consolidado y listo para su publicación (`aviso.enviados`). Un fallo del correo no revierte el cierre. La notificación dentro de la aplicación es US55.

**Registro cerrado (US40)**

- Un registro `CERRADO` o `PUBLICADO` es de solo lectura, aunque su bimestre siga activo: `mensaje` «Este registro está cerrado y no puede modificarse directamente.» y `correccion` «Si necesitas corregir una nota, solicítalo al Administrador por el canal de soporte institucional.» (la rectificación, US41, no forma parte de esta entrega).
- Toda escritura sobre él responde `409 REGISTRO_CERRADO`, venga de la pantalla o directo por la API. En la base, el trigger `tg_nota_registro_cerrado` rechaza crear o cambiar notas aunque se intente fuera de la aplicación.

## Códigos de error

| Estado | Código | Cuándo |
|---|---|---|
| 400 | `VALOR_NO_PERMITIDO` | Un logro que no es `AD`, `A`, `B` o `C` («Solo se permiten los valores AD, A, B o C») |
| 400 | `DATOS_INVALIDOS` | Ids no válidos, lista vacía, más de 500 notas o la misma celda dos veces |
| 401 | `NO_AUTENTICADO` | Sin sesión |
| 403 | `ACCESO_DENEGADO` | Otro perfil, o un curso o sección que no es del docente (o una asignación ya desactivada) |
| 404 | `NO_ENCONTRADO` | La asignación no existe, o el bimestre no es del año del curso |
| 409 | `REGISTRO_CERRADO` | Escritura o cierre sobre un registro cerrado (también el segundo de dos cierres simultáneos) |
| 422 | `PERIODO_NO_ACTIVO` | Escritura fuera del bimestre activo («Este periodo de evaluación no está activo.») |
| 422 | `NOTA_FUERA_DEL_REGISTRO` | Un alumno que no está en la lista o una competencia que no es del curso |
| 422 | `NOTAS_INCOMPLETAS` | Cierre con competencias sin calificar; `details.pendientes` |
| 422 | `REGISTRO_SIN_ALUMNOS` | Cierre de una sección sin alumnos con matrícula vigente |
| 422 | `SIN_REGLA_CONSOLIDACION` | El año no tiene una regla de consolidación para el bimestre |
| 422 | `CURSO_SIN_COMPETENCIAS` | El plan del curso no tiene competencias (académico, US11) |

## Auditoría (RF03)

| Acción | Entidad | Valor anterior | Valor nuevo |
|---|---|---|---|
| `CERRAR_REGISTRO_NOTAS` | `cierre_calificacion` | `{ estado }` | `{ estado: "CERRADO", anio, curso, seccion, bimestre, regla: { version, metodo, criterioDesempate }, estudiantes, competencias, notas, consolidados: { AD, A, B, C } }` |

Cada cambio de nota guarda en la propia nota el valor anterior, quién y cuándo; la bitácora de cada cambio con filtros es US03.

## Dependencias entre módulos

`evaluacion` está por encima de `academico`, `comunidad` y `matricula` y los usa por su `index.ts`:

- `academico`: `asignacionParaNotas` (curso, sección, año y plan de la asignación), `competenciasDelPlan`, `listarAsignaciones`, `listarAnios`, `reglaDelBimestre` (versión de la regla que rige en un bimestre, nueva en este bloque) y `consolidarLogro` (US12).
- `comunidad`: `docentesProviderComunidad` (docente en sesión), `resumenEstudiantes`, `nombresDeUsuarios` y `contactosDeAdministradores` (nueva en este bloque).
- `matricula`: `matriculasDeSeccionEnFecha` y `datosDeMatriculas`.

Académico sigue consultando los cierres y las notas por su puerto `CierresProvider`, que implementa evaluación.
