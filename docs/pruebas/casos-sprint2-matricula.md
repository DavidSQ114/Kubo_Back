# Casos de prueba · Sprint 2, bloque 3: matrícula en sección (US18) y cronograma de pagos (US21)

Pantallas AD-10 «Matrícula» (`/admin/matricula`), su modal M-19 «Anular matrícula» y el paso «Guardar y matricular» de AD-09. API: [matricula.md](../api/matricula.md), montos en [academico.md](../api/academico.md#montos-del-año-us21) y ejemplos en [matricula.http](../api/matricula.http).
Las reglas puras se prueban además con Vitest (sección «Casos unitarios»).

**Precondición común (PC):** sesión iniciada como Administrador (`admin@kubo.edu.pe`) con la contraseña ya cambiada. Seed cargado. Año 2026 «En curso» con 1° A (aforo 2) y 1° B (aforo 30), y año 2027 «En matrícula» con 1° A (aforo 1). Apoderado ficticio Jorge Luis Quispe Huamán vinculado como principal a los estudiantes ficticios de 1° de secundaria Valeria, Diego y Sofía Quispe Rojas; Mateo Quispe Rojas tiene una matrícula «En proceso» en 2027 (borrador de US17). Hoy: 06/11/2026. Solo datos ficticios (RNF14).
Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y muestra el mensaje).

## US18 · Matrícula en sección

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US18-01 | US18 | básico | PC; montos 2026 configurados | 1. Abrir «Matrícula» del menú. 2. Elegir «Año 2026». 3. Buscar «Valeria» y elegirla. 4. Elegir 1° A. 5. Dejar al responsable (principal) y «Mensual». 6. «Matricular». | — | Aviso «Valeria Quispe Rojas quedó matriculado en 1° A» y «Paso 3 de 3 · Cronograma de pagos». La fila aparece «Matriculado». Auditoría `CONFIRMAR_MATRICULA` y `GENERAR_CRONOGRAMA`. |
| CP-US18-02 | US18 | excepción | PC | 1. Matricular por la API sin sección. | `seccionId` ausente | `422 MATRICULA_INCOMPLETA` «Complete la sección y el apoderado responsable para confirmar la matrícula». En pantalla, «Matricular» sin sección muestra el mismo mensaje. |
| CP-US18-03 | US18 | excepción | CP-US18-01 | 1. Elegir otra vez a Valeria en 2026. | — | Aviso «Este estudiante ya está matriculado en el periodo actual» con la sugerencia del traslado de sección; «Matricular» deshabilitado. API: `409 YA_MATRICULADO` con `details.sugerencia`. |
| CP-US18-04 | US18 | básico | CP-US18-01 | 1. Matricular a Diego en 1° A. | — | Se matricula: era la última vacante (2/2). La tarjeta de 1° A pasa a «Sin vacantes» con candado. |
| CP-US18-05 | US18 | excepción | CP-US18-04 | 1. Elegir a Sofía y la tarjeta 1° A. 2. «Matricular». | — | Alerta «Sección sin vacantes disponibles (2/2)» con «1° A alcanzó su aforo máximo…». API: `409 SECCION_SIN_VACANTES` «Sección sin vacantes disponibles» con `details { matriculados: 2, aforo: 2 }`. |
| CP-US18-06 | US18 | excepción | Sección con una sola vacante | 1. Enviar al mismo tiempo dos matrículas de estudiantes distintos a esa sección. | Prueba de integración | Solo una se acepta; la otra recibe «Sección sin vacantes disponibles». Queda 1 matrícula y 11 cuotas (`tests/matricula/concurrencia.integracion.test.ts`). |
| CP-US18-07 | US18 | básico | PC; montos 2027 configurados | 1. Elegir a Mateo con «Año 2027». 2. Elegir 1° A. 3. «Matricular». | — | La insignia decía «En proceso»; se confirma esa misma matrícula (no se crea otra) y pasa a «Matriculado». |
| CP-US18-08 | US18 | alterno | Matrícula «En proceso» sin sección | 1. Verificar las vacantes antes de confirmarla. | — | No ocupa vacante: la barra de la sección no cuenta las matrículas «En proceso». |
| CP-US18-09 | US18 | excepción | PC | 1. Matricular por la API con el vínculo de otro estudiante como responsable. | `vinculoResponsableId` ajeno | `422 RESPONSABLE_NO_VINCULADO`. En pantalla solo se listan los apoderados vinculados al estudiante. |
| CP-US18-10 | US18 | excepción | PC | 1. Matricular por la API en 2026 con una sección de 2027. | — | `422 SECCION_OTRO_ANIO` «La sección no pertenece al año académico de la matrícula.». |
| CP-US18-11 | US18 | excepción | Año 2026 sin montos | 1. Abrir «Matrícula». | — | Aviso «El año 2026 no tiene montos de matrícula y pensión» con «Configurar montos»; «Matricular» deshabilitado. API: `422 SIN_MONTOS`. |
| CP-US18-12 | US18 | básico | CP-US18-11 | 1. «Configurar montos». 2. Revisar los valores precargados. 3. «Guardar montos». | 350 y 450.5 | Aviso «Se guardaron los montos del año 2026.»; la barra muestra «S/ 350.00» y «S/ 450.50». Auditoría `GUARDAR_MONTOS_ANIO`. |
| CP-US18-13 | US18 | excepción | PC | 1. Guardar montos con 0 o con tres decimales. | `0` · `350.123` | `400 MONTO_INVALIDO` «Ingresa un monto mayor a 0 con hasta dos decimales (por ejemplo, 350.00).». |
| CP-US18-14 | US18 | básico | Varias matrículas en 2026 | 1. Buscar «diego». 2. Filtrar «Matriculado» y la sección 1° A. 3. Filtrar por grado. | — | El listado muestra solo las que cumplen; sin resultados: «No hay matrículas con estos filtros…». |
| CP-US18-15 | US18 | básico | CP-US18-01 | 1. «Ver» en la fila de Valeria. | — | Detalle con DNI, fecha, aula y tutor, modalidad, apoderados (Principal y «Responsable del pago») y el cronograma con el estado de cada cuota. |
| CP-US18-16 | US18 | básico | CP-US18-04 | 1. «Ver» la matrícula de Diego. 2. «Anular matrícula». 3. Elegir «Se registró por error» y escribir el detalle. 4. Confirmar. | — | Aviso «Se anuló la matrícula de Diego Quispe Rojas.»; la fila pasa a «Anulado» y 1° A recupera una vacante. `motivo_anulacion` = «ERROR_DIGITACION: …». Auditoría `ANULAR_MATRICULA`. |
| CP-US18-17 | US18 | excepción | CP-US18-16 | 1. Anular otra vez por la API. | — | `409 MATRICULA_NO_ANULABLE` «Solo se anula una matrícula «En proceso» o «Matriculado». Esta está «Anulado».». En el detalle ya no aparece «Anular matrícula». |
| CP-US18-18 | US18 | excepción | Matrícula con un pago confirmado | 1. Abrir el modal de anulación. 2. Anular por la API. | — | El modal dice «No se puede anular esta matrícula» y el botón queda deshabilitado. API: `409 MATRICULA_CON_PAGOS`. |
| CP-US18-19 | US18 | excepción | PC | 1. Anular sin motivo o con detalle vacío. | — | «Elige el motivo de la anulación» · «Describe por qué se anula esta matrícula». |
| CP-US18-20 | US18 | básico | PC | 1. En AD-09, registrar un estudiante con su apoderado. 2. «Guardar y matricular». | Lucas Fernández Soto | Se abre «Matrícula» con Lucas ya elegido (paso 2); al cambiar de año se conserva el estudiante. |
| CP-US18-21 | US18 | excepción | Sesión de un perfil que no es Administrador | 1. Llamar a `POST /matricula/matriculas`. | — | `403 ACCESO_DENEGADO`. |

## US21 · Generación de cronograma de pagos

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US21-01 | US21 | básico | Montos 2027: 380.00 y 480.00 | 1. Confirmar la matrícula de Mateo en 2027 (CP-US18-07). 2. Ver su detalle. | Matrícula el 06/11/2026 | 11 cuotas «Pendiente»: «Matrícula 2027» S/ 380.00 que vence el 06/11/2026 y «Pensión de marzo 2027» a «Pensión de diciembre 2027», S/ 480.00, que vencen el día 5 de cada mes. Total S/ 5 180.00. |
| CP-US21-02 | US21 | básico | Montos 2026: 350.00 y 450.50 | 1. Matricular a Valeria en 2026 (CP-US18-01). | Hoy 06/11/2026 | Antes de confirmar: «Matrícula extemporánea… solo se generarán las pensiones de diciembre». Se generan la cuota de matrícula y solo «Pensión de diciembre 2026» (vence 05/12/2026). |
| CP-US21-03 | US21 | alterno | Matrícula el 16/09/2026 | 1. Confirmar una matrícula ese día. | — | Solo pensiones de octubre a diciembre (las que vencen después de la fecha de matrícula). |
| CP-US21-04 | US21 | alterno | Matrícula el 05/10/2026 | 1. Confirmar una matrícula ese día. | — | La pensión de octubre (vence el mismo 05/10) no se genera: noviembre y diciembre. |
| CP-US21-05 | US21 | básico | CP-US18-16 | 1. Revisar las cuotas de la matrícula anulada. | — | Todas las cuotas que estaban «Pendiente» pasan a «Anulado» (tachadas en el detalle); el total ya no las suma. |
| CP-US21-06 | US21 | alterno | Matrícula con una cuota pagada | 1. Intentar anularla. | — | No se anula (CP-US18-18): las cuotas quedan como estaban. |
| CP-US21-07 | US21 | básico | CP-US21-01 | 1. Revisar las fechas en la base. | `concepto_cobro.fecha_vencimiento` | Son `2027-03-05` … `2027-12-05`, sin el desfase de zona horaria; los montos son `Decimal(10,2)` (450.50, no 450.4999…). |
| CP-US21-08 | US21 | básico | Montos cambiados después de matricular | 1. Cambiar la pensión del año. 2. Ver una matrícula ya confirmada. | 460.00 | Su cronograma conserva los montos con que se generó; solo las nuevas matrículas usan 460.00. |
| CP-US21-09 | US21 | básico | CP-US18-01 | 1. Revisar la auditoría y los logs. | — | `GENERAR_CRONOGRAMA` con la cantidad de cuotas, el total, si fue extemporánea y los montos usados. Ninguna línea de `logs/` contiene un DNI. |

## Casos unitarios (Vitest)

Se ejecutan con `npm test`. No usan la base de datos y emplean fechas fijas. La prueba de integración se ejecuta aparte (ver CU-US18-09).

| ID | Archivo | Qué verifica | Resultado esperado |
|---|---|---|---|
| CU-US21-01 | `tests/matricula/cronograma.test.ts` | Matrícula oportuna (20/02/2026) | 11 cuotas: matrícula (vence el día de la matrícula) y pensiones 3 a 12 |
| CU-US21-02 | ídem | Pensiones | «Pensión de marzo 2026», S/ 450.00, vence 2026-03-05; diciembre vence 2026-12-05 |
| CU-US21-03 | ídem | Total sin float | 350 + 10 × 450 = 485000 céntimos; no es extemporánea |
| CU-US21-04 | ídem | Matrícula el 02/03 | Todavía incluye marzo (11 cuotas) |
| CU-US21-05 | ídem | Matrícula en noviembre para el año siguiente | 10 pensiones de 2027 |
| CU-US21-06 | ídem | Extemporánea el 16/09/2026 | Matrícula + octubre, noviembre y diciembre; «octubre a diciembre» |
| CU-US21-07 | ídem | Vencimiento el mismo día de la matrícula | 05/10 → solo noviembre y diciembre |
| CU-US21-08 | ídem | Después del 05/12 | Solo la cuota de matrícula |
| CU-US21-09 | ídem | Día de vencimiento | 10 → día 10; 31, 0 o texto → día 5 |
| CU-US18-01 | `tests/matricula/matriculas.test.ts` | Sección y responsable | Faltan → `MATRICULA_INCOMPLETA` con el mensaje del Backlog |
| CU-US18-02 | ídem | Responsable | Ajeno → `RESPONSABLE_NO_VINCULADO` |
| CU-US18-03 | ídem | Vacantes | 29/30 → válido; 30/30 → `SECCION_SIN_VACANTES` «Sección sin vacantes disponibles» |
| CU-US18-04 | ídem | Estados al confirmar | Sin matrícula → CREAR; En proceso → CONFIRMAR; Matriculado → `YA_MATRICULADO` con sugerencia de traslado |
| CU-US18-05 | ídem | Año | En matrícula o En curso → válido; Planificado → `ANIO_NO_MATRICULABLE` |
| CU-US18-06 | ídem | Anulación | En proceso y Matriculado sin pagos → válido; con pagos → `MATRICULA_CON_PAGOS`; Anulado o Retirado → `MATRICULA_NO_ANULABLE` |
| CU-US18-07 | ídem | Motivo y esquemas | «ERROR_DIGITACION: …»; sin motivo, sin detalle o `PAGO_DUPLICADO` → error; modalidad por defecto MENSUAL |
| CU-US18-08 | ídem | Montos del año | «350» → 35000; «450.5» → «450.50»; 0, negativos, 3 decimales o texto → `MONTO_INVALIDO`; valor guardado inválido → sin monto |
| CU-US18-09 | `tests/matricula/concurrencia.integracion.test.ts` | Dos matrículas simultáneas por la última vacante (base temporal) | Una aceptada, otra `SECCION_SIN_VACANTES`; 1 matrícula y 11 cuotas. Se ejecuta con `KUBO_PRUEBA_INTEGRACION=1` y `DATABASE_URL` de una base temporal |
