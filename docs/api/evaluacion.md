# API · Evaluación: registro de notas (US37), cierre, consolidación y publicación del bimestre (US39), bloqueo del registro cerrado (US40), libreta del apoderado (US46, US26), «Mis notas» del alumno (US51), libreta en PDF (US66), rectificación de nota (US41), bitácora de notas (US03), evidencias pedagógicas (US38, US47), ítems de evaluación con pesos y reportes del coordinador (bloque M2)

> **Bloque M1:** la configuración académica, la matrícula, los pagos, los horarios, las notas y la asistencia de alumnos son del rol `COORDINADOR` (Coordinador académico); usuarios, aulas, parámetros, asistencia docente y auditoría, del `ADMINISTRADOR`. La tabla exacta de cada endpoint está en [ACCESOS.md](../ACCESOS.md).

Base: `/api/v1` · Formato: JSON · Éxito `{ "data": … }` · Error `{ "error": { "code", "message", "details" } }`
El `message` de los errores ya está redactado para mostrarse al usuario (RNF09). Pantallas: DO-04 «Registro de notas» (`/docente/notas`) y el modal M-10 «Cerrar registro del bimestre» ([frontend-notas.md](../frontend-notas.md)); AD-15, AP-04, AP-06 y AL-03 ([frontend-notas-visibles.md](../frontend-notas-visibles.md)); M-08, la bandeja de AD-15 y AD-16 «Cambios de notas» ([frontend-rectificacion-notas.md](../frontend-rectificacion-notas.md)); M-07 y M-09, las evidencias en DO-04, AP-04 y AL-03 ([frontend-evidencias.md](../frontend-evidencias.md)). Casos de prueba en [pruebas/casos-sprint3-notas.md](../pruebas/casos-sprint3-notas.md), [pruebas/casos-sprint3-notas-visibles.md](../pruebas/casos-sprint3-notas-visibles.md), [pruebas/casos-sprint3-rectificacion.md](../pruebas/casos-sprint3-rectificacion.md) [pruebas/casos-sprint4-evidencias.md](../pruebas/casos-sprint4-evidencias.md) y [pruebas/casos-sprint4-items.md](../pruebas/casos-sprint4-items.md); ejemplos en [evaluacion.http](evaluacion.http).

La sesión, las cookies y qué hacer ante un `401` o un `403` están en [identidad.md](identidad.md).

## Modelo

- **Registro de notas** (`cierre_calificacion`): el de un curso y sección (asignación docente, US14) en un bimestre. Se crea `ABIERTO` con la primera nota guardada y pasa a `CERRADO` al cerrarlo (US39). El Coordinador académico lo pasa a `PUBLICADO` al publicarlo (US39, criterio 4; ver [Publicación de notas](#publicación-de-notas-us39-criterio-4)): solo entonces lo ven el apoderado y el alumno. Guarda la versión de la regla de consolidación (`regla_consolidacion_id`) con la que se cerró, quién lo cerró y cuándo. Uno por asignación y bimestre (`@@unique`).
- **Nota** (`nota`): logro `AD`, `A`, `B` o `C` de un alumno (matrícula) en una competencia del plan (`competencia_plan`) dentro de un registro. Guarda quién la registró y cuándo (`registrado_por_id`, `created_at`) y, si se cambió, el **valor anterior**, quién lo cambió y cuándo (`logro_anterior`, `modificado_por_id`, `modificado_en`). Cada creación o cambio queda además en la bitácora de notas (US03, ver [Bitácora de notas](#bitácora-de-notas-us03)).
- **Resultado consolidado** (`resultado_consolidado`): logro del curso de cada alumno al cerrar, con `detalle_calculo` (la versión de la regla, el método, el criterio de desempate y los logros con sus pesos).
- **Trigger `tg_nota_registro_cerrado`** (migración `notas_cambios_y_bloqueo`, ampliado en `bitacora_y_rectificacion_notas`): ninguna nota se crea ni se cambia en un registro `CERRADO` o `PUBLICADO`, aunque la escritura no pase por la aplicación (US40). La única excepción es el cambio de una rectificación aprobada (US41). La aplicación lo traduce a `409 REGISTRO_CERRADO`.
- **Trigger `tg_nota_borrado_registro_cerrado`** (migración `nota_borrado_registro_cerrado`, D-15): tampoco se borra una nota de un registro `CERRADO` o `PUBLICADO`, con el mismo mensaje y sin excepciones (una rectificación cambia la nota, no la borra). La aplicación no tiene ninguna operación que borre notas; borrar el registro completo (`cierre_calificacion`) arrastra sus notas por la cascada, y ningún flujo lo hace (ver [AD-16](../arquitectura/AD-16-bitacora-notas.md)).
- **Solicitud de rectificación** (`solicitud_rectificacion`): pedido del docente para corregir una nota de un registro cerrado o publicado (US41), con el valor anterior, el solicitado, el motivo, quién la pidió y, al resolverla, quién, cuándo y el motivo del rechazo.
- **Bitácora de notas** (`bitacora_nota`): una fila inmutable por cada nota registrada o cambiada (US03).
- **Evidencia pedagógica** (`evidencia_pedagogica`): comentario y/o archivo del docente sobre una nota (US38). Ver [Evidencias pedagógicas](#evidencias-pedagógicas-us38-y-su-consulta-us47).

## Endpoints del docente

Todos son **solo del Docente** y solo para sus propios cursos y secciones (asignaciones activas): el docente sale de la sesión, nunca de la URL.

| Método y ruta | Cuerpo | Respuesta `data` |
|---|---|---|
| `GET /evaluacion/registros` | — | `MisRegistros` |
| `GET /evaluacion/registros/{asignacionId}/bimestres/{periodoId}` | — | `RegistroDeNotas` |
| `PUT /evaluacion/registros/{asignacionId}/bimestres/{periodoId}/notas` | `{ notas: [{ matriculaId, competenciaPlanId, logro }] }` | `RegistroDeNotas` + `guardado: { nuevas, modificadas, sinCambio }` |
| `POST /evaluacion/registros/{asignacionId}/bimestres/{periodoId}/cerrar` | — | `RegistroDeNotas` cerrado + `aviso: { coordinadores, enviados }` |

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
- Después de confirmar el cierre, avisa por correo a los coordinadores académicos activos que el registro de ese curso y sección está consolidado y listo para su publicación (`aviso.enviados`). Un fallo del correo no revierte el cierre: queda en la bandeja de salida y se reintenta. En la misma transacción del cierre se notifica a los coordinadores académicos dentro de la aplicación (US55, [notificaciones.md](notificaciones.md)).

**Registro cerrado (US40)**

- Un registro `CERRADO` o `PUBLICADO` es de solo lectura, aunque su bimestre siga activo: `mensaje` «Este registro está cerrado y no puede modificarse directamente.» y `correccion` «Si detectas un error, envía una solicitud de rectificación a la administración.» (ver [Rectificación de nota](#rectificación-de-nota-us41)).
- Toda escritura sobre él responde `409 REGISTRO_CERRADO`, venga de la pantalla o directo por la API. En la base, el trigger `tg_nota_registro_cerrado` rechaza crear o cambiar notas y `tg_nota_borrado_registro_cerrado` rechaza borrarlas (D-15), aunque se intente fuera de la aplicación.

## Ítems de evaluación con pesos (bloque M2)

Cada competencia de un registro (asignación y bimestre) puede tener **ítems de evaluación** (prácticas, exposiciones,
examen…) con nombre y peso. El docente califica cada ítem con `AD`, `A`, `B` o `C` y la nota de la competencia se
**calcula**. Una competencia **sin** ítems se sigue calificando directo, como siempre; los registros anteriores no
cambian. Pantalla: DO-04, botón «Ítems» de cada competencia ([frontend-items-evaluacion.md](../frontend-items-evaluacion.md)).

**Modelo** (migración `items_evaluacion`):

- `item_evaluacion`: `cierre_id` (el registro), `competencia_plan_id`, `nombre` (1 a 100 caracteres,
  `ck_item_evaluacion_nombre`), `peso` `numeric(5,2)` mayor que 0 y hasta 100 (`ck_item_evaluacion_peso`), `orden`.
- `calificacion_item`: `item_id`, `matricula_id`, `valor` (`Logro`), `registrado_por_id`; única por ítem y matrícula.
- Triggers `tg_item_evaluacion_registro_cerrado` y `tg_calificacion_item_registro_cerrado`: con el registro `CERRADO`
  o `PUBLICADO` no se crea, cambia ni borra ningún ítem ni calificación, con el mismo mensaje `REGISTRO_CERRADO` (sin
  excepción para las rectificaciones).
- `bitacora_nota.origen` admite `ITEMS` y `logro_nuevo` admite `null` (la nota se quitó).

**Cálculo de la nota**

- Promedio ponderado de las calificaciones con AD = 4, A = 3, B = 2, C = 1 y redondeo `MITAD_HACIA_ARRIBA`, con la
  misma función de la regla `PONDERADO` de académico (`consolidarLogro`), no una copia. Ejemplo: AD (40) y B (60) →
  2,8 → A; A (50) y B (50) → 2,5 → A.
- Solo se calcula si los pesos de la competencia suman **exactamente 100** (se suman en centésimas: 33,33 + 33,33 +
  33,34 = 100) y el alumno tiene **todos** sus ítems calificados. Si no, la competencia queda **sin nota** para ese
  alumno y `sinNota` dice por qué: «Los pesos de los ítems suman 90 %; deben sumar 100 %.» o «Falta calificar el ítem:
  Examen bimestral.».
- La nota calculada se guarda en `nota` en la **misma transacción** que las calificaciones o los ítems, con el valor
  anterior y una fila en la bitácora con origen `ITEMS` (también cuando se quita: `logro_nuevo` null).
- Una competencia con ítems no acepta nota directa: `422 COMPETENCIA_CON_ITEMS`. Si se eliminan todos sus ítems, vuelve
  a calificarse directo y conserva la última nota calculada.
- El cierre (US39) no cambia: exige nota en todas las competencias, así que una competencia con ítems incompletos o
  pesos que no suman 100 deja al alumno pendiente.
- **Rectificación (US41)**: sigue siendo sobre la **nota de la competencia**. Con el registro cerrado, el docente pide
  la corrección de la nota (C1, C2…) y la coordinación la aprueba como siempre; las calificaciones de los ítems quedan
  como se registraron. La libreta muestra el detalle de ítems y la nota vigente (la rectificada, si la hubo).

**Endpoints** (solo el docente de la asignación, en el bimestre activo y con el registro `ABIERTO`; el registro se
crea si no existe y su fila se bloquea):

| Método y ruta | Cuerpo | Respuesta `data` |
|---|---|---|
| `PUT /evaluacion/registros/{asignacionId}/bimestres/{periodoId}/competencias/{competenciaPlanId}/items` | `{ items: [{ id?, nombre, peso }], confirmar? }` | `RegistroDeNotas` + `itemsGuardados: { creados, editados, eliminados, impacto, recalculo }` |
| `PUT /evaluacion/registros/{asignacionId}/bimestres/{periodoId}/notas` | `{ notas?: […], calificaciones?: [{ itemId, matriculaId, logro }] }` | `RegistroDeNotas` + `guardado: { nuevas, modificadas, sinCambio, calificaciones: { nuevas, modificadas }, recalculo }` |
| `POST /evaluacion/registros/{asignacionId}/bimestres/{periodoId}/items/{itemId}/importar` | `{ csv, confirmar? }` | `{ item, filas, validas, rechazadas, guardado }` |

- `PUT …/items` recibe la **lista completa** de la competencia, en orden: los ítems con `id` se editan y reordenan,
  los que no tienen `id` se crean y los que faltan se eliminan (con sus calificaciones). Hasta 20 ítems, nombres sin
  repetir. La suma puede no ser 100: se guarda y la competencia queda sin nota hasta completarla.
- Si el cambio borra calificaciones o deja alumnos sin nota (y borra las evidencias de esas notas), sin
  `confirmar: true` responde `409 CONFIRMAR_CAMBIO_ITEMS` con `details: { itemsEliminados, calificacionesBorradas,
  notasQuitadas, evidenciasBorradas }` y no cambia nada.
- `recalculo`: `{ calculadas, cambiadas, quitadas }` (notas creadas, cambiadas o quitadas por los ítems).
- `RegistroDeNotas` agrega, por competencia, `items: [{ id, nombre, peso, orden, calificaciones }]`, `sumaPesos` y
  `pesosCompletos`; por alumno, `calificaciones` (por id de ítem) y `sinNota: { [competenciaPlanId]: { motivo:
  "PESOS_INCOMPLETOS" | "ITEMS_PENDIENTES", mensaje } }`.
- `PUT …/notas` necesita al menos una nota o una calificación; hasta 500 notas y 2000 calificaciones. Un valor fuera de
  la escala en una calificación responde `400 VALOR_NO_PERMITIDO` con la celda (`itemId`) en `details.celdas`.
- **Importar CSV** (`…/importar`): archivo `dni,calificativo` (también con `;`, cabecera opcional, hasta 300 filas y
  50 000 caracteres). Sin `confirmar` devuelve cada fila (`linea`, `dni`, `calificativo`, `matriculaId`, `nombre`,
  `motivo`) sin guardar nada; motivos: DNI de 8 dígitos, valor de la escala, DNI repetido, alumno fuera del registro,
  columnas de más. Con `confirmar: true` guarda **solo las válidas** con el mismo guardado de `PUT …/notas`.

## Reportes del coordinador (bloque M2)

Solo el **Coordinador académico** (`ROLES_EVALUACION.REPORTES`). Pantallas `/coordinador/notas-alumno` y
`/coordinador/reporte-competencias`.

| Método y ruta | Consulta | Respuesta |
|---|---|---|
| `GET /evaluacion/reportes/logro-competencias` | `anioId?`, `periodoId?`, `gradoId?`, `seccionId?`, `cursoId?` | `ReporteLogro` |
| `GET /evaluacion/reportes/logro-competencias/csv` | la misma | `text/csv` (UTF-8 con BOM) |
| `GET /evaluacion/reportes/logro-competencias/pdf` | la misma | `application/pdf` |
| `GET /evaluacion/reportes/alumnos/{matriculaId}/notas` | — | `NotasDelAlumno` |

- **Reporte de logro de competencias**: solo registros `CERRADO` o `PUBLICADO` (los abiertos aún son del docente).
  Año por defecto: el que está en curso; bimestre por defecto: el último con registros cerrados. `ReporteLogro`:
  `{ anios, anio, bimestres, bimestre, grados, secciones, cursos, registros, resultados }`; `secciones` y `cursos` son
  las opciones con registros en ese año, bimestre y grado. Cada curso de `resultados`: `{ cursoId, codigo, nombre,
  secciones, competencias: [{ codigo, nombre, columna, conteo: { AD, A, B, C }, total, porcentajes }], consolidado,
  alumnos: [{ matriculaId, nombre, seccion, logros: { [codigo]: logro | null }, consolidado }] }`. Porcentajes con
  un decimal.
- **CSV**: `Año,Bimestre,Curso,Sección,Estudiante,Columna,Competencia,Logro`, una fila por alumno y competencia y otra
  con el «Logro del curso». Los campos que empiezan con `=`, `+`, `-` o `@` se neutralizan con `'`. Archivo
  `Reporte_logro_<Bimestre>_<Año>.csv` (sin datos personales en el nombre).
- **PDF** (platform/pdf): filtros, por curso la tabla por competencia con cantidad y porcentaje, y el detalle por alumno.
- **Notas por alumno**: la búsqueda por DNI o nombre es `GET /matricula/matriculas?anioId=&q=`. `NotasDelAlumno`:
  `{ matriculaId, estudiante: { nombreCompleto, dni }, anio, seccion, estadoMatricula, bimestres: [{ id, numero,
  nombre, cursos }] }`. Cada curso: `{ cursoId, codigo, nombre, docente, estado, etiquetaEstado, publicado,
  consolidado, competencias: [{ codigo, nombre, columna, logro, items }] }`. `estado`: `PUBLICADO`, `CERRADO`,
  `ABIERTO` o `SIN_REGISTRO` (curso del plan de su sección sin notas); `etiquetaEstado`: «Publicado», «Sin publicar ·
  cerrado», «Sin publicar · en registro» o «Sin publicar · sin notas».

## Publicación de notas (US39, criterio 4)

Pantalla AD-15 «Notas y rectificaciones» (`/coordinador/notas`). **Solo Coordinador académico.**

| Método y ruta | Cuerpo | Respuesta `data` |
|---|---|---|
| `GET /evaluacion/publicaciones?anioId=&periodoId=&gradoId=&seccionId=&cursoId=` | — | `Publicaciones` |
| `GET /evaluacion/publicaciones/{cierreId}` | — | `RegistroDeNotas` (solo lectura) |
| `POST /evaluacion/publicaciones` | `{ cierreIds: [uuid] }` (1 a 200) | `{ publicados: RegistroPublicable[], aviso: { apoderados, enviados } }` |

- `Publicaciones`: `{ anios, anio, bimestres, grados, porPublicar, publicados }`. Sin `anioId` se usa el año `EN_CURSO` (o el `EN_MATRICULA`, o el abierto más reciente). Todos los filtros son opcionales.
- `RegistroPublicable`: `{ cierreId, asignacionId, bimestre: { id, numero, nombre }, curso, grado, seccion: { id, nombre, etiqueta }, docente («J. Pérez»), estado: "CERRADO" | "PUBLICADO", cerradoEn, cerradoPor, publicadoEn, publicadoPor, estudiantes }`.
- `porPublicar` son los registros `CERRADO`; `publicados`, los `PUBLICADO`. Los registros `ABIERTO` no aparecen: sus notas aún son del docente. `GET …/{cierreId}` de un registro abierto responde `404 NO_ENCONTRADO`.
- **Publicar** pasa cada registro de `CERRADO` a `PUBLICADO` y guarda `publicado_por_id` y `publicado_en`. En una sola transacción bloquea cada fila (`FOR UPDATE`), vuelve a comprobar el estado y registra `PUBLICAR_NOTAS`. Si un registro del lote no se puede publicar, no se publica ninguno: uno abierto responde `409 REGISTRO_NO_CERRADO` y uno ya publicado, `409 REGISTRO_YA_PUBLICADO` (también el segundo de dos clics a la vez).
- Después de confirmar, se envía **un correo por apoderado** vinculado a los alumnos consolidados en esos registros, con los cursos publicados de cada hijo («Valeria: Matemática · Bimestre II»). Un fallo del correo no revierte la publicación (`aviso.enviados` < `aviso.apoderados`).
- Un registro publicado sigue de solo lectura: `tg_nota_registro_cerrado` (US40) bloquea crear o cambiar sus notas.

## Libreta del apoderado (US46, US26) y «Mis notas» del alumno (US51)

**Regla central:** el apoderado y el alumno **solo ven notas de registros `PUBLICADO`**. Las consultas de la libreta filtran `cierre.estado = 'PUBLICADO'` en la base (`publicados.resultadosDeMatricula` y `publicados.notasDeMatricula`): las notas de un registro abierto o solo cerrado nunca salen del servidor, aunque la pantalla se manipule.

| Método y ruta | Quién | Respuesta `data` |
|---|---|---|
| `GET /evaluacion/apoderado/hijos/{id}/libreta` | Apoderado | `LibretaDelHijo` |
| `GET /evaluacion/apoderado/hijos/{id}/libreta/pdf?periodoId=` | Apoderado | PDF (`application/pdf`) |
| `GET /evaluacion/alumno/libreta` | Alumno | `Libreta` |
| `GET /evaluacion/alumno/libreta/pdf?periodoId=` | Alumno | PDF (`application/pdf`) |

- `Libreta`: `{ estudiante: { estudianteId, nombres, apellidos, nombreCompleto }, anio: { id, anio }, grado, seccion, seccionCorta, tutor, bimestres: BimestreDeLibreta[], bimestrePorDefectoId }`.
- `BimestreDeLibreta`: `{ id, numero, nombre, fechaInicio, fechaFin, estado, publicadoEn, cursos: CursoDeLibreta[], resumen: { AD, A, B, C } }`. `estado`: `PUBLICADO` (todos sus cursos), `PARCIAL` (algunos), `PENDIENTE` (ninguno) o `NO_INICIADO` (aún no empieza y no hay nada publicado). `resumen` cuenta los cursos publicados por logro consolidado.
- `CursoDeLibreta`: `{ cursoId, codigo, nombre, docente, publicado, publicadoEn, consolidado, competencias: [{ competenciaPlanId, codigo, nombre, logro }] }`. Un curso **no publicado** viene con `publicado: false`, `consolidado: null` y `competencias: []`: la pantalla muestra «Pendiente de publicación» (apoderado) o «Aún no publicado» (alumno).
- Cursos de cada bimestre: los publicados para la matrícula (aunque sean de una sección anterior, por un traslado) y, del plan de estudios de la sección actual, los que aún no se publican.
- `bimestrePorDefectoId`: el último bimestre con algo publicado; si no hay, el último que ya empezó.
- `LibretaDelHijo`: `{ restringido: false, libreta: Libreta }` o, con restricción por deuda, `{ restringido: true, mensaje, estudiante, anio, bimestres: [{ id, numero, nombre }], deuda: { pensiones: [{ cuotaId, concepto, fechaVencimiento, monto }], total } }`, **sin ninguna calificación** ni estado de publicación.
- El hijo debe estar vinculado al apoderado en sesión (`403 ESTUDIANTE_NO_VINCULADO`); se usa su matrícula vigente o, si no tiene (retirado), la más reciente. El alumno sale de la sesión y necesita matrícula vigente (`403 SIN_MATRICULA_VIGENTE`).

**Restricción por deuda (US26)**

- Con **2 o más pensiones vencidas** de la matrícula (parámetro `PENSIONES_VENCIDAS_RESTRINGEN_LIBRETA`, por defecto 2), el apoderado no ve la libreta: `mensaje` «Existen pagos pendientes que impiden visualizar esta información. Por favor, regularice su situación con tesorería.».
- «Vencida» usa el criterio del panel de morosidad (US24): cuota de tipo pensión, `PENDIENTE` y con vencimiento anterior a hoy en Lima (la cuota de matrícula no cuenta).
- Se calcula en cada consulta, sin guardar nada: al registrarse el pago, la siguiente consulta ya muestra la libreta (criterio 3).
- **No se aplica al alumno**: el backlog la define para el apoderado (US26: «restrinja… al apoderado») y AL-03 no la contempla.

**Libreta en PDF (US66)**

- Generada con `platform/pdf` (el mismo generador de los recibos, US25): datos del estudiante y del periodo, una tabla por curso publicado con el logro de cada competencia y el «Logro consolidado del curso», la lista de cursos pendientes de publicación y la escala. Nombre `Libreta_BimestreII_2026_ValeriaQuispe.pdf`.
- `periodoId` es obligatorio. Sin ningún curso publicado en el bimestre: `422 LIBRETA_SIN_PUBLICAR`. Un bimestre de otro año: `404 NO_ENCONTRADO`.
- Con restricción por deuda **no se genera**: `403 LIBRETA_RESTRINGIDA` con el mensaje de US26.

## Rectificación de nota (US41)

Pantallas: DO-04 con el modal M-08 «Solicitud de rectificación de nota» (docente) y la pestaña «Solicitudes de rectificación» de AD-15 (administrador). Ver [frontend-rectificacion-notas.md](../frontend-rectificacion-notas.md).

| Método y ruta | Quién | Cuerpo | Respuesta `data` |
|---|---|---|---|
| `POST /evaluacion/registros/{asignacionId}/bimestres/{periodoId}/rectificaciones` | Docente (solo sus cursos) | `{ matriculaId, competenciaPlanId, valorCorrecto, motivo }` | `201` `{ solicitud: SolicitudVista, aviso: { destinatarios, enviados } }` |
| `GET /evaluacion/docente/rectificaciones` | Docente | — | `SolicitudVista[]` (las que pidió, de la más reciente a la más antigua; hasta 200) |
| `GET /evaluacion/rectificaciones?estado=PENDIENTES\|RESUELTAS&pagina=&tamano=` | Coordinador | — | `{ items: SolicitudVista[], pendientes, paginacion }` |
| `POST /evaluacion/rectificaciones/{id}/aprobar` | Coordinador | — | `{ solicitud, consolidado: { anterior, nuevo }, aviso }` |
| `POST /evaluacion/rectificaciones/{id}/rechazar` | Coordinador | `{ motivo }` | `{ solicitud, consolidado: null, aviso }` |

- `SolicitudVista`: `{ id, estado, nombreEstado, pendiente, asignacionId, periodoId, estadoRegistro, docente: { id, nombre, nombreCorto }, anio, curso: { codigo, nombre }, seccion («3° B»), bimestre: { numero, nombre }, matriculaId, estudiante («Apellidos, Nombres»), competencia: { competenciaPlanId, columna («C2»), codigo, nombre }, valorAnterior, valorSolicitado, valorActual, motivo, motivoRechazo, solicitadoPor, solicitadoEn, resueltoPor, resueltoEn, esPropia }`.
- `estado`: `PENDIENTE` («Pendiente de aprobación»), `APROBADA` («Aprobada») o `RECHAZADA` («Rechazada»). La enumeración también tiene `EN_REVISION` y `CANCELADA` (diagrama de clases), que esta entrega no usa; `EN_REVISION` cuenta como pendiente.
- `esPropia`: la pidió el usuario en sesión. La bandeja la muestra, pero no se puede aprobar ni rechazar.
- `bandeja.pendientes`: total de solicitudes pendientes (número de la pestaña de AD-15). Pendientes de la más antigua a la más reciente; resueltas, de la más reciente a la más antigua.

**Solicitar (criterio 1)**

- Solo en un registro `CERRADO` o `PUBLICADO` del docente en sesión. Un curso o una sección de otro docente responde `403 ACCESO_DENEGADO`, igual que el registro de notas. En un registro abierto, `409 REGISTRO_ABIERTO`: la nota se corrige directamente.
- `valorCorrecto` es `AD`, `A`, `B` o `C` (si no, `400 DATOS_INVALIDOS` con «Solo se permiten los valores AD, A, B o C») y **distinto del registrado** (`422 VALOR_IGUAL_AL_ACTUAL`). `motivo` es obligatorio, de 1 a 500 caracteres.
- El alumno o la competencia deben tener nota en ese registro (`422 NOTA_FUERA_DEL_REGISTRO`).
- **Una sola solicitud pendiente por nota:** `409 RECTIFICACION_PENDIENTE`. En la base, el índice único parcial `uq_solicitud_rectificacion_pendiente_por_nota` lo garantiza también ante dos pedidos a la vez.
- La solicitud guarda la nota, el valor anterior, el solicitado, el motivo y quién la pidió (`solicitado_por_id`). Después se avisa por correo a los coordinadores académicos activos (`aviso`); si el correo falla, la solicitud se conserva.

**Aprobar (criterio 2)**

- En **una sola transacción**: bloquea la solicitud (`FOR UPDATE`) y el registro; vuelve a comprobar que siga pendiente y que la nota tenga todavía el valor anterior (`409 NOTA_CAMBIO` si no); pasa la solicitud a `APROBADA`; cambia la nota al valor solicitado (guarda el anterior, quién y cuándo); **recalcula el logro consolidado del curso** de ese alumno con la **versión de la regla y los pesos que se usaron al cerrar** (los del `detalle_calculo` de su resultado, aunque después se haya publicado otra versión); escribe la bitácora de notas con origen `RECTIFICACION` y el id de la solicitud, y registra `APROBAR_RECTIFICACION_NOTA` en la auditoría general.
- **Trigger de US40:** la nota de un registro cerrado o publicado solo cambia por este camino. La transacción declara la solicitud con `set_config('kubo.rectificacion_id', <id>, true)` (local a la transacción) y `tg_nota_registro_cerrado` solo deja pasar el `UPDATE` si esa solicitud está `APROBADA`, es de esa nota y el cambio es exactamente de `valor_anterior` a `valor_solicitado`. Cualquier otra escritura sigue respondiendo `REGISTRO_CERRADO`, aunque declare la variable (ver [AD-16](../arquitectura/AD-16-bitacora-notas.md)).
- Si el registro está `PUBLICADO`, el apoderado y el alumno ven el valor corregido y el nuevo consolidado en la libreta desde ese momento (la libreta lee la nota y el resultado de la base).
- **Dos aprobaciones a la vez** de la misma solicitud: la segunda espera el bloqueo, la encuentra `APROBADA` y responde `409 SOLICITUD_YA_RESUELTA`. Solo una cambia la nota y escribe la bitácora.
- Después se avisa por correo al docente del curso con el estado «Aprobada».

**Rechazar (criterio 3)**

- `motivo` obligatorio (1 a 500 caracteres; `400 DATOS_INVALIDOS` «Escribe el motivo del rechazo»). La solicitud pasa a `RECHAZADA` con el motivo y **la nota no cambia**. Registra `RECHAZAR_RECTIFICACION_NOTA` en la auditoría.
- Después se avisa por correo al docente con el estado «Rechazada» y el motivo. Un fallo del correo no revierte el rechazo.

**Quién resuelve**

- Solo el Coordinador académico, y **nunca su propia solicitud**: un usuario con perfil de Docente y de Coordinador que pidió una rectificación no puede aprobarla ni rechazarla (`403 SOLICITUD_PROPIA`). Una solicitud ya resuelta responde `409 SOLICITUD_YA_RESUELTA`.

## Bitácora de notas (US03)

Pantalla AD-16 «Auditoría», pestaña «Cambios de notas» (`/admin/auditoria`). **Solo Coordinador académico.** Decisión de diseño en [AD-16](../arquitectura/AD-16-bitacora-notas.md).

| Método y ruta | Respuesta `data` |
|---|---|
| `GET /evaluacion/bitacora?desde=&hasta=&docenteId=&pagina=&tamano=` | `{ items: CambioRegistrado[], paginacion }` |
| `GET /evaluacion/bitacora/docentes` | `[{ id, nombre }]` (docentes con cambios en la bitácora, por nombre) |

- `CambioRegistrado`: `{ id, fecha, origen, nombreOrigen, solicitudId, docente: { id, nombre }, realizadoPor: { id, nombre }, anio, curso: { codigo, nombre }, seccion, bimestre: { numero, nombre }, estudiante, competencia: { columna, codigo, nombre }, valorAnterior, valorNuevo }`.
- `origen`: `REGISTRO` («Registro docente»: nota nueva o cambiada por el docente en el registro abierto) o `RECTIFICACION` («Rectificación aprobada», con `solicitudId`). `valorAnterior` es `null` en el primer registro de la nota.
- `docente` es el del curso y la sección (por quien se filtra); `realizadoPor`, quien hizo el cambio: el mismo docente o el Coordinador académico que aprobó la rectificación.
- **Filtros (criterio 2):** `desde` y `hasta` son fechas `AAAA-MM-DD` de Lima, ambas incluidas; `docenteId` es el id del docente. Si se indican el rango y el docente, solo salen las filas que **cumplen los dos**. Un rango al revés responde `400 RANGO_FECHAS_INVALIDO`. Orden: del más reciente al más antiguo. Página de 20 por defecto (máximo 100).
- **Escritura (criterio 1):** cada nota creada o cambiada deja una fila en la **misma transacción** que la nota: `PUT …/notas` (una por cada nota nueva y cada cambio; las que llegan con el mismo valor no) y la aprobación de una rectificación. Guarda los ids (nota, registro, matrícula, competencia, usuario, docente, solicitud) y una copia de los nombres al momento del cambio.
- **Inmutable (criterio 3):** `tg_bitacora_nota_inmutable` rechaza `UPDATE` y `DELETE` y `tg_bitacora_nota_sin_vaciar`, `TRUNCATE`, aunque se intente fuera de la aplicación. La aplicación lo traduce a `422 BITACORA_NOTA_INMUTABLE` «La bitácora de notas no se puede modificar.». No hay ningún endpoint que la cambie.

## Evidencias pedagógicas (US38) y su consulta (US47)

Una **evidencia** (`evidencia_pedagogica`) pertenece a una calificación: la nota de un estudiante en una competencia de un registro. Tiene un **comentario** del docente (hasta 1000 caracteres), un **archivo** PDF o JPG de hasta 5 MB, o ambos; al menos uno (`ck_evidencia_contenido`). Una calificación puede tener varias. El archivo se guarda en el almacén de `platform/archivos` (bucket privado de S3 o disco, según `ARCHIVOS_DRIVER`) con la clave interna `evidencias/<uuid>`; la base guarda la clave, el nombre original saneado, el tipo real y el tamaño. La clave **nunca** sale hacia el navegador y no hay URLs públicas: el archivo se pide siempre a la API. `entrega_trabajo_id` queda preparado para las evidencias que vendrán de una entrega de trabajo (US64).

| Método y ruta | Quién | Cuerpo | Respuesta `data` |
|---|---|---|---|
| `POST /evaluacion/registros/{asignacionId}/bimestres/{periodoId}/evidencias` | Docente del curso y la sección | `multipart/form-data`: `matriculaId`, `competenciaPlanId`, `comentario` (opcional) y `archivo` (opcional) | `201` `{ evidencia: EvidenciaVista, registro: RegistroDeNotas }` |
| `DELETE /evaluacion/registros/{asignacionId}/bimestres/{periodoId}/evidencias/{evidenciaId}` | Docente del curso y la sección | — | `RegistroDeNotas` |
| `GET /evaluacion/evidencias/{id}/archivo` | Docente del curso; apoderado del estudiante y el propio alumno con el registro **publicado** | — | El archivo (no JSON) |

- `EvidenciaVista`: `{ id, comentario | null, archivo: { nombre, tipo («PDF», «JPG»…), mime, tamanoBytes } | null, subidoEn }`.
- En `RegistroDeNotas`, cada nota de `alumnos[].notas` trae `evidencias: EvidenciaVista[]` (la celda muestra el clip con su número). En la libreta del apoderado y en «Mis notas», cada competencia de un curso publicado trae `evidencias: EvidenciaVista[]` (vacío si no tiene; los cursos sin publicar no traen competencias). La libreta restringida por deuda (US26) no trae ninguna.

Reglas:

- **Validación del archivo en el servidor:** el tipo se decide por los primeros bytes (`%PDF-` o `FF D8 FF`), nunca por la extensión ni el `Content-Type` del navegador; un archivo renombrado («tarea.pdf» que en realidad es HTML) se rechaza. 0 bytes → `400 ARCHIVO_VACIO`. Más de 5 MB (5 242 880 bytes) → `413 ARCHIVO_DEMASIADO_GRANDE`; exactamente 5 MB se acepta. Otro formato (PNG, DOCX…) → `400 ARCHIVO_NO_PERMITIDO`. Los dos últimos con el mensaje del backlog: «Formato no permitido o archivo demasiado pesado (máx. 5 MB, formatos PDF/JPG)».
- **Límite antes de leer:** si el `Content-Length` del pedido supera 5 MB más 64 KB de holgura del formulario, se responde `413` sin leer el cuerpo; si no lo declara, se cuenta mientras se lee y se corta al pasarse.
- **Nombre:** se quitan carpetas, caracteres de control y reservados (`< > : " | ? *`), se recorta a 120 caracteres y se pone la extensión del tipo real («C:\fakepath\Ficha.PDF» → «Ficha.pdf»).
- **Calificación guardada:** la evidencia se asocia a una nota que ya existe; si la celda no tiene nota guardada → `422 NOTA_SIN_CALIFICAR`.
- **Registro abierto:** se agregan y eliminan mientras el registro esté `ABIERTO` (aunque el bimestre ya no sea el activo); con el registro `CERRADO` o `PUBLICADO` quedan en solo lectura → `409 REGISTRO_CERRADO`. El trigger `tg_evidencia_registro_cerrado` lo impide también directo en la base.
- **Permisos de la descarga:** el docente solo de sus cursos y secciones (en cualquier estado del registro); el apoderado solo de sus hijos vinculados y el alumno solo las suyas, y ambos solo con el registro publicado. A quien no le corresponde se le responde `404 NO_ENCONTRADO` (no se revela que la evidencia existe). El apoderado con 2 o más pensiones vencidas recibe `403 LIBRETA_RESTRINGIDA` con el mensaje de US26; al alumno no se le aplica, como en «Mis notas» (US51). Una evidencia de solo comentario no tiene archivo → `404`.
- **Descarga:** `Content-Type` del tipo real; `Content-Disposition` `inline` para JPG y PDF (el navegador los muestra) y `attachment` para el resto, con el nombre en ASCII y en UTF-8 (`filename*`); `Cache-Control: private, no-store` y `X-Content-Type-Options: nosniff`.
- **Orden:** el archivo se guarda en el almacén antes de la transacción; si la transacción falla, se borra. Al eliminar, la fila se borra en la transacción y el archivo después; si el almacén falla, la evidencia ya no existe y la clave queda en el log como huérfana (WARN).
- **Sin almacén** (`ARCHIVOS_DRIVER` vacío en producción, como en Vercel): subir o descargar un archivo → `503 ALMACEN_NO_CONFIGURADO`; las evidencias de solo comentario funcionan.

## Códigos de error

| Estado | Código | Cuándo |
|---|---|---|
| 400 | `VALOR_NO_PERMITIDO` | Un logro que no es `AD`, `A`, `B` o `C` («Solo se permiten los valores AD, A, B o C») |
| 400 | `DATOS_INVALIDOS` | Ids no válidos, lista vacía, más de 500 notas o la misma celda dos veces; solicitud o rechazo sin motivo |
| 400 | `RANGO_FECHAS_INVALIDO` | Bitácora con «Desde» posterior a «Hasta» |
| 400 | `EVIDENCIA_VACIA` | Evidencia sin comentario (o solo con espacios) y sin archivo |
| 400 | `COMENTARIO_DEMASIADO_LARGO` | Comentario de evidencia de más de 1000 caracteres (por la API llega antes como `DATOS_INVALIDOS`) |
| 400 | `ARCHIVO_VACIO` | Archivo de 0 bytes |
| 400 | `ARCHIVO_NO_PERMITIDO` | El contenido no es PDF ni JPG (aunque la extensión lo diga) |
| 413 | `ARCHIVO_DEMASIADO_GRANDE` | Más de 5 MB, por el `Content-Length` o al leer el cuerpo |
| 401 | `NO_AUTENTICADO` | Sin sesión |
| 403 | `ACCESO_DENEGADO` | Otro perfil, o un curso o sección que no es del docente (o una asignación ya desactivada) |
| 403 | `ESTUDIANTE_NO_VINCULADO` | Libreta, PDF u horario de un estudiante que no es hijo del apoderado en sesión |
| 403 | `SIN_MATRICULA_VIGENTE` | «Mis notas» de un alumno sin matrícula vigente |
| 403 | `LIBRETA_RESTRINGIDA` | PDF de la libreta o archivo de una evidencia pedido por el apoderado con 2 o más pensiones vencidas (mensaje de US26) |
| 403 | `SOLICITUD_PROPIA` | Aprobar o rechazar una solicitud de rectificación que pidió el mismo usuario |
| 404 | `NO_ENCONTRADO` | La asignación no existe, el bimestre no es del año del curso o de la libreta, o el registro no existe o está abierto; la evidencia no existe, no es de ese registro o no le corresponde a quien la pide |
| 409 | `REGISTRO_NO_CERRADO` | Publicar un registro abierto |
| 409 | `REGISTRO_YA_PUBLICADO` | Publicar un registro ya publicado (también el segundo de dos clics a la vez) |
| 409 | `REGISTRO_CERRADO` | Escritura o cierre sobre un registro cerrado (también el segundo de dos cierres simultáneos); agregar o eliminar evidencias de un registro cerrado o publicado |
| 409 | `REGISTRO_ABIERTO` | Solicitar rectificación en un registro abierto |
| 409 | `RECTIFICACION_PENDIENTE` | La nota ya tiene una solicitud pendiente de aprobación |
| 409 | `SOLICITUD_YA_RESUELTA` | Aprobar o rechazar una solicitud ya resuelta (también la segunda de dos aprobaciones a la vez) |
| 409 | `NOTA_CAMBIO` | Al aprobar, la nota ya no tiene el valor con el que se pidió |
| 422 | `PERIODO_NO_ACTIVO` | Escritura fuera del bimestre activo («Este periodo de evaluación no está activo.») |
| 422 | `NOTA_FUERA_DEL_REGISTRO` | Un alumno que no está en la lista o una competencia que no es del curso |
| 422 | `NOTAS_INCOMPLETAS` | Cierre con competencias sin calificar; `details.pendientes` |
| 422 | `REGISTRO_SIN_ALUMNOS` | Cierre de una sección sin alumnos con matrícula vigente |
| 422 | `SIN_REGLA_CONSOLIDACION` | El año no tiene una regla de consolidación para el bimestre |
| 422 | `CURSO_SIN_COMPETENCIAS` | El plan del curso no tiene competencias (académico, US11) |
| 422 | `LIBRETA_SIN_PUBLICAR` | PDF de un bimestre sin cursos publicados |
| 422 | `VALOR_IGUAL_AL_ACTUAL` | Rectificación con el mismo valor que ya tiene la nota |
| 422 | `BITACORA_NOTA_INMUTABLE` | Intento de cambiar o borrar la bitácora de notas directo en la base |
| 422 | `NOTA_SIN_CALIFICAR` | Evidencia para una celda sin calificación guardada |
| 400 | `ITEM_NOMBRE_REQUERIDO`, `ITEM_NOMBRE_LARGO`, `ITEM_NOMBRE_REPETIDO`, `ITEM_PESO_INVALIDO`, `DEMASIADOS_ITEMS` | Lista de ítems inválida (bloque M2) |
| 400 | `CSV_VACIO`, `CSV_DEMASIADO_GRANDE` | Archivo de calificaciones sin filas o con más de 300 |
| 404 | `NO_ENCONTRADO` | Ítem que no es de esa competencia o de ese registro |
| 409 | `CONFIRMAR_CAMBIO_ITEMS` | Guardar ítems que borran calificaciones o quitan notas sin `confirmar`; `details` con lo que se pierde |
| 422 | `COMPETENCIA_CON_ITEMS` | Nota directa en una competencia que se califica por ítems |
| 503 | `ALMACEN_NO_CONFIGURADO` | Subir o descargar un archivo sin almacén configurado (`ARCHIVOS_DRIVER`) |

## Auditoría (RF03)

| Acción | Entidad | Valor anterior | Valor nuevo |
|---|---|---|---|
| `CERRAR_REGISTRO_NOTAS` | `cierre_calificacion` | `{ estado }` | `{ estado: "CERRADO", anio, curso, seccion, bimestre, regla: { version, metodo, criterioDesempate }, estudiantes, competencias, notas, consolidados: { AD, A, B, C } }` |
| `PUBLICAR_NOTAS` | `cierre_calificacion` | `{ estado: "CERRADO" }` | `{ estado: "PUBLICADO", anio, curso, seccion, bimestre, estudiantes }` |
| `APROBAR_RECTIFICACION_NOTA` | `nota` | `{ logro, consolidado }` | `{ logro, consolidado, solicitudId, anio, curso, seccion, bimestre, competencia, estadoRegistro }`; `motivo`: el del docente |
| `RECHAZAR_RECTIFICACION_NOTA` | `solicitud_rectificacion` | `{ estado }` | `{ estado: "RECHAZADA", notaId, valorAnterior, valorSolicitado, curso, seccion, bimestre }`; `motivo`: el del rechazo |
| `AGREGAR_EVIDENCIA` | `evidencia_pedagogica` | — | `{ notaId, anio, curso, seccion, bimestre, competenciaPlanId, largoComentario, archivo: { clave, mime, tamanoBytes } \| null }` |
| `ELIMINAR_EVIDENCIA` | `evidencia_pedagogica` | lo mismo que `AGREGAR_EVIDENCIA` | — |
| `GUARDAR_ITEMS_EVALUACION` | `cierre_calificacion` | `{ items: [{ nombre, peso, orden }] }` | `{ anio, curso, seccion, bimestre, competencia, items, sumaPesos, impacto, recalculo }` (bloque M2) |

La auditoría y los logs de las evidencias **no** llevan el comentario ni el nombre del archivo (pueden tener datos personales), solo su largo, la clave, el tipo y el tamaño.

Cada cambio de nota guarda en la propia nota el valor anterior, quién y cuándo, y una fila en la bitácora de notas (US03). Pedir una rectificación no se audita aparte: la solicitud misma guarda quién, cuándo y el motivo.

## Dependencias entre módulos

`evaluacion` está por encima de `academico`, `comunidad` y `matricula` y los usa por su `index.ts`:

- `academico`: `asignacionParaNotas` y `asignacionesParaNotas` (curso, sección, año y plan de una o varias asignaciones), `listarSecciones`, `listarGrados`, `planDeSeccion` (cursos de la sección para la libreta), `competenciasDelPlan`, `listarAsignaciones`, `listarAnios`, `reglaDelBimestre` (versión de la regla que rige en un bimestre, nueva en este bloque), `obtenerAnio` (reportes) y `consolidarLogro` (US12; también calcula la nota por ítems con la regla `PONDERADO`, bloque M2).
- `comunidad`: `docentesProviderComunidad` (docente en sesión y nombres de docentes), `resumenEstudiantes`, `nombresDeUsuarios`, `contactosDeCoordinadores` y `personasDeCoordinadores` (cierre y solicitud de rectificación), `contactosDeDocentes` (resultado de la rectificación) y `apoderadosDeEstudiantes` (correo de notas publicadas).
- `matricula`: `matriculasDeSeccionEnFecha`, `datosDeMatriculas`, `matriculaDelHijo` (vínculo del apoderado), `matriculaVigenteDelAlumno` y `restriccionPorDeuda` (US26).
- `comunidad`, para el archivo de una evidencia (US47): `estudiantesVinculadosAPersona` (vínculo del apoderado) y `estudianteDePersona` (el alumno en sesión).
- `platform/archivos`: `validarArchivo`, `guardarArchivo`, `abrirArchivo`, `eliminarArchivo`, `leerFormulario` y `respuestaArchivo`.

Académico sigue consultando los cierres y las notas por su puerto `CierresProvider`, que implementa evaluación; desde el bloque M2 también `itemsPorCompetenciaPlan` (una competencia con ítems no se quita del plan).

# Tutoría: conducta y notas de la sección (bloque M3)

Rutas del tutor o cotutor de la sección (`ROLES_EVALUACION.TUTORIA`, perfil `DOCENTE`, y la guardia
`tutoriaDelDocente`: **403 `NO_ES_TUTOR`** para cualquier otro docente). Ver [horarios.md](horarios.md#tutoría-de-sección-bloque-m3).

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/evaluacion/tutoria/{seccionId}/conducta?periodoId=` | Conducta de los alumnos en un bimestre (por defecto, el actual), con resumen y si es editable |
| PUT | `/evaluacion/tutoria/{seccionId}/conducta/{periodoId}` | `{ notas: [{ matriculaId, valor, comentario? }] }`: crea y modifica (solo lo que cambia) |
| GET | `/evaluacion/tutoria/{seccionId}/alumnos` | Alumnos de la sección para ver sus notas |
| GET | `/evaluacion/tutoria/{seccionId}/alumnos/{matriculaId}/notas` | Libreta completa del año (lo no publicado, «Sin publicar») con la conducta de cada bimestre |
| GET | `/evaluacion/tutoria/{seccionId}/consolidado?periodoId=` | Matriz alumnos × cursos con el consolidado del bimestre, la conducta y el resumen AD/A/B/C por curso |
| GET | `/evaluacion/tutoria/{seccionId}/consolidado/csv?periodoId=` | El consolidado en CSV (BOM) |

## Reglas

- **Nota de conducta** (`nota_conducta`, migración `20261128140000_nota_conducta`): AD, A, B o C y un comentario
  opcional de hasta 500 caracteres, única por matrícula y periodo. Se registra y modifica mientras el periodo no esté
  `FINALIZADO` (`409 PERIODO_FINALIZADO`; también el trigger `tg_nota_conducta_periodo_finalizado`). Solo de alumnos con
  matrícula vigente en la sección en el bimestre (`422 ALUMNO_FUERA_DE_LA_SECCION`).
- **En la libreta** (AP-04, AL-03 y su PDF) aparece la conducta del bimestre solo cuando el bimestre está publicado (todos
  sus cursos publicados).
- **Notas por alumno:** `403 ALUMNO_DE_OTRA_SECCION` si la matrícula no es de la sección de la tutoría.
- **Consolidado:** el logro consolidado existe desde que el docente cierra el registro; los cursos no publicados salen
  «Sin publicar · …». Las columnas son los cursos del plan de la sección con su asignación activa.

## Auditoría

| Acción | Entidad | Anterior → nuevo |
|---|---|---|
| `REGISTRAR_NOTA_CONDUCTA` | `nota_conducta` | — → `{ matriculaId, periodoId, valor, comentario, rol }` |
| `MODIFICAR_NOTA_CONDUCTA` | `nota_conducta` | `{ valor, comentario }` → `{ matriculaId, periodoId, valor, comentario, rol }` |
