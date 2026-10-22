# Casos de prueba · Año (US06), periodos (US07), secciones (US08), aulas (US09), cursos (US10) y competencias (US11)

Pantallas AD-02 «Año académico y bimestres» (`/admin/anio`), AD-03 «Grados, secciones y aulas» (`/admin/grados`) y AD-04 «Cursos y competencias» (`/admin/cursos`), y la API [academico.md](../api/academico.md).
Las reglas puras se prueban además en `tests/academico/reglas.test.ts`, `tests/academico/secciones.test.ts` y `tests/academico/cursos.test.ts`.

**Precondición común (PC):** sesión iniciada como Administrador (`admin@kubo.edu.pe`) con la contraseña ya cambiada, base de pruebas sin años académicos.
Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y muestra el mensaje).

## US06 · Creación del año académico

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US06-01 | US06 | básico | PC | 1. Ir a «Año y bimestres». 2. «Crear año académico». 3. Llenar y «Crear año». | Año 2026, inicio 02/03/2026, fin 18/12/2026 | Aviso «Se creó el año académico 2026…». El año aparece en la lista con estado «Planificado» y «0 de 4» bimestres. Auditoría `CREAR_ANIO_ACADEMICO`. |
| CP-US06-02 | US06 | alterno | PC | 1. Abrir «Año y bimestres» sin años registrados. | — | Estado vacío «Aún no hay años académicos» con el botón «Crear año académico». |
| CP-US06-03 | US06 | excepción | PC | 1. Crear año con fin anterior al inicio. | Año 2026, inicio 18/12/2026, fin 02/03/2026 | No se crea. Mensaje: «La fecha de fin debe ser posterior a la fecha de inicio». |
| CP-US06-04 | US06 | excepción | PC | 1. Crear año con inicio y fin iguales. | Año 2026, inicio y fin 02/03/2026 | No se crea. Mensaje: «La fecha de fin debe ser posterior a la fecha de inicio». |
| CP-US06-05 | US06 | excepción | Existe 2026 (02/03/2026–18/12/2026) no cerrado | 1. Crear otro año que se cruce con 2026. | Año 2026, inicio 01/06/2026, fin 30/11/2026 | No se crea. Mensaje: «Ya existe un año académico activo en ese rango de fechas». |
| CP-US06-06 | US06 | alterno | Existe 2026 en estado «Cerrado», del 02/03/2026 al 15/01/2027 | 1. Crear un año cuyo rango se cruce con 2026. | Año 2027, inicio 10/01/2027, fin 17/12/2027 | Se crea: los años cerrados no cuentan para el solapamiento. |
| CP-US06-07 | US06 | excepción | Existe 2026 en estado «Cerrado» (si no, el solapamiento se detecta antes) | 1. Crear otra vez el año 2026. | Año 2026, inicio 26/12/2026, fin 30/12/2026 | No se crea. Mensaje: «Ya existe el año académico 2026.» |
| CP-US06-21 | US06 | excepción | PC | 1. Crear un año cuyo número no es el de la fecha de inicio. | Año 2029, inicio 02/03/2026, fin 18/12/2026 | No se crea. Mensaje en el campo «Año»: «El año debe coincidir con la fecha de inicio». |
| CP-US06-22 | US06 | alterno | PC | 1. Crear un año que termina al año siguiente. | Año 2026, inicio 02/03/2026, fin 15/01/2027 | Se crea: solo la fecha de inicio debe coincidir con el número del año. |
| CP-US06-08 | US06 | excepción | PC | 1. Crear año con una fecha que no existe (API). | Inicio «2026-02-30» | 400. Mensaje del campo: «La fecha de inicio no existe». |
| CP-US06-09 | US06 | básico | 2026 «Planificado» | 1. En el detalle de 2026, «Abrir matrícula». 2. Confirmar. | — | Aviso «El año 2026 pasó a «En matrícula»». La línea de estados marca «En matrícula» y el botón pasa a «Iniciar clases». Auditoría `CAMBIAR_ESTADO_ANIO_ACADEMICO` (PLANIFICADO → EN_MATRICULA). |
| CP-US06-10 | US06 | básico | 2026 «En matrícula» | 1. «Iniciar clases» y confirmar. 2. «Iniciar cierre» y confirmar. | — | El año pasa a «En curso» y luego a «En cierre»; cada cambio queda en auditoría. |
| CP-US06-11 | US06 | excepción | 2026 «Planificado» | 1. Pedir por la API el paso directo a EN_CURSO. | `{ "estado": "EN_CURSO" }` | 422. Mensaje: «No se puede pasar de «Planificado» a «En curso». Los estados solo avanzan, de uno en uno.» |
| CP-US06-12 | US06 | excepción | 2026 «En matrícula» | 1. Pedir por la API volver a PLANIFICADO. | `{ "estado": "PLANIFICADO" }` | 422 `TRANSICION_NO_PERMITIDA`; el estado no cambia. |
| CP-US06-13 | US06 | excepción | 2026 «En cierre»; existe al menos un cierre de calificación de sus bimestres sin publicar | 1. «Cerrar año». 2. Confirmar. | — | No se cierra. Mensaje en el modal: «No se puede cerrar el año: existen notas sin publicar». |
| CP-US06-14 | US06 | excepción | 2026 «En cierre»; ningún cierre de calificación registrado | 1. «Cerrar año». 2. Confirmar. | — | No se cierra. Mensaje: «No se puede cerrar el año: existen notas sin publicar». |
| CP-US06-15 | US06 | básico | 2026 «En cierre»; todos los cierres de calificación de sus bimestres en PUBLICADO | 1. «Cerrar año». 2. Confirmar. | — | El año pasa a «Cerrado»; desaparece el botón de transición, aparece «Año cerrado» y los bimestres quedan sin edición. |
| CP-US06-16 | US06 | excepción | 2027 «En curso»; 2028 «En matrícula» | 1. En 2028, «Iniciar clases» y confirmar. | — | 409. Mensaje: «Ya hay otro año académico en curso. Pásalo a cierre antes de iniciar las clases de este año.» |
| CP-US06-17 | US06 | excepción | 2027 y 2028 «En matrícula», ninguno en curso | 1. Enviar a la vez (API) EN_CURSO para ambos. | Dos solicitudes simultáneas | Una responde 200; la otra 409 `ANIO_EN_CURSO_EXISTENTE` (violación de `uq_anio_en_curso` convertida en error claro, no 500). |
| CP-US06-18 | US06 | excepción | 2026 «Cerrado» | 1. Editar sus fechas (API PATCH) o pedir otro cambio de estado. | `{ "fechaFin": "2026-12-20" }` | 422. Mensaje: «El año académico está cerrado y ya no se puede modificar.» |
| CP-US06-19 | US06 | excepción | 2026 con sus 4 bimestres | 1. Acortar el año (API PATCH) dejando fuera el Bimestre IV. | `{ "fechaFin": "2026-12-01" }` | 422. Mensaje: «Los bimestres registrados quedarían fuera de las nuevas fechas del año. Ajusta primero los bimestres.» |
| CP-US06-20 | US06 | excepción | Sesión de un perfil que no es Administrador | 1. Abrir `/admin/anio` o llamar a la API. | — | Pantalla: redirige a «Acceso denegado». API: 403 `ACCESO_DENEGADO`. |

## US07 · Periodos de evaluación (bimestres)

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US07-01 | US07 | básico | 2026 (02/03/2026–18/12/2026) sin bimestres | 1. Llenar las fechas de los 4 bimestres. 2. «Guardar bimestres». | I 02/03–08/05 · II 18/05–24/07 · III 10/08–09/10 · IV 19/10–18/12 | Aviso «Se guardaron los bimestres del año 2026.». Los 4 quedan «Inactivo», con nombres «Bimestre I» a «Bimestre IV»; la lista muestra «4 de 4». Auditoría `GUARDAR_PERIODOS_EVALUACION`. |
| CP-US07-02 | US07 | alterno | CP-US07-01 hecho | 1. Cambiar el fin del Bimestre III. 2. Guardar. | III termina 10/10/2026 | Se guarda; el formulario muestra la nueva fecha. |
| CP-US07-03 | US07 | excepción | 2026 sin bimestres | 1. Dejar vacía alguna fecha y guardar. | Bimestre IV sin fechas | No se envía. Mensaje: «Completa las fechas de inicio y fin de los 4 bimestres.» |
| CP-US07-04 | US07 | excepción | 2026 | 1. Guardar con un bimestre cuyo fin no es posterior al inicio. | II 18/05–10/05 | No se guarda. Mensaje: «Bimestre II: la fecha de fin debe ser posterior a la fecha de inicio». |
| CP-US07-05 | US07 | excepción | 2026 | 1. Guardar con un bimestre que sale del año. | IV 19/10–30/12 | No se guarda. Mensaje: «El Bimestre IV debe estar dentro del año académico (del 02/03/2026 al 18/12/2026).» |
| CP-US07-06 | US07 | excepción | 2026 | 1. Guardar con dos bimestres que se cruzan. | I 02/03–08/05 · II 04/05–24/07 | No se guarda. Mensaje: «Los periodos de evaluación no pueden solaparse». |
| CP-US07-07 | US07 | excepción | 2026 | 1. Guardar con un bimestre que empieza el mismo día que termina el anterior. | I termina 08/05 · II empieza 08/05 | No se guarda. Mensaje: «Los periodos de evaluación no pueden solaparse». |
| CP-US07-16 | US07 | excepción | 2026 | 1. Guardar bimestres que no se solapan pero no van en orden. | I 18/05–24/07 · II 02/03–08/05 · III y IV correctos | No se guarda. Mensaje: «Los bimestres deben registrarse en orden». |
| CP-US07-08 | US07 | excepción | 2026 | 1. Enviar por la API solo 3 bimestres. | Bimestres 1, 2 y 3 | 400 `DATOS_INVALIDOS`: «Registra los 4 bimestres». |
| CP-US07-09 | US07 | excepción | 2026 | 1. Enviar por la API 4 bimestres con un número repetido. | Números 1, 2, 3, 3 | 400. Mensaje: «Registra los 4 bimestres, del I al IV, sin repetir ninguno.» |
| CP-US07-10 | US07 | excepción | Bimestre I en estado FINALIZADO | 1. Cambiar las fechas del Bimestre I y guardar (en pantalla sus campos están bloqueados; probar por la API). | I termina 09/05 | 422. Mensaje: «No se puede editar el Bimestre I porque ya está finalizado.» |
| CP-US07-11 | US07 | alterno | Bimestre I en estado FINALIZADO | 1. Cambiar solo el Bimestre III y guardar. | III termina 10/10 | Se guarda; el Bimestre I no cambia. |
| CP-US07-12 | US07 | excepción | 2026 «Cerrado» | 1. Intentar guardar bimestres. | Cualquier fecha | En pantalla los campos están bloqueados y no hay botón «Guardar». API: 422 «El año académico está cerrado y ya no se puede modificar.» |
| CP-US07-13 | US07 | básico | 2026 «En curso» con sus 4 bimestres; Bimestre II no finalizado | 1. El módulo de notas llama a `periodoVigente(anioId, fecha)`. | Fecha 01/06/2026 | Devuelve el Bimestre II. |
| CP-US07-14 | US07 | alterno | Igual que CP-US07-13 | 1. Llamar a `periodoVigente` con una fecha entre bimestres. | Fecha 01/08/2026 (vacaciones) | Devuelve `null`: no se pueden registrar notas. |
| CP-US07-15 | US07 | alterno | 2026 «En matrícula» con sus 4 bimestres | 1. Llamar a `periodoVigente`. | Fecha 01/06/2026 | Devuelve `null`: solo hay bimestre vigente en un año «En curso». |

## US08 · Grados y secciones

Precondición adicional: año 2026 «En matrícula» y las aulas de los casos registradas.

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US08-01 | US08 | básico | PC; Aula 101 (aforo 30); un docente activo | 1. Ir a «Grados, secciones y aulas». 2. Llenar «Nueva sección». 3. «Guardar sección». | 1° de secundaria, A, aforo 30, Aula 101, tutor M. Torres | Aviso «Se creó la sección 1° A.». Aparece con vacantes 0/30, estado «Activa», aula y tutor. Auditoría `CREAR_SECCION`. |
| CP-US08-02 | US08 | alterno | PC | 1. Crear una sección sin aula ni tutor. | 1°, B, aforo 30 | Se crea con «Sin aula» y «Sin tutor». |
| CP-US08-03 | US08 | alterno | Existe 1° A | 1. Crear la sección A en otro grado. | 3°, A, aforo 25 | Se crea: el nombre solo se repite dentro del mismo grado. |
| CP-US08-04 | US08 | excepción | Existe 1° A | 1. Crear otra sección A en 1°. | 1°, A (o «a») | No se crea. Mensaje bajo el nombre: «Ya existe una sección con ese nombre en este grado». |
| CP-US08-05 | US08 | excepción | Aula 206 con aforo 28 | 1. Crear o editar una sección con aforo 32 y el Aula 206. | aforo 32 | No se guarda. Mensaje: «El aforo de la sección (32) supera el del aula (28).» (trigger). |
| CP-US08-06 | US08 | excepción | PC | 1. Crear una sección con aforo 0. | aforo 0 | No se crea. Mensaje: «El aforo debe ser un número entero mayor a 0». |
| CP-US08-07 | US08 | excepción | PC | 1. Crear una sección con nombre que no sean letras. | nombre «1» | 400. Mensaje: «El nombre de la sección debe ser una o más letras (A, B, C…)». |
| CP-US08-08 | US08 | excepción | Docente inactivo registrado | 1. Elegir como tutor a un docente inactivo (API). | tutorId del docente inactivo | 422. Mensaje: «El tutor debe ser un docente activo.» |
| CP-US08-09 | US08 | excepción | Aula 206 desactivada | 1. Asignar el Aula 206 a una sección (API; en pantalla no aparece). | aulaId del Aula 206 | 422. Mensaje: «El aula está inactiva. Actívala o elige otra.» |
| CP-US08-10 | US08 | excepción | Año 2025 «Cerrado» | 1. Crear una sección en 2025 (API; en pantalla el panel queda bloqueado). | 1°, A | 422. Mensaje: «El año académico está cerrado y ya no se puede modificar.» |
| CP-US08-11 | US08 | básico | 1° C con aforo 2 y 2 alumnos matriculados | 1. Ver la lista de secciones. | — | 1° C muestra 2/2 con barra roja, fila resaltada y estado «Aforo completo». |
| CP-US08-12 | US08 | excepción | 1° C con alumnos matriculados | 1. Eliminar 1° C y confirmar. | — | No se elimina. Alerta «No se puede eliminar una sección con alumnos matriculados» con «1° C tiene 2 estudiantes matriculados…» y el botón «Inactivar sección». |
| CP-US08-13 | US08 | básico | 1° C con alumnos matriculados | 1. «Inactivar sección» (alerta o ícono de la fila). | — | 1° C queda «Inactiva» y conserva a sus alumnos. Auditoría `INACTIVAR_SECCION`. |
| CP-US08-14 | US08 | básico | 1° B sin matrículas | 1. Eliminar 1° B y confirmar. | — | Aviso «Se eliminó la sección 1° B.». Auditoría `ELIMINAR_SECCION`. |
| CP-US08-15 | US08 | alterno | 1° B con un curso asignado o un horario, sin matrículas | 1. Eliminar 1° B. | — | 409. Mensaje: «No se puede eliminar la sección porque ya tiene cursos, horarios u otros registros. Puedes inactivarla.» |
| CP-US08-16 | US08 | básico | Existen secciones de 2026 y 2025 | 1. Cambiar el año en el selector. | Año 2025 | Se muestran las secciones de 2025. Por defecto se abre el año en curso (o el que está en matrícula). |
| CP-US08-17 | US08 | básico | 1° C completa (2/2) | 1. La matrícula llama a `vacantesSeccion` y `verificarVacantes`. | — | Se rechaza con «Sección sin vacantes disponibles (2/2)». |
| CP-US08-18 | US08 | alterno | 1° C inactiva | 1. La matrícula llama a `verificarVacantes`. | — | Se rechaza con «La sección está inactiva y no recibe nuevas matrículas.» |

## US09 · Aulas y aforo

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US09-01 | US09 | básico | PC | 1. En «Aulas físicas», llenar nombre, ubicación y aforo. 2. «Registrar aula». | Aula 101, Pabellón A · 1er piso, 30 | Aviso «Se registró Aula 101.». Aparece activa con aforo 30. Auditoría `CREAR_AULA`. |
| CP-US09-02 | US09 | excepción | PC | 1. Registrar un aula con aforo 0. | Aula 305, aforo 0 | No se registra. Mensaje bajo el aforo: «El aforo debe ser un número entero mayor a 0». |
| CP-US09-03 | US09 | excepción | PC | 1. Registrar un aula con aforo decimal (API). | aforo 25.5 | 400. Mensaje: «El aforo debe ser un número entero mayor a 0». |
| CP-US09-04 | US09 | excepción | Existe Aula 101 | 1. Registrar otra aula con el mismo nombre. | Aula 101 | No se registra. Mensaje: «Ya existe un aula con ese nombre». |
| CP-US09-05 | US09 | excepción | 1° A (aforo 30) usa el Aula 101 | 1. Editar el Aula 101 con aforo 25. | aforo 25 | No se guarda. Mensaje: «El aforo del aula no puede ser menor que el de sus secciones (máximo 30).» |
| CP-US09-06 | US09 | excepción | 1° A usa el Aula 101 | 1. Desactivar el Aula 101. | — | No se desactiva. Mensaje: «El aula está asignada a 1° A. Quítala de esas secciones antes de inactivarla.» |
| CP-US09-07 | US09 | básico | Aula 206 sin secciones activas | 1. Desactivar el Aula 206. | — | Queda «desactivada» en la lista (no se borra) y ya no aparece al elegir aula. Auditoría `DESACTIVAR_AULA`. |
| CP-US09-08 | US09 | alterno | Aula 206 desactivada | 1. Activarla con el ícono de la fila. | — | Vuelve a estar disponible. Auditoría `ACTIVAR_AULA`. |
| CP-US09-09 | US09 | básico | 1° A usa el Aula 101 con alumnos matriculados | 1. Ver «Aulas físicas». | — | El Aula 101 muestra «Sección asignada» 1° A y su ocupación (matriculados/aforo del aula). |

## US10 · Registro de cursos

Precondición adicional: año 2026 creado (no cerrado) y el seed cargado (11 áreas, 28 competencias y 10 cursos).

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US10-01 | US10 | básico | PC | 1. Ir a «Cursos y competencias». 2. Llenar «Registrar nuevo curso». 3. «Guardar curso». | ART-2, Arte y Cultura II, área Arte y Cultura, 4° y 5°, 2 h, competencia C1 | Aviso «Se registró el curso Arte y Cultura II.». Aparece en la malla con «4° y 5° · 2 h/sem · 1 comp.» y queda elegido. Auditoría `CREAR_CURSO`, `GUARDAR_PLAN_ESTUDIO` y `GUARDAR_COMPETENCIAS_PLAN`. |
| CP-US10-02 | US10 | alterno | PC | 1. Registrar un curso sin elegir grados. | TUT, Tutoría, área DPCC | Se registra con «Sin grados este año»; los grados y competencias se agregan después en sus bloques. |
| CP-US10-03 | US10 | excepción | Existe MAT | 1. Registrar un curso con el código MAT (o «mat»). | MAT | No se registra. Mensaje bajo el código: «Ya existe un curso registrado con ese código». |
| CP-US10-04 | US10 | excepción | PC | 1. Registrar un curso sin área curricular. | ART-2, sin área | No se registra. Mensaje bajo el área: «Debe seleccionar el área curricular del curso». |
| CP-US10-05 | US10 | excepción | PC | 1. Registrar un curso con código «M» (API). | M | 400. Mensaje: «El código del curso debe tener de 2 a 12 letras, números o guiones (por ejemplo, ART-2)». |
| CP-US10-06 | US10 | básico | Matemática sin grados en 2026 | 1. En «Grados y horas semanales», marcar 1° a 5° con 6 h. 2. «Guardar grados». | 6 h | La malla muestra «1° a 5° · 6 h/sem». Auditoría `GUARDAR_PLAN_ESTUDIO`. |
| CP-US10-07 | US10 | excepción | PC | 1. Guardar grados con 0 horas. | 0 h | No se guarda. Mensaje: «Las horas semanales deben ser un número entero mayor a 0». |
| CP-US10-08 | US10 | excepción | Matemática 1° con un docente asignado o notas | 1. Desmarcar 1° y guardar. | — | 409. Mensaje: «No se puede quitar 1° de secundaria: el curso ya tiene docentes asignados o notas en ese grado.» |
| CP-US10-09 | US10 | excepción | Matemática con un docente asignado y un horario publicado | 1. Ver el detalle de Matemática. 2. Eliminar (API). | — | El detalle muestra «Este curso no puede eliminarse» con los docentes y horarios, y no ofrece «Eliminar». La API responde 409: «No se puede eliminar un curso asignado; desactívalo en su lugar». |
| CP-US10-10 | US10 | básico | ART-2 sin docentes ni horarios | 1. «Eliminar» y confirmar. | — | Aviso «Se eliminó el curso Arte y Cultura II.». Se borran también sus grados y competencias. Auditoría `ELIMINAR_CURSO`. |
| CP-US10-11 | US10 | básico | Matemática activa | 1. «Desactivar». 2. «Activar». | — | Queda «Inactivo» (gris en la malla) y luego «Activo». Auditoría `DESACTIVAR_CURSO` y `ACTIVAR_CURSO`. |
| CP-US10-12 | US10 | excepción | Matemática con competencias configuradas | 1. Editar y cambiar el área a Ciencia y Tecnología. | — | No se guarda. Mensaje bajo el área: «No se puede cambiar el área: el curso ya tiene competencias del área actual. Quítalas primero.» |
| CP-US10-13 | US10 | básico | Cursos de varias áreas | 1. Filtrar por área y por estado; buscar por código. | Matemática / Inactivos / «com» | La malla solo muestra los cursos que cumplen los filtros. |
| CP-US10-14 | US10 | excepción | Año 2025 «Cerrado» | 1. Guardar grados de un curso en 2025 (API; en pantalla el bloque queda de solo lectura). | — | 422. Mensaje: «El año académico está cerrado y ya no se puede modificar.» |

## US11 · Competencias por curso

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US11-01 | US11 | básico | Matemática en 1° | 1. En «Competencias del curso», elegir 1°. 2. Marcar C1 a C4. 3. «Guardar competencias». | — | Aviso «Se guardaron las competencias de 1° de secundaria.». «4 de 4 seleccionadas». Auditoría `GUARDAR_COMPETENCIAS_PLAN`. |
| CP-US11-02 | US11 | alterno | Matemática 1° con C1 a C4 | 1. Desmarcar C4 (sin notas) y guardar. | — | Se guarda con C1 a C3. |
| CP-US11-03 | US11 | excepción | Matemática 1° | 1. Desmarcar todas y guardar. | — | No se guarda. Mensaje: «Debes seleccionar al menos una competencia». |
| CP-US11-04 | US11 | excepción | Matemática 1° | 1. Enviar una competencia de Ciencia y Tecnología (API; en pantalla solo se listan las del área). | CYT-C1 | 422. Mensaje: «La competencia no pertenece al área del curso». |
| CP-US11-05 | US11 | excepción | Matemática 1° | 1. Enviar la misma competencia dos veces (API). | MAT-C1 dos veces | 400. Mensaje: «Una competencia no puede repetirse en el mismo curso y grado». |
| CP-US11-06 | US11 | excepción | Matemática 1° | 1. Enviar un peso de 0 (API). | peso 0 | 400. Mensaje: «El peso debe ser un número mayor a 0». |
| CP-US11-07 | US11 | básico | Matemática 1° | 1. Enviar C4 con peso 1.5 (API). | peso 1.5 | Se guarda el peso; el orden sigue la lista. |
| CP-US11-08 | US11 | excepción | MAT-C1 de 1° con notas registradas | 1. Desmarcar C1. | — | No se desmarca. Alerta «No se puede desmarcar una competencia con notas registradas» con «“Resuelve problemas de cantidad” tiene N notas registradas.». Por API: 409 «No se puede eliminar una competencia con notas registradas.» |
| CP-US11-09 | US11 | excepción | Registrar un curso con grados | 1. Marcar grados y no marcar competencias. | ART-2, 4° | Aviso «Debes seleccionar al menos una competencia» y no se guarda. |
| CP-US11-10 | US11 | alterno | Comunicación en 1° sin competencias | 1. El registro de notas llama a `competenciasDelPlan` y `verificarCompetenciasConfiguradas`. | — | Se rechaza con «Este curso no tiene competencias configuradas. Contacte al administrador.» |
| CP-US11-11 | US11 | básico | PC | 1. Abrir la pestaña «Catálogo oficial». | — | Se ven las 11 áreas con sus competencias del CNEB (solo lectura). |
