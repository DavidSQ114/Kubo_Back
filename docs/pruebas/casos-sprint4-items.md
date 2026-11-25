# Casos de prueba · Sprint 4, bloque M2: ítems de evaluación con pesos, competencias del docente, libreta y reportes del coordinador

DO-04 «Registro de notas» (`/docente/notas`) con «Competencias de mi curso», «Ítems» e «Importar CSV»; AP-04 y AL-03
con sus PDF; «Notas por alumno» (`/coordinador/notas-alumno`) y «Reporte de logro de competencias»
(`/coordinador/reporte-competencias`). API: [evaluacion.md](../api/evaluacion.md#ítems-de-evaluación-con-pesos-bloque-m2)
y [academico.md](../api/academico.md). Pantallas: [frontend-items-evaluacion.md](../frontend-items-evaluacion.md).

Pruebas automáticas:

- `tests/evaluacion/items.test.ts` (sin base): suma de pesos en centésimas, nota calculada con la función de la regla
  `PONDERADO` (AD 40 + B 60 → A; A 50 + B 50 → A por `MITAD_HACIA_ARRIBA`), alumno incompleto y pesos que no suman 100
  con su mensaje, recálculo (crear, cambiar, quitar; una competencia sin ítems no se toca), validación de la lista,
  confirmación, nota directa en una competencia con ítems, calificaciones fuera del registro y análisis del CSV.
- `tests/evaluacion/reportes.test.ts` (sin base): distribución con porcentajes, agrupación por curso y competencia,
  detalle por alumno, CSV con BOM y campos que empiezan como fórmula neutralizados.
- `tests/evaluacion/libreta.test.ts` y `tests/academico/cursos.test.ts` (sin base): detalle de ítems en la libreta,
  `PLAN_CON_NOTAS` y `COMPETENCIA_CON_ITEMS`.
- `tests/evaluacion/items.integracion.test.ts` (PostgreSQL, en el CI; año 2077, DNI 900024xx): 403 del docente ajeno,
  competencias de mi curso con auditoría, cálculo en la misma transacción y bitácora `ITEMS`, confirmación al quitar
  notas y al eliminar un ítem con calificaciones, importación CSV, `PLAN_CON_NOTAS`, triggers del registro cerrado en
  `item_evaluacion` y `calificacion_item`, libreta con ítems y PDF, apoderado con deuda (US26) y reportes.

**Precondición común (PC):** año **2026** «En curso» con el Bimestre IV activo y una regla de consolidación vigente.
Docente **Rosa Docente Demo** con Matemática (3 competencias) y Comunicación (2) en 3° A; 6 alumnos matriculados con
su apoderada **Lucía**; coordinadora **Carmen**. Solo datos ficticios (RNF14).

Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y
muestra el mensaje).

## Competencias de mi curso (fase 1)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M2-01 | básico | PC; el plan de Matemática de 3° sin notas en el año | DO-04 → «Competencias de mi curso» → marcar una competencia activa del área → peso en todas → «Guardar competencias». | Pesos 40, 30, 30 | «Se guardaron las competencias de Matemática en 3° de secundaria.» El aviso dice que aplica a 3° A y 3° B. La grilla se recarga con la nueva columna. Auditoría `GUARDAR_COMPETENCIAS_PLAN` con `por: "DOCENTE"`. |
| CP-M2-02 | excepción | CP-M2-01 | Indicar el peso de solo una competencia y guardar. | — | «Indica el peso de todas las competencias del curso o de ninguna.» No se guarda. |
| CP-M2-03 | excepción | Alguna nota registrada en el año | Abrir «Competencias de mi curso». | — | Solo lectura con «Este curso ya tiene notas registradas en el año: sus competencias ya no se pueden cambiar desde aquí. Si necesitas un cambio, pídelo a la coordinación académica.» Por la API: `409 PLAN_CON_NOTAS`. |
| CP-M2-04 | excepción | Sesión de otro docente | Por la API, `GET` y `PUT /academico/mis-cursos/{asignación de Rosa}/competencias`. | — | `403 ACCESO_DENEGADO` en los dos. |
| CP-M2-05 | excepción | Una competencia con ítems en algún registro, sin notas | Coordinador en AD-04 (o el docente) desmarca esa competencia y guarda. | — | `409 COMPETENCIA_CON_ITEMS` «No se puede quitar «…»: tiene ítems de evaluación en algún registro de notas. Elimínalos primero.» |

## Ítems y pesos (fases 2 y 3)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M2-06 | básico | PC | Matemática 3° A, Bimestre IV → «Ítems» de C1 → agregar dos ítems → «Guardar ítems». | Práctica calificada 40, Examen bimestral 60 | «Ítems de C1 guardados.» con «2 ítems con un total de 100 %». C1 muestra dos sub-columnas y «Nota C1 calculada»; el total «100 %» en verde. Auditoría `GUARDAR_ITEMS_EVALUACION`. |
| CP-M2-07 | básico | CP-M2-06 | Calificar a Ana: Práctica AD y Examen B → «Guardar cambios». | — | «Notas guardadas.» con «2 calificaciones de ítems y 1 nota calculada por ítems». La nota de C1 de Ana es **A** (2,8). En la bitácora de notas (coordinador) aparece con origen «Calculada por ítems». |
| CP-M2-08 | alterno | CP-M2-07 | Calificar a Bruno solo en la práctica y guardar. | C | C1 de Bruno queda «—» con el aviso «Falta calificar el ítem: Examen bimestral.» El cierre lo lista como pendiente. |
| CP-M2-09 | alterno | CP-M2-07 | «Ítems» de C1 → cambiar el examen a 50 → «Guardar ítems» → «Confirmar y guardar». | 40 + 50 | Antes de confirmar: «Confirma el cambio: se perderán datos» con «1 alumno queda sin nota…». Al confirmar: total «90 %» en rojo, aviso sobre la grilla y C1 sin nota para todos con «Los pesos de los ítems suman 90 %; deben sumar 100 %.». La bitácora registra la nota quitada («—»). |
| CP-M2-10 | alterno | CP-M2-09 | Volver a 40 y 60, reordenar (Examen primero) y guardar. | — | Sin confirmación. El orden cambia y la nota de Ana vuelve a calcularse. |
| CP-M2-11 | excepción | Ítems con calificaciones | Eliminar «Práctica calificada» y guardar. | — | Pide confirmación con «Se eliminan «Práctica calificada» con n calificaciones.». Al confirmar se borran sus calificaciones y se recalcula. |
| CP-M2-12 | excepción | PC | Guardar ítems con un nombre vacío, uno de 101 caracteres, dos iguales o un peso 0 / 101 / 10,555. | — | Mensajes «Escribe el nombre de cada ítem.», «…como máximo 100 caracteres.», «Hay dos ítems con el nombre…», «El peso de «…» debe ser mayor que 0 y hasta 100…». No se guarda. |
| CP-M2-13 | excepción | C1 con ítems | Por la API, `PUT …/notas` con una nota directa de C1. | — | `422 COMPETENCIA_CON_ITEMS` «La competencia C1 se califica por ítems…». |
| CP-M2-14 | excepción | Sesión de otro docente | Por la API, `PUT …/competencias/{C1}/items` y `PUT …/notas` del registro de Rosa. | — | `403 ACCESO_DENEGADO`; no se crea nada. |
| CP-M2-15 | excepción | Registro cerrado (US39) | «Ítems» ya no aparece; por la API, `PUT …/items`; en la base, `UPDATE calificacion_item` o `INSERT item_evaluacion`. | — | Por la API `409 REGISTRO_CERRADO`; en la base, error `REGISTRO_CERRADO: el registro de notas está cerrado…`. Las calificaciones se ven en solo lectura. |
| CP-M2-16 | alterno | Registro cerrado con C1 por ítems | El docente pide rectificar la nota de C1 de Ana (M-08) y el coordinador la aprueba. | A → AD | Cambia la nota de la competencia (US41); las calificaciones de los ítems no cambian. La libreta muestra los ítems y la nota rectificada. |
| CP-M2-17 | básico | 1366 × 900 | Abrir el registro con 3 ítems en C1 y 2 en C3. | — | La página no se desborda (la tabla se desplaza dentro de su tarjeta, con el estudiante fijo). |

## Importar CSV (fase 7)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M2-18 | básico | CP-M2-06 | «Ítems» → «Importar calificaciones (CSV)» del examen → elegir el archivo. | `dni,calificativo` / DNI de Bruno `,b` / `90009999,A` / DNI de Ana `,15` | «1 fila válida · 2 filas rechazadas»; motivos «No hay un alumno con ese DNI en este registro.» y «Solo se permiten los valores AD, A, B o C.». |
| CP-M2-19 | básico | CP-M2-18 | «Importar 1 calificación». | — | «Se importaron 1 calificación de «Examen bimestral» y se calcularon 1 nota.»; la grilla muestra B en el examen de Bruno y su nota calculada. |
| CP-M2-20 | excepción | — | Importar un archivo vacío o de más de 300 filas. | — | «El archivo no tiene filas…» o «El archivo admite como máximo 300 filas.» |

## Libreta (fase 5)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M2-21 | básico | Matemática del Bimestre III cerrada y publicada, con ítems en C1 | Apoderada → «Notas» → Bimestre III. | — | Bajo «Resuelve problemas de cantidad», «Práctica calificada · peso 40 %» y «Examen bimestral · peso 60 %» con su calificativo. Comunicación (cerrada sin publicar): «Pendiente de publicación», sin notas ni ítems. |
| CP-M2-22 | básico | CP-M2-21 | «Descargar libreta (PDF)». | — | El PDF trae las filas «· Práctica calificada (peso 40 %)» con su calificativo y la explicación del cálculo. |
| CP-M2-23 | básico | CP-M2-21; sesión del alumno | «Mis notas» (AL-03) y su PDF. | — | El mismo detalle de ítems. |
| CP-M2-24 | excepción | Alumno con 2 pensiones vencidas | Apoderada abre su libreta y el PDF. | — | Restricción por deuda (US26): ninguna nota ni ítem; PDF `403 LIBRETA_RESTRINGIDA`. |
| CP-M2-25 | excepción | Registro con ítems cerrado pero no publicado | Apoderada y alumno abren la libreta. | — | No aparecen sus notas ni sus ítems. |

## Reportes del coordinador (fase 6)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M2-26 | básico | Sesión de la coordinadora | «Notas por alumno» → buscar por apellido o DNI → elegir al alumno. | Quispe | La libreta del año por bimestre: Matemática «Publicado», Comunicación «Sin publicar · cerrado» con sus notas; en el bimestre en curso «Sin publicar · en registro»; los cursos sin notas «Sin publicar · sin notas». Las competencias con ítems los muestran con peso y calificativo. |
| CP-M2-27 | básico | Registros cerrados o publicados | «Logro de competencias». | Año 2026 · Bimestre III | Aviso «Solo se incluyen registros cerrados por el docente o publicados». Por curso y competencia: cantidad y porcentaje de AD, A, B y C, total y el logro del curso; «Detalle por alumno» con el logro de cada uno. Los registros abiertos no cuentan. |
| CP-M2-28 | alterno | CP-M2-27 | Filtrar por grado, sección y curso. | 3° · 3° A · Matemática | Solo esa sección y curso; las listas de sección y curso solo ofrecen las que tienen registros. |
| CP-M2-29 | básico | CP-M2-27 | «Descargar CSV» y «Descargar PDF». | — | `Reporte_logro_BimestreIII_2026.csv` (se abre con tildes en la hoja de cálculo; una fila por alumno y competencia y el logro del curso) y el PDF con el resumen y el detalle. |
| CP-M2-30 | excepción | Sesión de un docente o del administrador | Por la API, los cuatro endpoints de `/evaluacion/reportes`. | — | `403 ACCESO_DENEGADO`. |
