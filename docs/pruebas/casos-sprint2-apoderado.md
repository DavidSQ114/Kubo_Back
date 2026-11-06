# Casos de prueba · Sprint 2, bloque 7: portal del apoderado. Inicio de sesión y selección de hijo (US42), deudas y pagos (US43) y comprobante de pago (US44)

Pantallas AC-05 «¿A quién deseas consultar?», AP-01 «Inicio» (`/apoderado`) y AP-02 «Pagos» (`/apoderado/pagos`). API: [matricula.md](../api/matricula.md#portal-del-apoderado-us42-us43-us44); ejemplos en [matricula.http](../api/matricula.http) (bloques 41 a 47). Pantallas: [frontend-apoderado.md](../frontend-apoderado.md).
Las reglas puras se prueban además con Vitest (sección «Casos unitarios»).

**Precondición común (PC):** seed cargado. Año 2026 «En curso» con montos S/ 350.00 y S/ 450.00. Hoy: 06/11/2026. Solo datos ficticios (RNF14):
- **Carmen Rojas Medina** (apoderada, contraseña ya cambiada) con dos hijos:
  - **Valeria Quispe Rojas**, 3° B, matriculada el 27/02/2026. Pagó la matrícula y marzo en una operación, de abril a agosto y octubre. Setiembre y noviembre están vencidas y diciembre pendiente. Noviembre tiene además un pago «Observado» (número repetido).
  - **Diego Quispe Rojas**, 1° A. Pagó la matrícula y luego el pago anual adelantado (US58) de marzo a diciembre.
- **Rosa Huamán Torres** (apoderada) con una hija: **Lucía Huamán Torres**, 2° A, matrícula extemporánea del 20/08/2026 (matrícula y pensiones de setiembre a diciembre), sin pagos.
- **Jorge Salas Ríos**: apoderado sin estudiantes vinculados.

Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y muestra el mensaje).

## US42 · Inicio de sesión y selección de hijo

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US42-01 | US42 | básico | PC | 1. Iniciar sesión como Carmen. | — | AC-05 «¿A quién deseas consultar?» «Hola, Carmen. Tienes 2 estudiantes vinculados a tu cuenta.» con Valeria (3° de secundaria · Sección B, «2 vencidas») y Diego (1° de secundaria · Sección A, «Al día»). No entra al panel hasta elegir. |
| CP-US42-02 | US42 | básico | PC | 1. Iniciar sesión como Rosa. | — | Entra directo a AP-01 de Lucía, sin pasar por AC-05. `GET /hijos` → `seleccionadoId` = Lucía. |
| CP-US42-03 | US42 | alterno | PC | 1. Iniciar sesión como Jorge. | — | «Aún no tienes estudiantes matriculados vinculados a tu cuenta» con qué hacer y «Cerrar sesión»; no hay pantalla vacía. API: `hijos: []`. |
| CP-US42-04 | US42 | básico | CP-US42-01 | 1. «Ver panel del estudiante» en Valeria. 2. Ir a «Pagos» y volver a «Inicio». 3. Recargar la página. | — | La barra superior muestra «Consultando a Valeria Quispe Rojas · 3° B» en todo momento, también tras recargar. La cookie `kubo_estudiante` es httpOnly y su ruta es `/api/v1/matricula/apoderado`. |
| CP-US42-05 | US42 | básico | CP-US42-04 | 1. «Cambiar de hijo». 2. Elegir a Diego. | — | Vuelve a AC-05 con «Volver al panel»; al elegir a Diego, el panel muestra sus datos («Estás al día con tus pagos»). |
| CP-US42-06 | US42 | excepción | Sesión de Carmen | 1. `GET /matricula/apoderado/hijos/{id de Lucía}/pagos` (cambiar el id en la URL). | Id real de Lucía | `403 ESTUDIANTE_NO_VINCULADO` «No tienes acceso a la información de este estudiante.»; no se envía ningún dato de Lucía. |
| CP-US42-07 | US42 | excepción | Sesión de Carmen | 1. `PUT /matricula/apoderado/hijo-elegido` con el id de Lucía. | — | `403 ESTUDIANTE_NO_VINCULADO`; no se escribe la cookie. |
| CP-US42-08 | US42 | excepción | Sesión de Administrador | 1. Abrir `/apoderado` o llamar a `GET /matricula/apoderado/hijos`. | — | La pantalla lleva a «Acceso denegado»; la API responde `403 ACCESO_DENEGADO`. |
| CP-US42-09 | US42 | alterno | Persona con perfiles Docente y Apoderado | 1. Iniciar sesión y elegir «Apoderado» en AC-08 (US53). | — | Entra al portal del apoderado; «Ingresar como Docente» en la barra lateral cambia de perfil sin cerrar sesión. |

## US43 · Visualización de deudas y pagos

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US43-01 | US43 | básico | CP-US42-04 | 1. Abrir «Pagos». | — | Matrícula 2026 y 10 pensiones con concepto, vencimiento, monto y estado. Resumen: «Pagado» S/ 3 500.00 (Matrícula + 7 de 10 pensiones), «Vencido» S/ 900.00 (Setiembre y noviembre · venció el 05/09/2026), «Pendiente» S/ 450.00 (Diciembre · 1 cuota). |
| CP-US43-02 | US43 | básico | CP-US43-01 | 1. Revisar setiembre y noviembre. | — | Estado «Vencido» (vencieron antes de hoy, fecha de Lima) y filas resaltadas en rojo. El 05/12 sigue «Pendiente». |
| CP-US43-03 | US43 | alterno | CP-US43-01 | 1. Revisar noviembre. | Pago Observado | Sigue «Vencido» con «Pago en revisión»; no suma en «Pagado» y no tiene comprobante. |
| CP-US43-04 | US43 | básico | CP-US42-05 | 1. Abrir «Pagos» de Diego. | — | Las 11 cuotas «Pagado» y «Estás al día con tus pagos» en lugar de un listado sin contexto; los comprobantes siguen disponibles. |
| CP-US43-05 | US43 | alterno | Sesión de Rosa | 1. Abrir «Pagos» de Lucía. | Matrícula extemporánea | Solo matrícula y pensiones de setiembre a diciembre (US21). «Vencido» S/ 1 700.00 (4 cuotas), «Pendiente» S/ 450.00. |
| CP-US43-06 | US43 | alterno | Matrícula con cuotas anuladas (por ejemplo, retirada) | 1. Abrir «Pagos». 2. «Ver cuotas anuladas». | — | Las anuladas no aparecen en la tabla ni en el resumen; se ven aparte, atenuadas y tachadas. |
| CP-US43-07 | US43 | básico | CP-US43-01 | 1. Filtrar por «Vencido». | — | Solo setiembre y noviembre; con un estado sin cuotas, «No hay cuotas con ese estado.». |
| CP-US43-08 | US43 | básico | Sesión de Carmen con Valeria | 1. AP-01 «Inicio». | — | Aviso «Tienes 2 pensiones vencidas · Setiembre y noviembre · S/ 900.00 en total…» con «Ver mis pagos»; «Próximo vencimiento» 05/12/2026 «Pensión de diciembre 2026 · S/ 450.00». |

## US44 · Descarga de comprobante de pago

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US44-01 | US44 | básico | CP-US43-01 | 1. «PDF» en la pensión de marzo. | — | Se descarga `Recibo_Marzo2026_ValeriaQuispe.pdf`: el recibo de la operación que pagó matrícula y marzo, con las cuotas que cubre, el monto, la fecha y el N.° de operación. |
| CP-US44-02 | US44 | básico | CP-US44-01 | 1. «PDF» en la matrícula. | — | `Recibo_Matricula2026_ValeriaQuispe.pdf`, el mismo recibo que marzo (misma operación). |
| CP-US44-03 | US44 | alterno | CP-US43-04 | 1. «PDF» en mayo de Diego. | Pago anual | `Recibo_Anual2026_DiegoQuispe.pdf`, con las 10 pensiones del pago anual. |
| CP-US44-04 | US44 | excepción | CP-US43-01 | 1. Revisar el botón en setiembre (Vencido) y diciembre (Pendiente). | — | El botón «PDF» está deshabilitado («Disponible cuando la cuota esté pagada»). |
| CP-US44-05 | US44 | excepción | CP-US43-01 | 1. Llamar igual a la API con la cuota de setiembre. | — | `422 RECIBO_NO_CONFIRMADO` «No se puede generar un recibo de un pago no confirmado»; no se genera el archivo. |
| CP-US44-06 | US44 | excepción | Sesión de Rosa | 1. Pedir el comprobante de una cuota de Valeria con el id de Valeria. | — | `403 ESTUDIANTE_NO_VINCULADO`. |
| CP-US44-07 | US44 | excepción | Sesión de Rosa | 1. Pedir el comprobante con el id de Lucía y una cuota de Valeria. | — | `404 CUOTA_NO_ENCONTRADA`; no se mezcla la cuota ajena. |
| CP-US44-08 | US44 | básico | CP-US44-01 | 1. Revisar la bitácora y `logs/`. | — | Una fila `DESCARGAR_COMPROBANTE_APODERADO` (`entidad_afectada = "comprobante"`) por descarga, solo con `estudianteId`, `cuotaId`, `operacionId` y el número del recibo; ningún DNI ni nombre en la auditoría ni en los logs. |

## Casos unitarios (Vitest)

Se ejecutan con `npm test`. No usan la base de datos y emplean fechas fijas. La prueba de integración se ejecuta aparte (CU-US42-04).

| ID | Archivo | Qué verifica | Resultado esperado |
|---|---|---|---|
| CU-US42-01 | `tests/matricula/portalApoderado.test.ts` | Matrícula visible | Matriculado en año en matrícula o en curso → sí; Retirado solo en el año en curso; En proceso, Anulado o año Cerrado → no |
| CU-US42-02 | ídem | Orden de las matrículas | La del año en curso primero; sin ninguna visible, lista vacía |
| CU-US42-03 | ídem | Autorización por vínculo (IDOR) | Hijo vinculado → válido; id ajeno o sin hijos → `403 ESTUDIANTE_NO_VINCULADO` |
| CU-US42-04 | `tests/matricula/portalApoderado.integracion.test.ts` | IDOR con base temporal | Dos familias: cada una ve solo a su hijo; con el id real del otro, 403 en pagos, elección y comprobante; cuota ajena → `CUOTA_NO_ENCONTRADA`; cuota propia pendiente → `RECIBO_NO_CONFIRMADO`. Con `KUBO_PRUEBA_INTEGRACION=1` y `DATABASE_URL` de una base temporal |
| CU-US43-01 | `tests/matricula/portalApoderado.test.ts` | Estado «Vencido» | Pendiente con vencimiento de ayer → Vencido; de hoy o futuro → Pendiente; Pagado y Anulado no cambian |
| CU-US43-02 | ídem | Resumen | Suma exacta en céntimos de pagado, pendiente y vencido; las anuladas no cuentan; sin pendientes ni vencidas → `alDia` |
| CU-US44-01 | ídem | Comprobante disponible | Pagado → válido; Pendiente o Vencido → `RECIBO_NO_CONFIRMADO` |
| CU-US44-02 | ídem | Nombre del archivo | `Recibo_Marzo2026_ValeriaQuispe.pdf`, `Recibo_Setiembre2026_…`, `Recibo_Matricula2026_…`, `Recibo_Anual2026_…`; «maría José» / «Muñoz Ñáñez» → `MariaMunoz` |
