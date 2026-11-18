# Casos de prueba · Sprint 3, bloque 7: notas visibles (US39, US46, US51, US26, US66) y defecto D-11 (US45, US52)

Pantallas AD-15 «Notas y rectificaciones» (`/admin/notas`), AP-04 y AP-06 «Libreta de notas» del apoderado (`/apoderado/notas`), AL-03 «Mis notas» del alumno (`/alumno/notas`), «Descargar PDF» del horario (AP-05) y «Mi asistencia» y «Asistencia» para D-11. Pantallas: [frontend-notas-visibles.md](../frontend-notas-visibles.md) y [frontend-asistencia.md](../frontend-asistencia.md). API: [evaluacion.md](../api/evaluacion.md) y [horarios.md](../api/horarios.md).

Las reglas puras se prueban con Vitest en `tests/evaluacion/libreta.test.ts` (publicable, cursos publicados y pendientes, estado, resumen y bimestre por defecto, PDF y filas del horario), `tests/matricula/restriccionLibreta.test.ts` (pensiones vencidas y restricción) y `tests/horarios/asistencia.test.ts` (D-11: base desde la matrícula, faltas restantes y singular o plural). Los permisos (401, 403, estudiante ajeno), que ninguna nota de un registro abierto o solo cerrado llegue al apoderado o al alumno, la publicación con auditoría y correo, la restricción por deuda que se levanta al pagar y las descargas se prueban en `tests/evaluacion/libreta.integracion.test.ts`, que corre en el CI con PostgreSQL.

**Precondición común (PC):** seed cargado y año **2026** «En curso» con sus cuatro bimestres (hoy en el **Bimestre IV**). Sección **3° B** con tutora Ana Vega Morales y los cursos Matemática (4 competencias, Juan Pérez Salazar), Comunicación, Ciencia y Tecnología, Inglés y Educación Física (Patricia Ríos). Apoderada **Carmen Rojas Medina** (con cuenta) vinculada a **Valeria** y **Diego Quispe Rojas**, ambos matriculados en 3° B; Valeria tiene cuenta de alumna. Otra apoderada sin vínculo con ellos. Registros de notas: bimestres I y II **publicados** (menos Educación Física, que no se cerró); bimestre III con Matemática y Comunicación **cerrados** sin publicar. Diego tiene **2 pensiones vencidas**; Valeria está al día. Solo datos ficticios (RNF14).

Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y muestra el mensaje).

## US39 · Publicación de notas (criterio 4)

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US39-01 | US39 | básico | PC; sesión de Administrador | 1. Menú «Notas y rectificaciones». | — | Pestañas «Registros por publicar (2)» y «Publicados (8)». Filtros «Año 2026», «Bimestre» y «Grado». Tabla con Matemática y Comunicación de 3° B del Bimestre III: docente y «cerró el …», sección, bimestre, estudiantes, «Cerrado», «Ver» y «Publicar». Un registro abierto no aparece. |
| CP-US39-02 | US39 | alterno | CP-US39-01 | 1. «Ver» en Matemática. | — | Debajo de la tabla, «Matemática 3° B · Bimestre III» con la grilla en solo lectura (notas de cada competencia y consolidado de cada alumno) y la regla usada. «Cerrar» la oculta. |
| CP-US39-03 | US39 | básico | CP-US39-01 | 1. «Publicar» en Matemática. 2. «Publicar» en el modal. | — | Modal «Publicar notas» con «Matemática · 3° B · Bimestre III» y el aviso de que lo verán apoderados y alumnos. Alerta verde «Notas publicadas.» con «Se publicó 1 registro… Se avisó por correo a 1 apoderado.». El registro pasa a «Publicados» con «publicó R. Huamán el …». En `registro_auditoria`: `PUBLICAR_NOTAS` con `{ estado: "CERRADO" }` → `{ estado: "PUBLICADO", anio, curso, seccion, bimestre, estudiantes }`. |
| CP-US39-04 | US39 | básico | CP-US39-03 | 1. Revisar el correo de Carmen (en desarrollo, la consola del servidor). | — | Un solo correo «Kubo · Notas publicadas» con «- Valeria: Matemática · Bimestre III» y «- Diego: Matemática · Bimestre III». |
| CP-US39-05 | US39 | alterno | CP-US39-01 | 1. Marcar las dos casillas (o «Seleccionar todos»). 2. «Publicar seleccionados (2)». 3. Confirmar. | — | Se publican los dos en una sola operación; «Se publicaron 2 registros…». |
| CP-US39-06 | US39 | excepción | Registro ya publicado | 1. `POST /evaluacion/publicaciones` con su `cierreId`. | — | `409 REGISTRO_YA_PUBLICADO` «Las notas de este registro ya están publicadas.». No se repite la auditoría ni el correo. |
| CP-US39-07 | US39 | excepción | Un registro abierto y uno cerrado | 1. `POST /evaluacion/publicaciones` con los dos. | — | `409 REGISTRO_NO_CERRADO`. No se publica ninguno de los dos (todo o nada). |
| CP-US39-08 | US39, US40 | excepción | Registro publicado | 1. Como docente, `PUT …/notas` sobre ese registro. 2. `UPDATE nota` directo en la base. | — | `409 REGISTRO_CERRADO`; en la base, el trigger rechaza el cambio: el registro publicado sigue bloqueado. |
| CP-US39-09 | US39 | excepción | Sin sesión / sesión de Docente o Apoderado | 1. `GET` y `POST /evaluacion/publicaciones`, `GET /evaluacion/publicaciones/{id}`. | — | `401 NO_AUTENTICADO` sin sesión; `403 ACCESO_DENEGADO` con otro perfil. |

## US46 · Libreta de notas del apoderado

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US46-01 | US46 | básico | PC; sesión de Carmen con Valeria elegida | 1. Menú «Notas». | — | «Libreta de notas», pestañas «Bimestre I», «Bimestre II · parcial», «Bimestre III · pendiente», «Bimestre IV». Se abre el Bimestre II. Datos de Valeria, «3° de secundaria · B», tutora y «Publicado en parte el …». Cada curso publicado con su docente, el logro consolidado y el logro de cada competencia (AD, A, B, C). Escala y «Resumen del bimestre». |
| CP-US46-02 | US46 | básico | CP-US46-01 | 1. Ver Educación Física en el Bimestre II. | — | Insignia «Pendiente de publicación», sin ninguna competencia ni nota. |
| CP-US46-03 | US46 | excepción | Bimestre III con registros cerrados sin publicar | 1. Pestaña «Bimestre III · pendiente». 2. `GET /evaluacion/apoderado/hijos/{Valeria}/libreta` y buscar logros del bimestre III. | — | Todos los cursos «Pendiente de publicación». La respuesta no trae `consolidado` ni `competencias` de los registros cerrados ni de los abiertos: el servidor los filtra. |
| CP-US46-04 | US46 | alterno | CP-US39-03 | 1. Volver a «Notas» y elegir «Bimestre III». | — | Matemática ya aparece con sus logros; Comunicación sigue pendiente. |
| CP-US46-05 | US46 | excepción | Sesión de la otra apoderada | 1. `GET /evaluacion/apoderado/hijos/{Valeria}/libreta`. | — | `403 ESTUDIANTE_NO_VINCULADO` «No tienes acceso a la información de este estudiante.». |
| CP-US46-06 | US46 | excepción | Sin sesión / sesión de Alumno o Docente | 1. `GET /evaluacion/apoderado/hijos/{id}/libreta`. | — | `401` sin sesión; `403 ACCESO_DENEGADO` con otro perfil. |
| CP-US46-07 | US46 | alterno | CP-US46-01 | 1. «Cambiar estudiante» → Diego. | — | La libreta se vuelve a cargar para Diego (con su restricción, ver US26). |

## US51 · Mis notas del alumno

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US51-01 | US51 | básico | PC; sesión de Valeria | 1. Menú «Mis notas». | — | «Mis notas», «Periodo: Bimestre II · finalizado», leyenda y la tabla «Curso | Competencia 1…4 | Logro del bimestre» con los cursos publicados. Debajo, «Bimestre II · finalizado» con «Educación Física · Aún no publicado». |
| CP-US51-02 | US51 | alterno | CP-US51-01 | 1. Elegir «Bimestre I · finalizado» en «Periodo». | — | Se muestra el historial completo del Bimestre I (criterio 3). |
| CP-US51-03 | US51 | excepción | CP-US51-01 | 1. Elegir «Bimestre III · finalizado». | — | Sin tabla: todos los cursos «Aún no publicado», sin calificaciones parciales ni provisionales. |
| CP-US51-04 | US51 | alterno | Celular (390 px) | 1. «Mis notas». | — | Una tarjeta por curso con el logro del bimestre y cada competencia con su nombre y su logro; sin desplazamiento horizontal. |
| CP-US51-05 | US51 | excepción | Sesión de Apoderado o Docente; sin sesión | 1. `GET /evaluacion/alumno/libreta`. | — | `403 ACCESO_DENEGADO`; `401` sin sesión. El alumno no envía ningún identificador: siempre recibe su propia libreta. |

## US26 · Restricción de visualización de notas por deuda

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US26-01 | US26 | básico | PC; sesión de Carmen con Diego elegido (2 pensiones vencidas) | 1. Menú «Notas». | — | Candado y «Existen pagos pendientes que impiden visualizar esta información. Por favor, regularice su situación con tesorería.», «Ver pagos pendientes», «Pensiones vencidas de Diego» con las dos pensiones y «Total por regularizar S/ 900.00». Ninguna calificación; «Descargar libreta (PDF)» deshabilitado. |
| CP-US26-02 | US26 | excepción | CP-US26-01 | 1. `GET /evaluacion/apoderado/hijos/{Diego}/libreta`. | — | `restringido: true`, el mensaje y la deuda; la respuesta no tiene `cursos`, `consolidado` ni `logro`. |
| CP-US26-03 | US26 | alterno | CP-US26-01 | 1. Elegir a Valeria (sin deuda). | — | La misma apoderada ve la libreta completa de Valeria: la restricción es por estudiante. |
| CP-US26-04 | US26 | básico | CP-US26-01 | 1. Como Administrador, registrar el pago de una de las pensiones (AD-11). 2. Como Carmen, volver a «Notas». | — | Con 1 pensión vencida ya no se restringe: se ve la libreta de Diego sin intervención del administrador (criterio 3). |
| CP-US26-05 | US26 | alterno | Diego con 1 pensión vencida y la cuota de matrícula vencida | 1. «Notas». | — | No se restringe: la cuota de matrícula no cuenta como pensión (criterio de US24). |
| CP-US26-06 | US26 | alterno | CP-US26-01; sesión de Diego como alumno (si tuviera cuenta) | 1. «Mis notas». | — | El alumno sí ve sus notas: la restricción se aplica solo al apoderado (decisión documentada en evaluacion.md). |

## US66 · Descarga de libreta y horario en PDF

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US66-01 | US66 | básico | CP-US46-01 | 1. «Descargar libreta (PDF)» en el Bimestre II. | — | Se descarga `Libreta_BimestreII_2026_ValeriaQuispe.pdf`: datos del estudiante y del periodo, una tabla por curso publicado con el logro de cada competencia y el «Logro consolidado del curso», «Cursos pendientes de publicación» y la escala. |
| CP-US66-02 | US66 | excepción | Bimestre sin cursos publicados | 1. `GET …/libreta/pdf?periodoId={Bimestre IV}`. | — | `422 LIBRETA_SIN_PUBLICAR`; en la pantalla el botón está deshabilitado. |
| CP-US66-03 | US66, US26 | excepción | CP-US26-01 | 1. `GET /evaluacion/apoderado/hijos/{Diego}/libreta/pdf?periodoId=…`. | — | `403 LIBRETA_RESTRINGIDA` con el mensaje de US26; no se genera el archivo. |
| CP-US66-04 | US66 | básico | Horario de 3° B publicado; sesión de Carmen | 1. «Horario». 2. «Descargar PDF». | — | Se descarga `Horario_2026_Valeria.pdf` con la versión vigente: una fila por bloque y, por día, «Curso · Aula · Docente»; el recreo en su fila. |
| CP-US66-05 | US66 | excepción | Horario sin publicar | 1. «Horario». 2. `GET /horarios/apoderado/hijos/{id}/horario/pdf`. | — | No se muestra el botón; la API responde `422 HORARIO_NO_PUBLICADO` «El horario aún no ha sido publicado por la institución.». |
| CP-US66-06 | US66 | básico | CP-US51-01 | 1. «Descargar libreta» en «Mis notas». | — | Se descarga el mismo PDF de la libreta de Valeria. |
| CP-US66-07 | US66 | excepción | Sesión de la otra apoderada / sin sesión | 1. PDF de la libreta y del horario de Valeria. | — | `403 ESTUDIANTE_NO_VINCULADO`; `401` sin sesión. |

## US45 y US52 · Defecto D-11 (base de inasistencias, faltas restantes y plurales)

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US45-D11-01 | US52 | básico | Alumno matriculado el 06/11/2026; último bimestre hasta el 15/12/2026; 1 falta injustificada | 1. «Mi asistencia». | — | «1 falta de 28 días de clase desde tu matrícula», porcentaje 3,6 % y «Te quedan 4 faltas antes del umbral» (con 20 %, el riesgo llega en la 6.ª falta). |
| CP-US45-D11-02 | US52 | básico | CP-US45-D11-01 con 5 y luego 6 faltas | 1. Registrar las faltas (DO-03). 2. «Mi asistencia». | — | Con 5 faltas: «En aviso» (17,9 %) y un correo de aviso; con 6: «En riesgo» (21,4 %) y un correo de riesgo «…(21,4 % de 28 días de clase desde la matrícula)». Cada aviso se envía una sola vez. |
| CP-US45-D11-03 | US52 | alterno | Alumno matriculado antes del inicio de clases; 187 días de clase; 1 falta | 1. «Mi asistencia». | — | «1 falta de 187 días de clase del año» y «Te quedan 36 faltas antes del umbral» (el 20 % se alcanza en la falta 38). |
| CP-US45-D11-04 | US52 | alterno | 36 faltas de 187 días | 1. «Mi asistencia». | — | «Te queda 1 falta antes del umbral» (singular). |
| CP-US45-D11-05 | US45 | básico | Hijo matriculado el 06/11/2026 en aviso; sesión del apoderado | 1. «Asistencia». | — | Alerta «Diego se acerca al límite de inasistencias del año» con «… (5 faltas de 28 días de clase desde su matrícula)». Con una sola falta en el mes y umbral mensual 1: «Atención: 1 inasistencia injustificada este mes» y «Diego faltó el 9 de noviembre sin justificación. Si tienes una constancia, preséntala…». |
| CP-US45-D11-06 | US45 | alterno | Umbral mensual alcanzado con 1 falta | 1. Revisar el correo del aviso mensual. | — | Asunto «Kubo · 1 inasistencia injustificada en noviembre» y «…Si hay una constancia que la justifique…» (singular). |
