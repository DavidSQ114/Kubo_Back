# Casos de prueba · Sprint 2, bloque 1: edición del año (US06), bimestres (US07), reglas de consolidación (US12) y persona por DNI (D-07)

Pantallas AD-02 «Año académico y bimestres» (`/admin/anio`), AD-04 «Cursos y competencias» (`/admin/cursos`), AD-05 «Reglas de evaluación» (`/admin/reglas`) y AD-07 «Registrar docente» (`/admin/usuarios/registrar-docente`). API: [academico.md](../api/academico.md) y [comunidad.md](../api/comunidad.md).
Continúa la numeración de [casos-academico.md](casos-academico.md) y [casos-comunidad.md](casos-comunidad.md). Las reglas puras se prueban además con Vitest (sección «Casos unitarios»).

**Precondición común (PC):** sesión iniciada como Administrador (`admin@kubo.edu.pe`) con la contraseña ya cambiada. Año 2026 (02/03/2026–18/12/2026) con sus 4 bimestres: I 02/03–08/05 · II 18/05–24/07 · III 10/08–09/10 · IV 19/10–18/12. Solo datos ficticios.
Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y muestra el mensaje).

## US06 · Editar y eliminar el año académico (feedback del JP) e insignia de la barra superior

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US06-23 | US06 | básico | PC, 2026 «En matrícula» | 1. Elegir 2026. 2. En «Periodos de evaluación · 2026», «Editar año». 3. Cambiar la fecha de fin. 4. «Guardar cambios». | Fin 21/12/2026 | Aviso «Se actualizaron las fechas del año 2026.». La vigencia muestra «02/03/2026 – 21/12/2026». Auditoría `EDITAR_ANIO_ACADEMICO` con las fechas antes y después. |
| CP-US06-24 | US06 | alterno | PC | 1. «Editar año» sin cambiar nada. | — | «Guardar cambios» queda deshabilitado. |
| CP-US06-25 | US06 | excepción | PC | 1. «Editar año». 2. Poner una fecha de inicio de otro año. 3. Guardar. | Inicio 20/12/2025 | No se guarda. Bajo «Fecha de inicio»: «La fecha de inicio debe estar en 2026: el año debe coincidir con ella.» (API: `400 ANIO_NO_COINCIDE` «El año debe coincidir con la fecha de inicio»). |
| CP-US06-26 | US06 | excepción | PC | 1. «Editar año». 2. Acortar el año dejando fuera el Bimestre IV. 3. Guardar. | Fin 01/12/2026 | No se guarda. Mensaje: «Los bimestres registrados quedarían fuera de las nuevas fechas del año. Ajusta primero los bimestres.» |
| CP-US06-27 | US06 | excepción | PC; existe 2027 (01/03/2027–17/12/2027) | 1. «Editar año» de 2026. 2. Extender el fin hasta marzo de 2027. 3. Guardar. | Fin 10/03/2027 | No se guarda. Mensaje: «Ya existe un año académico activo en ese rango de fechas». |
| CP-US06-28 | US06 | excepción | PC | 1. «Editar año». 2. Poner un fin anterior al inicio. 3. Guardar. | Fin 01/03/2026 | No se guarda. Bajo «Fecha de fin»: «La fecha de fin debe ser posterior a la fecha de inicio». |
| CP-US06-29 | US06 | excepción | 2026 «Cerrado» | 1. Elegir 2026. 2. Editar por la API. | `PATCH { "fechaFin": "2026-12-20" }` | En pantalla no aparecen «Editar año» ni «Editar bimestres». API: `422 ANIO_CERRADO` «El año académico está cerrado y ya no se puede modificar.» |
| CP-US06-30 | US06 | básico | Existe 2027 «Planificado» sin secciones, planes ni matrículas | 1. Elegir 2027. 2. «Eliminar año». 3. Confirmar. | — | Aviso «Se eliminó el año académico 2027.». El año desaparece de la lista con sus bimestres. Auditoría `ELIMINAR_ANIO_ACADEMICO` con año, fechas y bimestres. |
| CP-US06-31 | US06 | excepción | 2027 «Planificado» con una sección | 1. «Eliminar año». 2. Confirmar. | Sección 1° A en 2027 | No se elimina. Mensaje en el modal: «No se puede eliminar el año porque ya tiene secciones, planes de estudio o matrículas. Puedes editar sus fechas.» |
| CP-US06-32 | US06 | excepción | 2026 «En curso» | 1. Ver el detalle de 2026. 2. Eliminar por la API. | `DELETE /academico/anios/{id}` | En pantalla no aparece «Eliminar año». API: `409 ANIO_NO_ELIMINABLE` «Solo se puede eliminar un año en estado «Planificado». Este año está «En curso».» |
| CP-US06-33 | US06 | básico | 2026 «En curso»; hoy 06/11/2026 | 1. Abrir cualquier pantalla del portal. | — | La barra superior muestra «Año 2026 · Bimestre IV en curso». |
| CP-US06-34 | US06 | alterno | 2026 «En curso»; hoy entre bimestres (por ejemplo 30/07/2026) | 1. Abrir el portal. | — | La insignia dice «Año 2026 · Vacaciones». |
| CP-US06-35 | US06 | alterno | Solo 2026 «En matrícula» | 1. Abrir el portal. | — | La insignia dice «Año 2026 · En matrícula». Tras «Iniciar clases» en AD-02 se actualiza sin recargar. |
| CP-US06-36 | US06 | alterno | Sin años, o todos «Cerrado» | 1. Abrir el portal. | — | No hay insignia (API `GET /academico/anios/actual` → `null`). |
| CP-US06-37 | US06 | alterno | Año 2028 recién creado, sin bimestres (defecto D-08) | 1. Abrir AD-02 con 2028. 2. Revisar los botones del formulario de bimestres. 3. «Eliminar año» y confirmar. | — | Junto a «Agregar bimestre» y «Guardar configuración» se ven «Eliminar año» y «Editar año». Al eliminarlo, 2028 desaparece de la lista. |

## US07 · Editar bimestres en modo explícito y bimestre vigente

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US07-17 | US07 | básico | PC | 1. Abrir «Año y bimestres». | — | Las fechas de los bimestres se ven como texto y la cabecera ofrece «Editar bimestres» (junto a «Editar año»). |
| CP-US07-18 | US07 | básico | PC | 1. «Editar bimestres». 2. Cambiar el fin del Bimestre IV. 3. «Guardar cambios». | IV termina 17/12/2026 | Aviso «Se guardaron los bimestres del año 2026.». La tabla vuelve a solo lectura. Auditoría `GUARDAR_PERIODOS_EVALUACION` con las fechas antes y después. |
| CP-US07-19 | US07 | alterno | PC | 1. «Editar bimestres». 2. Cambiar una fecha. 3. «Cancelar». | — | Se descartan los cambios y la tabla vuelve a solo lectura con las fechas guardadas. |
| CP-US07-20 | US07 | excepción | Bimestre I FINALIZADO | 1. «Editar bimestres». | — | El Bimestre I sigue como texto y aparece «Los bimestres finalizados no se editan: sus fechas se muestran como texto.»; los demás se editan. |
| CP-US07-21 | US07 | alterno | 2027 sin bimestres | 1. Elegir 2027. | — | La tabla empieza en edición, con «Guardar configuración» y sin «Cancelar». |
| CP-US07-22 | US07 | básico | 2026 «En curso»; hoy 06/11/2026 | 1. Abrir «Año y bimestres». | — | «Bimestre IV» lleva la etiqueta verde «Vigente»; su estado guardado no cambia. |
| CP-US07-23 | US07 | alterno | 2026 «En matrícula» | 1. Abrir «Año y bimestres». | — | Ningún bimestre lleva «Vigente». |

## US12 · Reglas de consolidación

Precondición adicional: Bimestre I de 2026 FINALIZADO (los demás abiertos).

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US12-01 | US12 | básico | PC, 2026 sin reglas | 1. Abrir «Reglas de evaluación» (menú habilitado). | — | Insignia «Sin regla vigente». Formulario con «Moda de los logros» y «Mayor jerarquía (AD > A > B > C)»; «Rige desde» con el Bimestre I «(cerrado)» deshabilitado y el II elegido. Historial: «Aún no hay versiones». |
| CP-US12-02 | US12 | básico | CP-US12-01 | 1. «Guardar cambios». 2. Confirmar. | Moda, mayor jerarquía, desde Bimestre II | Aviso «Se guardó la versión 1 de la regla de 2026.». Insignia «Regla vigente: versión 1». Historial: «Versión 1 · Moda de los logros · Mayor jerarquía · Desde Bimestre II · Administrador Kubo · Vigente». Auditoría `CREAR_VERSION_REGLA_CONSOLIDACION`. |
| CP-US12-03 | US12 | básico | CP-US12-02 | 1. Elegir «Promedio ponderado». 2. «Rige desde» Bimestre III. 3. «Guardar cambios». 4. Confirmar. | — | Antes de confirmar: «Este cambio no afectará los bimestres ya cerrados» con «El Bimestre I ya está cerrado y conserva la versión con que se calculó. La nueva versión se aplicará desde el Bimestre III.». Luego: versión 2 «Vigente» «Desde Bimestre III»; versión 1 «Archivada» «Bimestre II». |
| CP-US12-04 | US12 | alterno | CP-US12-03 | 1. Elegir «Moda de los logros» y «Menor jerarquía (C < B < A < AD)». 2. Guardar y confirmar. | Desde Bimestre II | Se crea la versión 3. |
| CP-US12-05 | US12 | excepción | Versión vigente: moda, mayor jerarquía | 1. Dejar el mismo método y criterio. 2. Guardar por la API. | `{ "metodo": "MODA", "criterioDesempate": "MAYOR_JERARQUIA", … }` | En pantalla «Guardar cambios» queda deshabilitado. API: `409 REGLA_SIN_CAMBIOS` «La regla vigente ya usa ese método y criterio de desempate.» |
| CP-US12-06 | US12 | excepción | Bimestre I FINALIZADO | 1. Guardar por la API con «rige desde» el Bimestre I. | `rigeDesdeId` del Bimestre I | `422 RIGE_DESDE_CERRADO` «Ese bimestre ya está cerrado: la nueva versión debe regir desde un bimestre abierto.» |
| CP-US12-07 | US12 | excepción | 2026 con bimestres | 1. Guardar por la API sin «rige desde». | `{ "metodo": "MODA" }` | `400 RIGE_DESDE_REQUERIDO` «Elige el bimestre desde el que regirá la nueva versión.» |
| CP-US12-08 | US12 | excepción | PC | 1. Guardar por la API con un bimestre de otro año. | `rigeDesdeId` ajeno | `422 RIGE_DESDE_INVALIDO` «El bimestre elegido no pertenece a este año académico.» |
| CP-US12-09 | US12 | alterno | 2027 sin bimestres | 1. Guardar una regla para 2027. | Moda | Se crea la versión 1 sin «rige desde»; el historial dice «Todo el año». |
| CP-US12-10 | US12 | excepción | 2026 «Cerrado» | 1. Abrir «Reglas de evaluación» con 2026. 2. Guardar por la API. | — | Pantalla: «El año está cerrado», formulario de solo lectura y sin botones. API: `422 ANIO_CERRADO`. |
| CP-US12-11 | US12 | básico | PC | 1. En la vista previa con moda y mayor jerarquía, dejar C1 AD, C2 A, C3 AD, C4 A. | — | Frecuencias: AD 2, A 2. Alerta «Empate entre AD y A» y «Logro consolidado del curso: AD». Con «Menor jerarquía», el resultado pasa a A. |
| CP-US12-12 | US12 | básico | PC | 1. Elegir «Promedio ponderado». 2. En la vista previa, C1 AD (25), C2 A (25), C3 AD (25), C4 A (25). | — | «Promedio ponderado: 3,5» y logro AD (un ,5 sube al logro mayor). |
| CP-US12-13 | US12 | alterno | PC | 1. Simular por la API. | `{ "metodo": "PONDERADO", "logros": ["AD", "B"], "pesos": [1, 3] }` | `200 { logro: "A", promedio: 2.5 }`. |
| CP-US12-14 | US12 | excepción | PC | 1. Simular por la API sin logros. | `{ "metodo": "MODA", "logros": [] }` | `422 LOGROS_VACIOS` «No hay logros para consolidar.» |
| CP-US12-15 | US12 | básico | Regla vigente de 2026: «Promedio ponderado»; Matemática en 1° con C1 y C2 | 1. En AD-04, abrir Matemática. 2. En «Competencias del curso», poner 60 y 40. 3. «Guardar competencias». | C1 60 %, C2 40 % | Se ve «La regla vigente es «Promedio ponderado»…», un campo «%» por competencia y «Total de pesos 100 %». Se guardan los pesos. |
| CP-US12-16 | US12 | excepción | CP-US12-15 | 1. Marcar C3 sin peso. 2. «Guardar competencias». | — | No se guarda. Mensaje: «Indica el peso de todas las competencias del curso o de ninguna.» (API: `400 PESOS_INCOMPLETOS`). |
| CP-US12-17 | US12 | alterno | Regla vigente: «Moda de los logros» | 1. Abrir Matemática en AD-04. | — | No hay campos de peso; el texto explica que se editan cuando la regla vigente es «Promedio ponderado». Los pesos guardados se conservan. |
| CP-US12-18 | US12 | alterno | PC | 1. Ver «Exigir todas las competencias calificadas antes del cierre». | — | Fila bloqueada con candado: se configura con el cierre de bimestre (US39, Sprint 3). Queda fuera de US12. |
| CP-US12-19 | US12 | excepción | Sesión de un perfil que no es Administrador | 1. Abrir `/admin/reglas` o llamar a la API. | — | Pantalla: «Acceso denegado». API: `403 ACCESO_DENEGADO`. |

## US13 · Persona ya registrada con ese DNI (defecto D-07)

Precondición adicional: existe la administradora ficticia Rosa Elena Huamán Torres, DNI 41235678, sin perfil Docente.

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US13-12 | US13 | básico | PC | 1. Abrir «Registrar docente». 2. Escribir el DNI. | 41235678 | Alerta «Este DNI ya está registrado: Rosa Elena Huamán Torres (Administrador). Se le agregará el perfil Docente con sus datos actuales.». Nombres, apellidos y correo se llenan y quedan bloqueados. El botón dice «Agregar perfil Docente». «Acceso al sistema» indica que ingresará con su contraseña actual y no se muestra la vista previa del correo. |
| CP-US13-13 | US13 | básico | CP-US13-12 | 1. Elegir la especialidad. 2. «Agregar perfil Docente». | Matemática | Aviso «Rosa Elena Huamán Torres ya es docente» con «Se agregó el perfil Docente a una persona ya registrada. Ya tenía una cuenta, así que ingresa con su contraseña actual.». Auditoría `REGISTRAR_DOCENTE` con `personaExistia: true`. |
| CP-US13-14 | US13 | excepción | CP-US13-13 | 1. Abrir otra vez «Registrar docente». 2. Escribir el mismo DNI. | 41235678 | Bajo el DNI: «Ya existe un usuario registrado con este DNI». «Registrar docente» no envía nada. |
| CP-US13-15 | US13 | alterno | CP-US13-12 | 1. Tras el autollenado, cambiar el DNI. | 41235679 | Desaparece la alerta, los campos se vacían y se desbloquean, y el botón vuelve a «Registrar docente». |
| CP-US13-16 | US13 | excepción | PC | 1. Registrar por la API con ese DNI y otros nombres. | DNI 41235678, Juan Carlos Pérez Salazar | `409 PERSONA_NO_COINCIDE` «El DNI ya pertenece a otra persona (Rosa Elena Huamán Torres). Verifica el DNI.» No se agrega ningún perfil. |
| CP-US13-17 | US13 | alterno | PC | 1. Registrar por la API con los mismos nombres en mayúsculas y sin tildes. | DNI 41235678, ROSA ELENA / HUAMAN TORRES | Se agrega el perfil Docente (`personaExistia: true`); los datos de la persona no cambian. |
| CP-US13-18 | US13 | básico | PC | 1. Consultar un DNI nuevo por la API. | `GET /comunidad/personas?dni=45872199` | `200 { "data": null }`. |
| CP-US13-19 | US13 | excepción | PC | 1. Consultar un DNI de 7 dígitos. | `?dni=4123567` | `400 DATOS_INVALIDOS`: «El DNI debe tener 8 dígitos». |
| CP-US13-20 | US13 | excepción | Sesión de un perfil que no es Administrador | 1. Llamar a `GET /comunidad/personas?dni=41235678`. | — | `403 ACCESO_DENEGADO`. |

## Ajustes del Sprint 1

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US10-15 | US10 | básico | PC, Matemática | 1. En «Grados y horas semanales», marcar 2°. | — | El campo de horas muestra el placeholder «Ej.: 6» y el sufijo «h/sem»; los lectores de pantalla lo anuncian como «Horas semanales de 2° de secundaria». |

## Casos unitarios (Vitest)

Se ejecutan con `npm test`. No usan la base de datos y emplean fechas fijas.

| ID | Archivo | Qué verifica | Resultado esperado |
|---|---|---|---|
| CU-US12-01 | `tests/academico/consolidacion.test.ts` | Moda simple: `["A","B","A","C","A"]` | A |
| CU-US12-02 | ídem | Un solo logro: `["B"]` | B |
| CU-US12-03 | ídem | Empate de 2: `["AD","A","AD","A"]` | Mayor jerarquía → AD; menor → A |
| CU-US12-04 | ídem | Empate de 3: `["B","C","A","C","A","B"]` | Mayor → A; menor → C |
| CU-US12-05 | ídem | Empate de los 4 logros | Mayor → AD; menor → C |
| CU-US12-06 | ídem | Último registro (criterio del modelo, no configurable en AD-05) | El empatado que aparece más tarde |
| CU-US12-07 | ídem | En la moda los pesos no cuentan | `["C","C","AD"]` con pesos 1/1/50 → C |
| CU-US12-08 | ídem | Ponderado sin pesos | `["AD","A","B","C"]` → 2,5; `["AD","AD","A"]` → AD |
| CU-US12-09 | ídem | Ponderado con pesos distintos | `["AD","B"]` 1/3 → A; 3/1 → AD; `["C","AD","A"]` 10/30/60 → A |
| CU-US12-10 | ídem | Pesos relativos | 25/25/50 = 1/1/2 |
| CU-US12-11 | ídem | Redondeo al más cercano | 3,49 → A; 3,51 → AD; 1,2 → C; 2,7 → A |
| CU-US12-12 | ídem | Empates ,5 suben | 1,5 → B; 2,5 → A; 3,5 → AD |
| CU-US12-13 | ídem | ,5 con error de coma flotante | `["AD","AD","A"]` con 0,1/0,2/0,3 (3,4999…) → AD |
| CU-US12-14 | ídem | Pesos inválidos | Incompletos → `PESOS_INCOMPLETOS`; otra cantidad → `PESOS_NO_CORRESPONDEN`; 0 o negativo → `PESO_INVALIDO` |
| CU-US12-15 | ídem | Lista vacía y logro desconocido | `LOGROS_VACIOS` en ambos métodos; «D» → `LOGRO_INVALIDO` |
| CU-US12-16 | ídem | Versión que aplica a cada bimestre y texto «Aplicada a» | v1 (inicio) y v2 (III): I y II → v1, III y IV → v2; «Bimestres I y II», «Desde Bimestre III», «Todo el año», «Sin aplicar (reemplazada)» |
| CU-US12-17 | ídem | «Rige desde» | Bimestre abierto → válido; cerrado → `RIGE_DESDE_CERRADO`; ajeno → `RIGE_DESDE_INVALIDO`; sin elegir → `RIGE_DESDE_REQUERIDO`; año sin bimestres → desde el inicio |
| CU-US11-01 | `tests/academico/cursos.test.ts` | Pesos del plan en todas o en ninguna | Mezcla → `PESOS_INCOMPLETOS`; sin pesos → válido |
| CU-US06-01 | `tests/academico/reglas.test.ts` | Eliminar un año | Planificado sin registros → válido; otro estado → `ANIO_NO_ELIMINABLE`; con secciones, planes o matrículas → `ANIO_CON_REGISTROS` |
| CU-US06-02 | ídem | Insignia de la barra superior | «Año 2026 · Bimestre IV en curso», «Vacaciones» entre bimestres o sin bimestres, «Año 2027 · En matrícula» |
| CU-US06-03 | ídem | Año por defecto | En curso > En matrícula > abierto más reciente; solo cerrados → ninguno |
| CU-US07-01 | ídem | Bimestre que contiene el día («Vigente») | Lo encuentra aunque esté finalizado; fuera de los bimestres → ninguno |
| CU-US13-01 | `tests/comunidad/personas.test.ts` | Normalizar nombres | «  MARÍA   José » → «maria jose» |
| CU-US13-02 | ídem | Misma persona | Iguales sin distinguir mayúsculas, tildes ni espacios → válido |
| CU-US13-03 | ídem | Otra persona | Nombres o apellidos distintos → `PERSONA_NO_COINCIDE` con el nombre registrado en el mensaje |
| CU-US13-04 | ídem | Consulta por DNI | 8 dígitos (con espacios alrededor) → válido; 7 dígitos o sin DNI → error |
