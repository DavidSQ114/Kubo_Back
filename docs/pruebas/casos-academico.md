# Casos de prueba · Año académico (US06) y periodos de evaluación (US07)

Pantalla AD-02 «Año académico y bimestres» (`/admin/anio`) y API [academico.md](../api/academico.md).
Las reglas puras se prueban además en `tests/academico/reglas.test.ts`.

**Precondición común (PC):** sesión iniciada como Administrador (`admin@kubo.edu.pe`) con la contraseña ya cambiada, base de pruebas sin años académicos.
Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y muestra el mensaje).

## US06 · Creación del año académico

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US06-01 | US06 | básico | PC | 1. Ir a «Año y bimestres». 2. «Crear año académico». 3. Llenar y «Crear año». | Año 2026, inicio 02/03/2026, fin 18/12/2026 | Aviso «Se creó el año académico 2026…». El año aparece en la lista con estado «Planificado» y «0 de 4» bimestres. Auditoría `CREAR_ANIO_ACADEMICO`. |
| CP-US06-02 | US06 | alterno | PC | 1. Abrir «Año y bimestres» sin años registrados. | — | Estado vacío «Aún no hay años académicos» con el botón «Crear año académico». |
| CP-US06-03 | US06 | excepción | PC | 1. Crear año con fin anterior al inicio. | Año 2026, inicio 18/12/2026, fin 02/03/2026 | No se crea. Mensaje: «La fecha de fin debe ser posterior a la fecha de inicio». |
| CP-US06-04 | US06 | excepción | PC | 1. Crear año con inicio y fin iguales. | Año 2026, inicio y fin 02/03/2026 | No se crea. Mensaje: «La fecha de fin debe ser posterior a la fecha de inicio». |
| CP-US06-05 | US06 | excepción | Existe 2026 (02/03/2026–18/12/2026) no cerrado | 1. Crear otro año que se cruce con 2026. | Año 2027, inicio 01/12/2026, fin 17/12/2027 | No se crea. Mensaje: «Ya existe un año académico activo en ese rango de fechas». |
| CP-US06-06 | US06 | alterno | Existe 2026 en estado «Cerrado» | 1. Crear un año cuyo rango se cruce con 2026. | Año 2029, inicio 01/06/2026, fin 01/12/2026 | Se crea: los años cerrados no cuentan para el solapamiento. |
| CP-US06-07 | US06 | excepción | Existe 2026 | 1. Crear otra vez el año 2026 con otras fechas. | Año 2026, inicio 01/03/2027, fin 17/12/2027 | No se crea. Mensaje: «Ya existe el año académico 2026.» |
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
| CP-US07-08 | US07 | excepción | 2026 | 1. Enviar por la API solo 3 bimestres. | Bimestres 1, 2 y 3 | 400 `DATOS_INVALIDOS`: «Registra los 4 bimestres». |
| CP-US07-09 | US07 | excepción | 2026 | 1. Enviar por la API 4 bimestres con un número repetido. | Números 1, 2, 3, 3 | 400. Mensaje: «Registra los 4 bimestres, del I al IV, sin repetir ninguno.» |
| CP-US07-10 | US07 | excepción | Bimestre I en estado FINALIZADO | 1. Cambiar las fechas del Bimestre I y guardar (en pantalla sus campos están bloqueados; probar por la API). | I termina 09/05 | 422. Mensaje: «No se puede editar el Bimestre I porque ya está finalizado.» |
| CP-US07-11 | US07 | alterno | Bimestre I en estado FINALIZADO | 1. Cambiar solo el Bimestre III y guardar. | III termina 10/10 | Se guarda; el Bimestre I no cambia. |
| CP-US07-12 | US07 | excepción | 2026 «Cerrado» | 1. Intentar guardar bimestres. | Cualquier fecha | En pantalla los campos están bloqueados y no hay botón «Guardar». API: 422 «El año académico está cerrado y ya no se puede modificar.» |
| CP-US07-13 | US07 | básico | 2026 «En curso» con sus 4 bimestres; Bimestre II no finalizado | 1. El módulo de notas llama a `periodoVigente(anioId, fecha)`. | Fecha 01/06/2026 | Devuelve el Bimestre II. |
| CP-US07-14 | US07 | alterno | Igual que CP-US07-13 | 1. Llamar a `periodoVigente` con una fecha entre bimestres. | Fecha 01/08/2026 (vacaciones) | Devuelve `null`: no se pueden registrar notas. |
| CP-US07-15 | US07 | alterno | 2026 «En matrícula» con sus 4 bimestres | 1. Llamar a `periodoVigente`. | Fecha 01/06/2026 | Devuelve `null`: solo hay bimestre vigente en un año «En curso». |
