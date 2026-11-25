# API · Matrícula: matrícula en sección, cronograma, anulación, traslado, retiro y ficha (US18, US21, M-19, US19, US57, US20) pagos (US22, US23, US04, US25), pago anual (US58), morosidad (US24), recordatorios de pago (US59), portal del apoderado (US42, US43, US44), pago en línea (US70, US71) y bloque M4 (cuota de ingreso, mora, cuotas extraordinarias, proceso de matrícula y matrícula en línea con documentos)

> **Bloque M1:** la configuración académica, la matrícula, los pagos, los horarios, las notas y la asistencia de alumnos son del rol `COORDINADOR` (Coordinador académico); usuarios, aulas, parámetros, asistencia docente y auditoría, del `ADMINISTRADOR`. La tabla exacta de cada endpoint está en [ACCESOS.md](../ACCESOS.md).

Base: `/api/v1` · Formato: JSON · Éxito `{ "data": … }` · Error `{ "error": { "code", "message", "details" } }`
El `message` de los errores ya está redactado para mostrarse al usuario (RNF09). Todas las rutas exigen sesión con el rol `COORDINADOR` (ver [identidad.md](identidad.md)), salvo las de `/matricula/apoderado/…`, que exigen el rol `APODERADO` ([portal del apoderado](#portal-del-apoderado-us42-us43-us44)), y el aviso de la pasarela, que es público y va firmado ([pago en línea](#pago-en-línea-us70-y-devolución-us71)). Ejemplos en [matricula.http](matricula.http).

Los montos del año se configuran en académico: `GET/PUT /academico/anios/{id}/montos` (ver [academico.md](academico.md#montos-del-año-us21)).

## Endpoints

| Método y ruta | Cuerpo / consulta | Respuesta `data` |
|---|---|---|
| `GET /matricula/estudiantes/{id}` | `?anioId=` | `SituacionEstudiante`: apoderados, matrícula vigente en el año y cronograma previsto |
| `POST /matricula/matriculas` | `{ estudianteId, anioAcademicoId, seccionId, vinculoResponsableId, modalidadPago }` | `201 DetalleMatricula` (ya `MATRICULADO`, con su cronograma) |
| `GET /matricula/matriculas` | `?anioId=&estado=&gradoId=&seccionId=&q=&pagina=1&tamano=20` | `{ items: MatriculaListada[], paginacion }` |
| `GET /matricula/matriculas/{id}` | — | `DetalleMatricula` |
| `POST /matricula/matriculas/{id}/anular` | `{ motivo, detalle }` | `DetalleMatricula` (ya `ANULADO`) |
| `POST /matricula/matriculas/{id}/trasladar` | `{ seccionDestinoId, fecha?, motivo? }` | `DetalleMatricula` (en la sección destino) |
| `POST /matricula/matriculas/{id}/retirar` | `{ fecha?, motivo, detalle? }` | `DetalleMatricula` (ya `RETIRADO`) |
| `GET /matricula/matriculas/{id}/ficha` | — | `application/pdf` (no es JSON) |
| `GET /matricula/estudiantes/{id}/estado-cuenta` | `?anioId=` | `EstadoCuenta` (AD-11) |
| `POST /matricula/pagos` | `{ conceptoIds, monto, medioPago, numeroOperacion, fechaPago }` | `201 { operacion, aviso, correo }` |
| `GET /matricula/pagos/{id}` | — | `OperacionPago` |
| `POST /matricula/pagos/{id}/confirmar` | — | `{ operacion, aviso: null, correo }` (Observado → Confirmado) |
| `POST /matricula/pagos/{id}/descartar` | `{ detalle? }` | `{ operacion }` (Observado → Anulado, «Pago duplicado») |
| `POST /matricula/pagos/{id}/anular` | `{ motivo, detalle? }` | `{ operacion }` (→ Anulado) |
| `GET /matricula/pagos/{id}/comprobante` | — | `application/pdf` (recibo) |
| `POST /matricula/matriculas/{id}/pago-anual` | `{ monto, medioPago, numeroOperacion, fechaPago }` | `201 { operacion, aviso, correo }` (US58) |
| `GET /matricula/morosidad` | `?anioId=&gradoId=&seccionId=&mesesMinimos=&orden=MONTO` | `PanelMorosidad` (US24) |
| `POST /matricula/morosidad/recordatorios` | `{ matriculaIds }` (1 a 200) | `RecordatoriosEnviados` (US59) |
| `GET /matricula/apoderado/hijos` | — | `{ hijos: HijoPortal[], seleccionadoId }` (US42, **Apoderado**) |
| `PUT /matricula/apoderado/hijo-elegido` | `{ estudianteId }` | `{ estudianteId }` y la cookie `kubo_estudiante` (US42, **Apoderado**) |
| `GET /matricula/apoderado/hijos/{id}/pagos` | `?anioId=` | `PagosDelHijo` (US43, **Apoderado**) |
| `GET /matricula/apoderado/hijos/{id}/cuotas/{cuotaId}/comprobante` | — | `application/pdf` (US44, **Apoderado**) |
| `POST /matricula/apoderado/pagos/intentos` | `{ estudianteId, conceptoIds }` | `201 { intentoId, monto, urlCheckout }` (US70, **Apoderado**) |
| `GET /matricula/apoderado/pagos/intentos/{id}` | — | `IntentoPago` (US70, **Apoderado** que lo creó) |
| `POST /matricula/apoderado/pagos/intentos/{id}/simular` | `{ resultado }` | `IntentoPago` (solo `PASARELA=falsa`) |
| `POST /matricula/pagos/webhooks/pasarela` | `?data.id=&type=order`, cabeceras `x-signature` y `x-request-id` | `{ recibido: true }` (US70, **público**, firmado) |
| `POST /matricula/pagos/{id}/devolver` | `{ detalle? }` | `{ operacion }` (US71: Observado de la pasarela → Anulado, «Devuelto») |

### Situación del estudiante (AD-10)

`SituacionEstudiante`: `{ estudiante: { estudianteId, dni, nombreCompleto, gradoIngresoId, activo, apoderados: [{ vinculoId, apoderadoId, nombreCompleto, parentesco, esPrincipal, autorizado, telefono, email }] }, anio: { id, anio, estado }, matricula: { matriculaId, estado, seccionId, vinculoResponsableId, modalidadPago, fechaMatricula } | null, montos: { montoMatricula, montoPension }, cronogramaPrevisto: { cuotas, total, extemporanea, pensiones } | null }`.

- `matricula` es la vigente del año (`EN_PROCESO` o `MATRICULADO`). `cronogramaPrevisto` es el que se generaría hoy; es `null` si el año no tiene montos.
- Los datos del estudiante y de sus apoderados los entrega comunidad (`estudianteParaMatricula`) por su `index.ts`: matricula no lee tablas de comunidad.

### Matricular en sección (US18) y generar el cronograma (US21)

- Parte de una matrícula `EN_PROCESO` (borrador de US17) o de un estudiante sin matrícula vigente en el año; en ambos casos termina en `MATRICULADO`.
- `modalidadPago`: `MENSUAL` (por defecto) o `ANUAL`. Por ahora ambas generan las mismas cuotas.
- Validaciones, en este orden:
  1. Sin `seccionId` o sin `vinculoResponsableId`: `422 MATRICULA_INCOMPLETA` «Complete la sección y el apoderado responsable para confirmar la matrícula».
  2. Año que no está «En matrícula» ni «En curso»: `422 ANIO_NO_MATRICULABLE`. Año sin montos: `422 SIN_MONTOS` «El año 2026 no tiene montos de matrícula y pensión. Configúralos en «Montos del año» antes de matricular.».
  3. Sección inexistente (`404 SECCION_NO_ENCONTRADA`), de otro año (`422 SECCION_OTRO_ANIO`) o inactiva (`409 SECCION_INACTIVA`).
  4. Responsable que no es uno de los vínculos del estudiante: `422 RESPONSABLE_NO_VINCULADO` (también lo impide el trigger `tg_matricula_vinculo_estudiante`).
  5. Ya `MATRICULADO` en el año: `409 YA_MATRICULADO` «Este estudiante ya está matriculado en el periodo actual», con `details: { matriculaId, seccionId, sugerencia }` para ofrecer el traslado de sección (US19, bloque 4).
  6. Sección llena: `409 SECCION_SIN_VACANTES` «Sección sin vacantes disponibles», con `details: { matriculados, aforo }`.
- **Vacantes y concurrencia:** la vacante se valida recién al confirmar; una matrícula `EN_PROCESO` no la reserva. Dentro de la transacción se bloquea la fila de la sección (`SELECT … FOR UPDATE`) y después se cuentan las matrículas `MATRICULADO`: de dos solicitudes simultáneas por la última vacante, la segunda espera y recibe `SECCION_SIN_VACANTES`. Lo prueba `tests/matricula/concurrencia.integracion.test.ts` contra una base temporal.
- En la **misma transacción**: pasa a `MATRICULADO` con `fecha_matricula` = hoy en Lima, abre el `historial_seccion`, genera el cronograma y registra `CONFIRMAR_MATRICULA` y `GENERAR_CRONOGRAMA`.
- **Cronograma (US21):** cuota `MATRICULA` (vence el día de la confirmación) y pensiones `PENSION` de marzo (mes 3) a diciembre (mes 12) que vencen el día 5 (parámetro general `DIA_VENCIMIENTO`, entre 1 y 28; si no, 5), todas `PENDIENTE` y con los montos del año.
  - **Matrícula extemporánea:** solo se generan las pensiones cuyo vencimiento es **posterior** a la fecha de matrícula (matricular el 16/09 genera octubre a diciembre; matricular el 05/10 ya no incluye octubre).
  - Fechas `@db.Date` escritas como `AAAA-MM-DD` a medianoche UTC (sin el desfase de zona horaria). Montos `Decimal(10, 2)` calculados en céntimos enteros, nunca en float.

### Listado y detalle

- `MatriculaListada`: `{ matriculaId, estudianteId, estudiante: { nombreCompleto, dni }, grado, seccion: { id, nombre: "1° A" } | null, fechaMatricula, estado, modalidadPago }`, de la más reciente a la más antigua.
- `estado`: `EN_PROCESO` · `MATRICULADO` · `RETIRADO` · `ANULADO` · `FINALIZADO`. `gradoId` filtra por el grado de la sección o, sin sección, por el grado de ingreso del estudiante. `q` busca al estudiante por nombre, apellido o inicio del DNI.
- Se filtra en memoria sobre las matrículas del año (un colegio tiene a lo sumo unos cientos por año); así matricula no consulta tablas de comunidad ni de académico.
- `DetalleMatricula`: `{ matriculaId, estado, fechaMatricula, modalidadPago, anio, estudiante, seccion: { id, nombre, aula, tutor } | null, apoderados: [… , esResponsablePago], cronograma: { cuotas: [{ id, tipo, mes, concepto, monto, fechaVencimiento, estado }], total }, anulacion: { anuladoEn, motivo } | null, retiro: { fechaRetiro, motivo, nombreMotivo, detalle } | null, historialSecciones: [{ seccionId, seccion, fechaInicio, fechaFin, motivo }], pagos, puedeAnular, puedeTrasladar, puedeRetirar, puedeGenerarFicha }`. `total` suma las cuotas no anuladas. `anio` trae además `fechaInicio` y `fechaFin`, y `seccion` trae `gradoId` y `grado`.

### Anular (M-19)

- `motivo`: `ERROR_DIGITACION` · `SOLICITUD_APODERADO` · `OTRO` (los valores de `MotivoAnulacion` que aplican a una matrícula; `PAGO_DUPLICADO` es de los pagos). `detalle`: 5 a 200 caracteres. Se guarda en `motivo_anulacion` como «CODIGO: detalle».
- Solo `EN_PROCESO` o `MATRICULADO`: si no, `409 MATRICULA_NO_ANULABLE`. Con pagos no anulados aplicados a sus cuotas: `409 MATRICULA_CON_PAGOS` «No se puede anular esta matrícula: primero anula los pagos confirmados de esta matrícula.».
- En una transacción: las cuotas `PENDIENTE` pasan a `ANULADO` (US21), la matrícula pasa a `ANULADO` con `anulado_en`, `anulado_por_id` y el motivo, se cierra su historial de sección (libera la vacante) y se registra `ANULAR_MATRICULA` con el motivo.

### Traslado de sección (US19, M-05)

- `seccionDestinoId` obligatorio. `fecha` (`AAAA-MM-DD`): fecha efectiva; por defecto, hoy en Lima. `motivo`: opcional, hasta 200 caracteres.
- Validaciones, en este orden:
  1. Solo una matrícula `MATRICULADO`: si no, `409 MATRICULA_NO_TRASLADABLE` (una `RETIRADO` ya no se traslada).
  2. Sección destino inexistente: `404 SECCION_NO_ENCONTRADA`. Misma sección: `422 MISMA_SECCION`.
  3. Otro grado u otro año: `422 TRASLADO_OTRO_GRADO` «Solo se permite el traslado entre secciones del mismo grado». Sección inactiva: `409 SECCION_INACTIVA`.
  4. `fecha` anterior al ingreso a la sección actual o posterior al fin del año: `422 FECHA_TRASLADO_INVALIDA`.
  5. Destino lleno: `409 DESTINO_SIN_VACANTES` «La sección destino no tiene vacantes disponibles», con `details: { matriculados, aforo }`.
- **Concurrencia:** se bloquea la fila de la sección destino (`SELECT … FOR UPDATE`, el mismo bloqueo que la confirmación de US18) antes que la matrícula, y recién entonces se cuentan sus `MATRICULADO`. De dos traslados simultáneos a la última vacante, el segundo espera y recibe `DESTINO_SIN_VACANTES`. Lo prueba `tests/matricula/traslado.integracion.test.ts`.
- En una transacción: cierra el `historial_seccion` vigente con `fecha_fin` = fecha del traslado, abre uno nuevo en la sección destino con `fecha_inicio` = esa fecha y el motivo (si no hay, «Traslado de sección»), actualiza `matricula.seccion_id` y registra `TRASLADAR_SECCION`.

### Sección en una fecha (para asistencia y notas)

Todavía no existen los módulos de asistencia y notas. Cuando lleguen, deben asignar cada registro a la sección **por historial**, no por `matricula.seccion_id`, que solo dice la sección actual. Para eso `matricula` exporta por su `index.ts`:

- `seccionDeMatriculaEnFecha(matriculaId, fecha)`: la sección en la que estaba la matrícula ese día, o `null`.
- `matriculasDeSeccionEnFecha(seccionId, fecha)`: las matrículas (no anuladas) que estaban en la sección ese día, es decir, la lista de una asistencia o un registro de notas.

Regla de cada tramo: `fecha_inicio <= fecha < fecha_fin` (`fecha_fin` nulo = sigue en la sección). `fecha_fin` es el primer día en que ya no está en esa sección, así:
- El día de un traslado ya cuenta en la sección destino. Los registros anteriores quedan en la de origen (US19: «conservando el historial de la anterior»).
- Desde la fecha de retiro o de anulación no está en ninguna sección.
- Un tramo que se abre y se cierra el mismo día (traslado el día de la matrícula) no cuenta.

### Retiro del estudiante (US57, M-18)

- `motivo`: `TRASLADO` (a otro colegio) · `MOTIVOS_ECONOMICOS` · `MOTIVOS_SALUD` · `OTRO` (enum `MotivoRetiro`). Sin motivo: `422 MOTIVO_RETIRO_REQUERIDO` «Seleccione el motivo del retiro». `detalle`: opcional, hasta 300 caracteres. `fecha` (`AAAA-MM-DD`): por defecto, hoy en Lima.
- Solo una matrícula `MATRICULADO`: si no, `409 MATRICULA_NO_RETIRABLE` (una `RETIRADO` no admite otro retiro ni traslado).
- `fecha` anterior a la fecha de matrícula (o a su último traslado) o posterior al fin del año académico: `422 FECHA_RETIRO_INVALIDA`.
- En una transacción:
  - la matrícula pasa a `RETIRADO` con `motivo_retiro`, `detalle_retiro` y `retirado_en`. Como `retirado_en` es `timestamptz`, se guarda la medianoche de Lima de la fecha de retiro (`AAAA-MM-DDT05:00:00Z`) y se lee como esa misma fecha;
  - se libera la vacante, porque el aforo solo cuenta las `MATRICULADO`. La matrícula conserva su `seccion_id`;
  - se cierra el `historial_seccion` con `fecha_fin` = fecha de retiro;
  - las cuotas `PENDIENTE` sin pagos y con vencimiento **posterior** a la fecha de retiro pasan a `ANULADO`. Se conservan las pagadas, las vencidas (vencimiento igual o anterior al retiro) y las que tienen algún pago aplicado;
  - se registra `RETIRAR_ESTUDIANTE`.

### Ficha de matrícula en PDF (US20)

- `GET /matricula/matriculas/{id}/ficha` responde `200 application/pdf` con `Content-Disposition: attachment; filename="ficha-matricula-<año>-<8 primeros caracteres del id>.pdf"`. El nombre no lleva el DNI ni el nombre del estudiante, porque los proxies registran esa cabecera. Los errores llegan en el JSON de siempre.
- Contenido:
  - datos del estudiante: apellidos, nombres, DNI, fecha de nacimiento, sexo, dirección y colegio de procedencia;
  - datos de la matrícula: año, grado, sección, aula, tutor, fecha de matrícula, modalidad y estado (si está `RETIRADO`, también la fecha y el motivo del retiro);
  - tabla de apoderados con DNI, parentesco, teléfono y «Principal» o «Responsable del pago»;
  - fecha y hora de generación (hora de Lima) en el pie.
- Se arma siempre con los **datos actuales** y no guarda el archivo ni crea registros de matrícula. Generarla varias veces no duplica nada.
- Solo para `MATRICULADO` y, como constancia, `RETIRADO`. Una `EN_PROCESO` responde `422 FICHA_DATOS_PENDIENTES` «No se puede generar la ficha: existen datos obligatorios pendientes», con `details.pendientes` (por ejemplo `["Sección", "Apoderado responsable del pago"]`). `ANULADO` y `FINALIZADO` responden `409 FICHA_NO_DISPONIBLE`.
- Datos obligatorios: DNI, nombres, apellidos y fecha de nacimiento del estudiante, grado, sección, fecha de matrícula, modalidad, al menos un apoderado y el responsable del pago. Si falta alguno: `422 FICHA_DATOS_PENDIENTES` con la lista.
- **Servicio de PDF (`src/platform/pdf`):** `generarPdf(documento)` arma un documento A4 con encabezado, bloques de datos, tablas (con salto de página) y pie, usando `pdf-lib` (JavaScript puro, sin Chromium) y la fuente estándar Helvetica.
  - Tildes, ñ, ° y «» se ven bien (Windows-1252). Los caracteres que la fuente no puede dibujar se reemplazan por «?».
  - Si falla, lanza un error que solo nombra el documento y el tipo de falla. `ruta()` lo registra en `log_error` sin datos personales y responde `500 ERROR_INTERNO`.
  - La respuesta se arma con `pdf(bytes, nombreArchivo)` de `platform/http/ruta`.
  - La boleta de pago (US25) usará el mismo servicio.

## Pensiones y pagos (AD-11)

Las cuotas (`concepto_cobro`), las operaciones (`operacion_pago`), sus pagos por cuota (`pago`) y los comprobantes son tablas de `matricula`: no hizo falta un módulo de tesorería ni una migración.

### Estado de cuenta

`GET /matricula/estudiantes/{id}/estado-cuenta?anioId=` (sin `anioId`, la matrícula más reciente no anulada) devuelve:

- `estudiante` y `matriculas` (para elegir el año);
- `matricula`: año, estado, sección, modalidad y responsable del pago con su correo;
- `cuotas`: el cronograma, y en cada cuota `vencida` (Pendiente con vencimiento anterior a hoy), `observada` (la cubre una operación Observado) y `pago` (la operación confirmada que la canceló: fecha, N.° de operación, comprobante y cuántas cuotas cubrió);
- `totales`: pagado, pendiente (no vencido) y vencido, con la cantidad de cuotas, calculados en céntimos;
- `operaciones`: cada `OperacionPago` con sus cuotas, comprobante, quién la registró o confirmó, y la `anulacion` (motivo, observación, responsable y fecha). Las Observado traen `mismoNumero` con las operaciones que comparten el número;
- `log`: los eventos `REGISTRAR_PAGO`, `CONFIRMAR_PAGO_OBSERVADO` y `ANULAR_PAGO` de esas operaciones, con un detalle legible y el usuario.

### Registrar un pago manual (US22, M-01)

- `conceptoIds`: de 1 a 40 cuotas `PENDIENTE` del **mismo estudiante** (hasta el bloque M4, 11). `monto`: texto con hasta dos decimales (`"900"` o `"900.00"`). `medioPago`: `EFECTIVO` · `TRANSFERENCIA` · `DEPOSITO` · `TARJETA`. `numeroOperacion`: se guarda sin espacios sobrantes y en mayúsculas. `fechaPago`: `AAAA-MM-DD`, no futura.
- Validaciones:
  - Sin número de operación: `422 NUMERO_OPERACION_REQUERIDO` «El número de operación es obligatorio».
  - Fecha futura: `422 FECHA_PAGO_FUTURA`.
  - Cuota ya pagada: `409 CUOTA_YA_PAGADA` «Esta pensión ya fue cancelada el 03/07/2026» (la fecha de pago de la operación que la canceló).
  - Cuota anulada `409 CUOTA_ANULADA`, inexistente `404 CUOTA_NO_ENCONTRADA`, repetida `422 CUOTA_REPETIDA`, de otro estudiante `422 CUOTAS_DE_VARIOS_ESTUDIANTES`.
  - **Orden de pago (D-14):** primero la matrícula y luego las pensiones por fecha de vencimiento. Solo cuentan las cuotas `PENDIENTE` de la misma matrícula (las anuladas y pagadas no):
    - Con la cuota de matrícula pendiente no se paga ninguna pensión salvo que la matrícula vaya en la misma operación: `409 MATRICULA_PENDIENTE` «Primero debe pagarse la matrícula 2026. Inclúyela en este pago o regístrala antes.» (el año es el de la matrícula; `details.anio`).
    - Si se elige una pensión, todas las pensiones pendientes con vencimiento anterior deben ir en la misma operación: `409 CUOTAS_ANTERIORES_PENDIENTES` «Primero deben pagarse las cuotas anteriores: Pensión de setiembre 2026, Pensión de octubre 2026.» (`details.conceptos`).
    - **Bloque M4:** la matrícula y la cuota de ingreso pendientes van juntas (`409 INGRESO_CON_MATRICULA`); con la cuota de ingreso pendiente, `MATRICULA_PENDIENTE` dice «Primero deben pagarse la matrícula 2026 y la cuota de ingreso…». Cada mora va en la misma operación que su pensión pendiente, y la pensión con su mora (`409 MORA_CON_PENSION`); si la pensión ya no está pendiente, la mora se paga sola. Las cuotas extraordinarias no entran en el orden.
    - Se valida en el servidor aunque la pantalla ya lo impida. Los pagos ya registrados no se revisan, y confirmar un pago Observado (US23) no vuelve a aplicar el orden.
  - Monto distinto a la suma: `422 MONTO_NO_COINCIDE` «El monto ingresado no coincide con el total de las cuotas seleccionadas», con `details.total`. No hay pagos parciales. La suma se hace en céntimos enteros, nunca en float.
- **Concurrencia:** en la transacción se toma un candado por número de operación (`pg_advisory_xact_lock`) y se bloquean las filas de las cuotas (`SELECT … FOR UPDATE`, en orden de id). De dos pagos simultáneos de la misma cuota, el segundo espera y recibe `CUOTA_YA_PAGADA`. De dos con el mismo número, el segundo queda Observado. Lo prueba `tests/matricula/pagos.integracion.test.ts`.
- **Resultado:**
  - Número no usado en otra operación no anulada: operación `CONFIRMADO` (`confirmado_por` = el administrador), una fila `pago` por cuota y las cuotas pasan a `PAGADO`. La fecha y hora del registro quedan en `operacion_pago.created_at` y la fecha de pago, en `fecha_pago` (medianoche de Lima). Se emite el comprobante.
  - Número ya usado en otra operación no anulada (US23): operación `OBSERVADO` con `aviso` «Este número de operación ya fue utilizado en otro pago». Las cuotas siguen `PENDIENTE` y no hay comprobante.
- `correo`: `{ enviado, motivo }`, la copia del recibo al apoderado responsable (ver US25).

### Pagos observados (US23)

- `POST …/confirmar`: solo una `OBSERVADO` (si no, `409 PAGO_NO_OBSERVADO`). Bloquea las cuotas y exige que sigan `PENDIENTE`: si otra operación ya las pagó, `409 CUOTA_YA_PAGADA`. Pasa a `CONFIRMADO` con `confirmado_por`, las cuotas a `PAGADO`, emite el comprobante y registra `CONFIRMAR_PAGO_OBSERVADO`.
- `POST …/descartar`: solo una `OBSERVADO`. Pasa a `ANULADO` con el motivo `PAGO_DUPLICADO`, `anulado_por` y `anulado_en`. Sus cuotas no cambian. Registra `ANULAR_PAGO` con `decision: "DESCARTAR_OBSERVADO"`.
- Una operación anulada ya no cuenta como duplicado: registrar de nuevo las mismas cuotas, incluso con el mismo número, queda `CONFIRMADO` si no hay otra operación vigente con ese número.

### Anular un pago (US04, M-02)

- `motivo` (`MotivoAnulacion`): `ERROR_DIGITACION` (Error de digitación) · `PAGO_DUPLICADO` (Pago duplicado) · `SOLICITUD_APODERADO` (Solicitud del apoderado) · `OTRO`.
  - Sin motivo: `422 MOTIVO_ANULACION_REQUERIDO`.
  - Con `OTRO`, el `detalle` es obligatorio: `422 DETALLE_ANULACION_REQUERIDO`. En los demás, el detalle es opcional (hasta 300 caracteres).
- Se anula una `CONFIRMADO` o una `OBSERVADO`. Una `ANULADO` responde `409 PAGO_YA_ANULADO`.
- En una transacción: si estaba `CONFIRMADO`, sus cuotas vuelven de `PAGADO` a `PENDIENTE` y admiten un pago nuevo. La operación queda `ANULADO` con `motivo_anulacion`, `observacion_anulacion`, `anulado_por` y `anulado_en`, y se registra `ANULAR_PAGO`.
- **Nada se borra:** las filas `pago` y el comprobante se conservan, y el historial (`operaciones[].anulacion`) muestra el estado, el motivo, el responsable y la fecha.
- Una matrícula con pagos no anulados sigue sin poder anularse (`409 MATRICULA_CON_PAGOS`); primero se anulan sus pagos.

### Recibo en PDF (US25, M-03)

- Al confirmar una operación (al registrarla o al confirmar una Observado) se crea su `comprobante` **en la misma transacción**, con número correlativo `R-<año>-<6 dígitos>` (por ejemplo `R-2026-000001`).
  - El año es el de la confirmación (hora de Lima).
  - El siguiente número se calcula con un candado por año (`pg_advisory_xact_lock`) y se inserta antes de liberarlo: dos confirmaciones simultáneas reciben números seguidos. Si una transacción se revierte, su número no se pierde, así que no quedan huecos.
- `GET /matricula/pagos/{id}/comprobante`: `200 application/pdf` con `Content-Disposition: attachment; filename="recibo-R-2026-000001.pdf"`.
  - Lleva: estudiante, sección en la fecha de pago (por historial, así un traslado posterior no cambia el recibo), apoderado responsable, cuotas cubiertas con vencimiento y monto, total, fecha de pago, medio, N.° de operación y quién lo registró.
  - Una operación `OBSERVADO`, o anulada sin comprobante: `422 RECIBO_NO_CONFIRMADO` «No se puede generar un recibo de un pago no confirmado».
  - Una `ANULADO` con comprobante se sigue descargando, con la marca de agua «ANULADO».
- **Sin almacenamiento de archivos todavía (no hay S3):** el PDF se genera bajo demanda con `src/platform/pdf` a partir de los datos guardados.
  - Es determinista: no lleva «generado el», y la fecha de los metadatos es la de pago, así que el mismo pago produce siempre los mismos bytes.
  - `comprobante.archivo_url` guarda la ruta interna de descarga (`/api/v1/matricula/pagos/{id}/comprobante`) y `checksum_sha256` el hash del PDF emitido, que coincide con el que se descarga mientras los datos no cambien. `tamano_bytes`, `mime_type` y `monto_total` también se guardan.
- **Copia por correo:** después de confirmar la transacción se envía el PDF adjunto al correo del apoderado responsable, y si el envío falla el pago no se revierte.
  - Si se envía, `comprobante.enviado_en` = fecha y hora y `correo: { enviado: true }`.
  - Sin SMTP configurado (`SMTP_HOST`, como hoy en AWS) no se envía: `enviado_en` queda vacío, `correo.motivo = "SMTP_NO_CONFIGURADO"` y el log registra el aviso «SMTP no configurado: no se envió la copia del recibo» solo con el número de recibo y el requestId.
  - Si el responsable no tiene correo: `motivo = "SIN_CORREO"`.

### Pago anual adelantado (US58, M-15)

- `POST /matricula/matriculas/{id}/pago-anual` paga en **una sola operación** todas las cuotas `PENDIENTE` de la matrícula (vencidas o no), sin descuento y sin las ya pagadas ni las anuladas. Los datos son los del pago manual, sin `conceptoIds`.
- Validaciones:
  - Matrícula que no está `MATRICULADO`: `409 PAGO_ANUAL_NO_PERMITIDO`.
  - Sin cuotas pendientes: `422 SIN_CUOTAS_PENDIENTES`.
  - Monto distinto al total pendiente: `422 MONTO_NO_COINCIDE_PENDIENTE` «El monto no coincide con el total pendiente», con `details.total`.
  - Sin número de operación o con fecha futura: los mismos errores del pago manual.
  - Orden de pago (D-14): como incluye todas las cuotas pendientes, la cuota de matrícula pendiente siempre va en la operación. El servidor aplica igual la misma validación que el pago manual.
- Usa el mismo núcleo que el pago manual: en una transacción toma el candado del número de operación y la fila de la matrícula, y bloquea (`FOR UPDATE`, en orden de id) todas las cuotas `PENDIENTE` de la matrícula.
  - Si se confirma: las cuotas pasan a `PAGADO`, la matrícula a `modalidad_pago = ANUAL` (auditoría `CAMBIAR_MODALIDAD_PAGO` con la modalidad anterior y la operación) y se emite **un único comprobante** `R-AAAA-NNNNNN` por el total.
  - Con un número de operación ya usado (US23): queda `OBSERVADO`, sin tocar cuotas ni modalidad. `REGISTRAR_PAGO` guarda `tipoPago: "ANUAL"`; al confirmarla, `POST /matricula/pagos/{id}/confirmar` lee ese dato y también cambia la modalidad a `ANUAL`.
- `REGISTRAR_PAGO` registra `tipoPago` (`ANUAL` o `CUOTAS`) y `matriculaId` además de los campos de US04.

## Panel de morosidad (US24, AD-12)

`GET /matricula/morosidad?anioId=` (obligatorio), con `gradoId`, `seccionId`, `mesesMinimos` (1 a 12, «N o más» cuotas vencidas) y `orden` (`MONTO` por defecto, o `MESES`). Responde:

```jsonc
{ "fecha": "2026-11-06", "anio": { "id": "…", "anio": 2026 },
  "resumen": { "estudiantes": 2, "deudaTotal": "1150.00", "cuotasVencidas": 3 },
  "items": [{ "matriculaId": "…", "estudianteId": "…", "nombreCompleto": "Valeria Quispe Rojas",
              "seccion": { "id": "…", "nombre": "3° B" }, "adeudado": ["Matr.", "Oct"], "mesesAdeudados": 1,
              "cuotasVencidas": 2, "deuda": "800.00", "primerVencimiento": "2026-10-01", "diasAtraso": 36,
              "responsable": { "nombreCompleto": "Carmen Rojas Medina", "parentesco": "Madre", "telefono": "987654321" },
              "ultimoRecordatorio": "2026-11-18T14:10:00.000Z" }] }
```

- **Vencida:** cuota `PENDIENTE` con vencimiento **anterior** a hoy, según la fecha de Lima; el día del vencimiento todavía no es mora.
- No se listan matrículas `RETIRADO` ni `ANULADO`, ni cuotas `ANULADO` o `PAGADO`.
- `mesesAdeudados` cuenta las pensiones vencidas; `cuotasVencidas` incluye la cuota de matrícula si está vencida. `deuda` es la suma exacta (`SUM` de `Decimal(10, 2)`, como texto).
- **Una sola consulta agregada** (`GROUP BY` matrícula sobre `concepto_cobro` ⋈ `matricula`, con el índice `(estado, fecha_vencimiento)`). Después hay una consulta para las secciones, una para los estudiantes y una para los responsables con su teléfono: sin N+1.
- Sin caché: quien paga sale del listado en la siguiente consulta.
- El filtro por grado se resuelve con las secciones del grado (por el `index.ts` de académico). Matricula no lee tablas de otros módulos.
- `ultimoRecordatorio`: instante del último recordatorio de pago enviado (US59), de `matricula.ultimo_recordatorio_en`; `null` si nunca se envió.

## Recordatorios de pago a apoderados morosos (US59, AD-12, M-24)

`POST /matricula/morosidad/recordatorios` con `{ "matriculaIds": ["…", "…"] }` (los estudiantes elegidos en el panel, por su matrícula; de 1 a 200). Responde:

```jsonc
{ "enviados": 1, "omitidos": 2,
  "correos": { "registrados": 1, "enviados": 1 },
  "resultados": [
    { "matriculaId": "…", "estudiante": "Valeria Quispe Rojas", "enviado": true, "motivo": null,
      "ultimoRecordatorio": "2026-11-18T14:10:00.000Z" },
    { "matriculaId": "…", "estudiante": "Diego Quispe Rojas", "enviado": false, "motivo": "SIN_CUOTAS_VENCIDAS",
      "ultimoRecordatorio": null },
    { "matriculaId": "…", "estudiante": "Bruno Castillo Ramos", "enviado": false, "motivo": "SIN_DESTINATARIO",
      "ultimoRecordatorio": null }] }
```

- En **una transacción**, con las matrículas bloqueadas (`FOR UPDATE`, en orden de id), se vuelven a leer las cuotas vencidas con el mismo criterio del panel. Quien ya no tiene cuotas vencidas se omite (`SIN_CUOTAS_VENCIDAS`, criterio 3). Si el apoderado responsable no tiene cuenta ni correo, también se omite (`SIN_DESTINATARIO`).
- A cada uno de los demás: **notificación interna** al apoderado responsable del pago (`RECORDATORIO`, «Recordatorio de pago», «Valeria: 2 cuotas vencidas · S/ 800.00 · 42 días de atraso», enlace `/apoderado/pagos`) y **correo** «Kubo · Recordatorio de pago de Valeria Quispe Rojas» con cada cuota vencida, su vencimiento, su monto, sus días de atraso y el total. Se guarda `matricula.ultimo_recordatorio_en` y se registra `ENVIAR_RECORDATORIOS` en `registro_auditoria` por estudiante (valor anterior y nuevo de la fecha, cuotas, deuda, días de atraso y si hubo notificación y correo).
- Los correos salen después de confirmar, por la bandeja de salida ([notificaciones.md](notificaciones.md#bandeja-de-salida-de-correos-us55-criterio-3)): `correos.enviados` cuenta los que ya salieron; un fallo no revierte el envío, que se reintenta.
- `400 DATOS_INVALIDOS` si la lista está vacía, tiene ids no válidos o más de 200. `404 MATRICULA_NO_ENCONTRADA` si alguna matrícula no existe (no se envía ninguno). `401` sin sesión y `403 ACCESO_DENEGADO` con un perfil que no es Administrador.

## Portal del apoderado (US42, US43, US44)

Rutas de solo lectura para el rol `APODERADO` (pantallas AC-05, AP-01 y AP-02). Lo único que escriben es la auditoría de la descarga y la cookie del hijo elegido.

**Autorización por vínculo (IDOR).** En cada solicitud el servidor calcula los hijos de la persona en sesión: estudiantes activos con un `vinculo_apoderado` hacia su perfil de apoderado activo **y** con una matrícula visible. Si el `{id}` de la URL (o el `estudianteId` del cuerpo) no está en esa lista, responde `403 ESTUDIANTE_NO_VINCULADO` «No tienes acceso a la información de este estudiante.», aunque el estudiante exista.

**Matrícula visible:** `MATRICULADO` en un año «En matrícula», «En curso» o «En cierre», o `RETIRADO` en un año «En curso» o «En cierre». Si un hijo tiene dos, se muestra primero la del año en curso; `?anioId=` elige la otra. Las matrículas `EN_PROCESO` y `ANULADO` no se muestran.

### Hijos y selección (US42, AC-05)

`GET /matricula/apoderado/hijos`:

```jsonc
{ "hijos": [{ "estudianteId": "…", "nombres": "Valeria", "nombreCompleto": "Valeria Quispe Rojas", "iniciales": "VQ",
              "anio": 2026, "estadoMatricula": "MATRICULADO", "nombreEstadoMatricula": "Matriculado",
              "grado": "3° de secundaria", "seccion": "B", "seccionCorta": "3° B", "cuotasVencidas": 2 }],
  "seleccionadoId": null }
```

- `seleccionadoId`: con un solo hijo, ese hijo (la pantalla entra directo a su panel). Con dos o más, el elegido antes si sigue en la lista; si no, `null` y la pantalla muestra la selección. Sin hijos, `hijos: []` y la pantalla muestra un mensaje.
- `PUT /matricula/apoderado/hijo-elegido` `{ estudianteId }` verifica el vínculo (403 si no) y guarda la elección en la cookie **httpOnly** `kubo_estudiante`: un JWT firmado con `JWT_SECRET` (`sub` = usuario, `est` = estudiante, 7 días), con `Path=/api/v1/matricula/apoderado` y `SameSite=Lax`. La cookie no autoriza nada: solo se usa si es del mismo usuario y el hijo sigue vinculado. Se borra al cerrar sesión.

### Deudas y pagos (US43, AP-02)

`GET /matricula/apoderado/hijos/{id}/pagos?anioId=`:

```jsonc
{ "estudiante": { "estudianteId": "…", "nombres": "Valeria", "nombreCompleto": "Valeria Quispe Rojas", "codigoPago": "78451236" },
  "matricula": { "anioId": "…", "anio": 2026, "estado": "MATRICULADO", "nombreEstado": "Matriculado",
                 "fechaMatricula": "2026-02-27", "grado": "3° de secundaria", "seccion": "3° B" },
  "anios": [{ "anioId": "…", "anio": 2026 }], "hoy": "2026-11-06",
  "resumen": { "pagado": "3500.00", "cuotasPagadas": 8, "pendiente": "450.00", "cuotasPendientes": 1,
               "vencido": "900.00", "cuotasVencidas": 2, "alDia": false },
  "cuotas": [{ "cuotaId": "…", "tipo": "PENSION", "mes": 9, "concepto": "Pensión de setiembre 2026", "monto": "450.00",
               "fechaVencimiento": "2026-09-05", "estado": "VENCIDO", "nombreEstado": "Vencido", "fechaPago": null,
               "comprobanteDisponible": false, "enRevision": false }],
  "anuladas": [] }
```

- Cuota de matrícula y pensiones generadas (10, o solo las posteriores a la fecha de matrícula si fue extemporánea, US21), en orden de vencimiento.
- **Estado** calculado, no guardado: `PAGADO`; `VENCIDO` si está `PENDIENTE` y vence **antes** de hoy (fecha de Lima); si no, `PENDIENTE`. Las cuotas `ANULADO` van aparte en `anuladas` y no cuentan en el resumen.
- Un pago **Observado** no cambia la cuota: sigue «Pendiente» o «Vencido» y no suma en «Pagado»; `enRevision: true` solo avisa que tesorería lo revisa.
- `resumen.alDia`: sin cuotas pendientes ni vencidas → la pantalla muestra «Estás al día con tus pagos».
- `codigoPago` es el DNI del estudiante (código para pagar en el banco, AP-02); solo lo recibe su apoderado. No se envían datos de otros apoderados, ni las operaciones, ni quién registró los pagos.

### Comprobante de una cuota (US44)

`GET /matricula/apoderado/hijos/{id}/cuotas/{cuotaId}/comprobante` → `application/pdf`, el mismo recibo de US25 de la operación **confirmada** que pagó la cuota (si una operación cubrió varias cuotas, todas descargan el mismo PDF).

- Nombre: `Recibo_<Mes><Año>_<NombreApellido>.pdf`, sin tildes, ñ ni espacios: `Recibo_Marzo2026_ValeriaQuispe.pdf`, `Recibo_Matricula2026_ValeriaQuispe.pdf` y, si la operación fue un pago anual (US58), `Recibo_Anual2026_DiegoQuispe.pdf`.
- Cuota «Pendiente» o «Vencido» (o con una operación solo Observado): `422 RECIBO_NO_CONFIRMADO` «No se puede generar un recibo de un pago no confirmado».
- Cuota de otro estudiante con el `{id}` de un hijo propio: `404 CUOTA_NO_ENCONTRADA`. Estudiante ajeno: `403 ESTUDIANTE_NO_VINCULADO`.
- Auditoría `DESCARGAR_COMPROBANTE_APODERADO` (`entidad_afectada = "comprobante"`) con `estudianteId`, `cuotaId`, `operacionId` y el número del comprobante: solo ids, sin nombres ni DNI.

## Portal del alumno (US49)

Rutas de solo lectura para el rol `ALUMNO` (pantallas AL-01 y AL-05; ver [frontend-portales-horario.md](../frontend-portales-horario.md)). La cuenta del alumno la crea el Administrador desde AD-06 ([comunidad.md](comunidad.md#acceso-del-alumno-al-portal-us49-pantalla-ad-06)). Su horario está en [horarios.md](horarios.md).

**El alumno sale de la sesión.** Ninguna ruta recibe un id de estudiante ni de sección: el servidor resuelve persona → estudiante activo → **matrícula vigente**, así que un alumno no puede consultar la sección de otro.

**Matrícula vigente:** `MATRICULADO` en un año «En curso», «En cierre» o «En matrícula» (con dos, manda la del año en curso). Un alumno retirado, con la matrícula anulada o `EN_PROCESO`, o solo con años cerrados, no la tiene: todas las rutas del portal responden `403 SIN_MATRICULA_VIGENTE` «No tienes una matrícula vigente. Comunícate con la secretaría del colegio.» y la pantalla lo muestra en lugar del panel.

| Método y ruta | Rol | Respuesta `data` |
|---|---|---|
| `GET /matricula/alumno/panel` | Alumno | `{ estudiante: { estudianteId, nombres, nombreCompleto, iniciales }, anio, grado, seccion, seccionCorta }` («1° de secundaria», «A», «1° A») |
| `GET /matricula/alumno/cursos` | Alumno | `{ anio, seccionCorta, cursos: [{ cursoId, codigo, nombre, horasSemanales, docente }] }` |

- «Mis cursos» son los cursos activos del plan de estudios del grado de su sección, en orden alfabético. `docente` es `{ nombreCompleto, nombreCorto }` de quien tiene asignado el curso en esa sección (US14), o `null` si aún no tiene.
- Con otro perfil: `403 ACCESO_DENEGADO` «No tiene permisos para acceder a este recurso.»; sin sesión: `401 NO_AUTENTICADO`.

**Sección del hijo para su horario (US48).** `seccionDelHijo(sesion, estudianteId)` se exporta para el módulo `horarios`: aplica la autorización por vínculo del portal del apoderado y devuelve la sección de la matrícula vigente del hijo (`null` si está retirado).

## Pago en línea (US70) y devolución (US71)

Mercado Pago Checkout Pro con la API de Orders, solo en **modo de prueba**. Decisión, endpoints de Mercado Pago y estados: [AD-15](../arquitectura/AD-15-pasarela-pagos.md). Variables: `PASARELA` (`mercadopago` | `falsa`), `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET`, validadas con Zod. Si faltan, `pagoEnLinea` es `false`, el botón «Pagar» no aparece y las rutas de esta sección responden `409 PAGO_EN_LINEA_NO_DISPONIBLE`.

### Iniciar un pago en línea · solo `APODERADO` vinculado al estudiante

`POST /matricula/apoderado/pagos/intentos` con `{ "estudianteId": "uuid", "conceptoIds": ["uuid", …] }` (de 1 a 11 cuotas).
- El servidor recalcula el vínculo (403 `ESTUDIANTE_NO_VINCULADO`), exige cuotas **Pendiente** del mismo estudiante y de la misma matrícula, y **calcula el monto**. El cliente no envía montos.
- **Orden de pago (D-14):** las mismas reglas del pago manual, antes de crear el intento: `409 MATRICULA_PENDIENTE` y `409 CUOTAS_ANTERIORES_PENDIENTES`. Rechazado, no se crea intento ni order. Cuando llega el aviso de un pago aprobado, el orden **no** se vuelve a aplicar (el cobro ya se hizo): las cuotas se revisan solo como antes (pagada o anulada → Observado).
- Crea un `IntentoPago` Pendiente con el monto, las cuotas, un `external_reference` (`KUBO-…`) y una expiración de 30 minutos. Luego crea la order en la pasarela (`X-Idempotency-Key` = id del intento).
- **No reserva las cuotas:** se validan de nuevo al confirmar el pago.
- `201 { intentoId, monto, urlCheckout }`. El frontend redirige a `urlCheckout`.
- Si la pasarela no responde: `502 PASARELA_NO_RESPONDE` y el intento queda Rechazado.

### Estado del intento (pantalla de retorno) · solo el `APODERADO` que lo creó

`GET /matricula/apoderado/pagos/intentos/{id}` → `{ intentoId, estudianteId, estado, nombreEstado, monto, cuotas: [{ cuotaId, concepto, monto }], expiraEn, comprobante, pasarela }`.
- `estado`: `PENDIENTE` («En proceso»), `APROBADO`, `RECHAZADO`, `EXPIRADO` u `OBSERVADO` («En revisión»).
- Si está Pendiente, antes de responder consulta la order en la pasarela (servidor a servidor). **La URL de retorno nunca confirma un pago:** sus parámetros no se usan.
- Un intento de otra persona responde `404 INTENTO_NO_ENCONTRADO`.

`POST /matricula/apoderado/pagos/intentos/{id}/simular` con `{ "resultado": "APROBADO" | "RECHAZADO" | "EN_PROCESO" | "EXPIRADO" }` existe **solo con `PASARELA=falsa`** (desarrollo y pruebas). Simula el checkout y procesa la order como lo haría el aviso. Con otra pasarela responde `409 SIMULACION_NO_DISPONIBLE`.

### Aviso de la pasarela (webhook) · público, sin sesión

`POST /matricula/pagos/webhooks/pasarela?data.id=<order>&type=order`. Mercado Pago lo envía con el evento «Order (Mercado Pago)».
1. Valida `x-signature` (`ts=…,v1=…`) con `x-request-id`, el `data.id` **de la query** y `MP_WEBHOOK_SECRET`. Si no coincide: `401 FIRMA_INVALIDA`. En el manifiesto, el `data.id` alfanumérico va en minúsculas (`ORDTST01…` → `ordtst01…`), como pide la documentación de Orders; la order se consulta con el id original ([D-09](../arquitectura/AD-15-pasarela-pagos.md#d-09--los-avisos-reales-respondían-401-firma_invalida)). El `data.id` del cuerpo no se usa.
2. Responde `200 { recibido: true }` de inmediato. Un aviso de otro tipo también responde 200 y se ignora.
3. Después consulta `GET /v1/orders/{data.id}`. Solo se considera pagada si `status = processed`, `status_detail = accredited`, `total_paid_amount = total_amount` = monto del intento y `external_reference` = el del intento.
4. Registra la operación con el mismo caso de uso de US22: cuotas bloqueadas, monto exacto, recibo (US25), correo y `REGISTRAR_PAGO` con actor Sistema (`usuario_id` nulo) y `origen: "PASARELA"`. La operación queda con `medioPago: "PASARELA"`, `origen: "PASARELA"`, `numeroOperacion` y `referenciaExterna` = id de la order, y `registradoPor: "Sistema (pago en línea)"`.
5. **Idempotente:** `referencia_externa` es única y un candado por order serializa los avisos simultáneos. Un aviso repetido no registra otra vez.
6. Si una cuota ya está pagada (o anulada) cuando llega la aprobación, la operación queda **Observado** con `motivoObservacion: "Cuota pagada por otro medio"` (o «Cuota anulada») y no toca las cuotas.
7. Si la order está acreditada pero con otro monto o referencia, no se registra: el intento queda Observado y se deja un aviso en el log.

### Registrar devolución (US71, AD-11) · solo `COORDINADOR`

`POST /matricula/pagos/{id}/devolver` con `{ "detalle"?: "…" }` (300 caracteres como máximo) → `{ operacion }`.
- Solo para un pago en línea **Observado**: si no, `409 DEVOLUCION_NO_PERMITIDA`. La operación pasa a **Anulado** con el motivo `DEVUELTO` («Devuelto»), el administrador y la fecha. Sus cuotas no cambian.
- El dinero se devuelve en el panel de Mercado Pago; Kubo solo lo registra.
- Un pago en línea Observado no se descarta (`POST …/descartar` → `409 USAR_DEVOLUCION`), pero sí se puede **confirmar** (US23) si la cuota quedó libre.

### Cambios en las respuestas existentes

- `OperacionPago` (estado de cuenta y detalle) agrega `origen` (`TESORERIA` | `PASARELA`), `nombreOrigen`, `nombreMedioPago`, `referenciaExterna` y `motivoObservacion`. `medioPago` admite `PASARELA` («Pago en línea»), pero `POST /matricula/pagos` sigue aceptando solo los cuatro medios manuales. `anulacion.motivo` admite `DEVUELTO`.
- El log de AD-11 agrega el tipo «Devolución». El usuario de los registros de la pasarela es «Sistema».
- `PagosDelHijo` (US43) agrega `pagoEnLinea: boolean` y, en cada cuota, `pagable: boolean` (Pendiente o Vencido sin pago en revisión).

### Conciliación (US71)

`npm run conciliar-pagos` revisa los intentos Pendiente creados hace más de 10 minutos. Consulta su order (`GET /v1/orders/{id}`) y aplica el resultado: registra, observa, rechaza o expira. Un intento sin order y ya vencido pasa a Expirado. En la EC2 lo ejecuta `kubo-conciliar-pagos.timer` cada 15 minutos (ver [DESPLIEGUE-AWS.md](../DESPLIEGUE-AWS.md#pago-en-línea-mercado-pago-modo-de-prueba)). Sin `PASARELA` no hace nada.

## Bloque M4 · Cuotas de ingreso, mora y extraordinarias

Nuevos tipos de cuota (`concepto_cobro.tipo`): `INGRESO`, `MORA` y `EXTRAORDINARIA`. Las cuotas del estado de cuenta y
del portal del apoderado traen `cuotaOrigenId` (la pensión de una mora) y, en el estado de cuenta, `motivoAnulacion`.

### Cuota de ingreso

Al confirmar la matrícula de un **alumno nuevo** (sin otra matrícula del colegio que no esté Anulada, de cualquier año)
se agrega «Cuota de ingreso AAAA» con el monto `MONTO_INGRESO` del año (ver [academico.md](academico.md#montos-del-año-us21))
y el mismo vencimiento que la matrícula. Con monto 0 no se genera. `GET /matricula/estudiantes/{id}` agrega
`esAlumnoNuevo` y `montos.montoIngreso`, y el cronograma previsto ya la incluye. `GENERAR_CRONOGRAMA` registra
`cuotaIngreso`.

### Mora

`npm run tareas-programadas` (el timer cada 15 minutos) crea una cuota `MORA` por cada pensión `PENDIENTE` vencida
(vencimiento anterior a hoy, de una matrícula que no está Retirado ni Anulado) que todavía no tiene la suya: concepto
«Mora de la pensión de setiembre 2026», `mes` de la pensión, monto `MONTO_MORA` del año y vencimiento hoy. Es
idempotente: `concepto_cobro.cuota_origen_id` es único (`uq_concepto_cobro_cuota_origen`), así una pensión con mora
(aunque esté condonada) no vuelve a generarla. Con monto 0 no hace nada. Auditoría `GENERAR_MORA` por matrícula
(actor Sistema). El panel de morosidad la etiqueta «Mora Ago», la suma a la deuda y no la cuenta en el filtro de meses
(`moras` en cada fila).

| Método y ruta | Cuerpo | Respuesta `data` |
|---|---|---|
| `POST /matricula/cuotas/{id}/condonar` · `COORDINADOR` | `{ motivo }` (1 a 200) | `{ cuotaId, estado: "ANULADO", concepto, monto, motivo }` |

Solo una mora pendiente (`422 CUOTA_NO_ES_MORA`, `409 MORA_PAGADA`, `409 MORA_YA_CONDONADA`). Auditoría `CONDONAR_MORA`
(entidad `concepto_cobro`).

### Cuotas extraordinarias · `COORDINADOR`

| Método y ruta | Cuerpo | Respuesta `data` |
|---|---|---|
| `POST /matricula/extraordinarias/vista-previa` | `{ anioAcademicoId, concepto, monto, fechaVencimiento, destino, destinoId? }` | `{ concepto, monto, destinoNombre, cantidad, total, alumnos: [{ matriculaId, nombreCompleto, seccion }] }` |
| `POST /matricula/extraordinarias` | lo mismo | `201` · detalle del lote |
| `GET /matricula/extraordinarias?anioId=` | — | `{ items: [{ loteId, concepto, monto, fechaVencimiento, destino, destinoNombre, estado, creadoPor, anulacion, resumen: { cuotas, pendientes, pagadas, anuladas, total } }] }` |
| `GET /matricula/extraordinarias/{id}` | — | El lote con `cuotas: [{ cuotaId, estado, monto, nombreCompleto, seccion }]` |
| `POST /matricula/extraordinarias/{id}/anular` | `{ motivo }` | El lote `ANULADO`: sus cuotas pendientes pasan a Anulado; las pagadas se conservan |
| `POST /matricula/cuotas/{id}/anular` | `{ motivo }` | Una cuota extraordinaria pendiente anulada |

- `destino`: `ALUMNO` (`destinoId` = estudiante), `SECCION`, `GRADO` o `ANIO` (sin `destinoId`). Se genera una cuota por
  cada matrícula **Matriculado** del destino; sin ninguna, `422 LOTE_SIN_MATRICULAS`.
- `concepto` de 1 a 100 caracteres; `monto` mayor a 0; `fechaVencimiento` desde hoy (`422 VENCIMIENTO_PASADO`); el año
  debe estar en matrícula o en curso (`422 ANIO_NO_ADMITE_CUOTAS`).
- Auditoría `CREAR_LOTE_EXTRAORDINARIO`, `ANULAR_LOTE_EXTRAORDINARIO` y `ANULAR_CUOTA_EXTRAORDINARIA`. Aviso de la
  campana (tipo `PAGO`) al apoderado responsable de cada matrícula al crear y al anular.
- Aparecen en el estado de cuenta, en AP-02 (también para pagar en línea) y en el recibo. No entran en el orden de pago.

## Bloque M4 · Proceso de matrícula y matrícula en línea

### Proceso del año · `COORDINADOR`

| Método y ruta | Cuerpo | Respuesta `data` |
|---|---|---|
| `GET /matricula/procesos/{anioId}` | — | `{ anio, configurado, estado, nombreEstado, fechaInicio, fechaFin, actualizadoEn, documentos: [{ documentoId, nombre, obligatorio }], sugeridos }` |
| `PUT /matricula/procesos/{anioId}` | `{ fechaInicio, fechaFin, documentos: [{ id?, nombre, obligatorio }] }` | Lo mismo |

- `estado`: `SIN_CONFIGURAR`, `PROXIMO` (antes del inicio), `ABIERTO` (bordes incluidos) o `CERRADO`.
- De 1 a 15 documentos con nombre (hasta 100) sin repetir. Un documento que se quita queda inactivo (los ya subidos lo
  siguen nombrando); sin `id`, se crea uno nuevo. Año cerrado: `422 ANIO_CERRADO`. Auditoría
  `CONFIGURAR_PROCESO_MATRICULA` con lo anterior.

### Matrícula en línea · `APODERADO`

| Método y ruta | Cuerpo | Respuesta `data` |
|---|---|---|
| `GET /matricula/apoderado/matricula` | — | `{ hoy, proceso, grados, hijos: [{ estudianteId, nombreCompleto, dni, gradoIngresoId, apoderados, estadoMatricula, puedeMatricular, motivo, solicitud }] }` |
| `POST /matricula/apoderado/hijos/{id}/matricula` | multipart: `gradoId`, `vinculoResponsableId`, `confirmaDatos` (`true`) y un archivo por documento en `documento:<documentoRequeridoId>` | `201` · la solicitud |
| `POST /matricula/apoderado/hijos/{id}/matricula/documentos/{documentoId}` | multipart: `archivo` | La solicitud (el documento vuelve a «En revisión») |

- El año es el del proceso abierto (si no hay, el próximo o el último cerrado). Fuera de fechas:
  `422 MATRICULA_AUN_NO_ABRE` «La matrícula en línea empieza el 01/12/2026.», `422 MATRICULA_CERRADA`,
  `422 MATRICULA_NO_CONFIGURADA`. Con matrícula: `409 HIJO_YA_MATRICULADO` o `409 SOLICITUD_EXISTENTE`. Un hijo con el
  borrador En proceso del registro (US17) sin solicitud sí puede: la solicitud completa ese borrador.
- Cada archivo: PDF o JPG de hasta 5 MB (por su contenido real). Faltó un obligatorio: `400 DOCUMENTO_FALTANTE`.
- Crea la matrícula `EN_PROCESO` (sin sección, con el responsable del pago) y la solicitud `EN_REVISION` «Documentos en
  revisión». Auditoría `SOLICITAR_MATRICULA`; aviso de la campana a los coordinadores.
- Reemplazar: solo un documento `OBSERVADO` o uno opcional que faltaba (`409 DOCUMENTO_NO_REEMPLAZABLE`). Auditoría
  `REEMPLAZAR_DOCUMENTO_MATRICULA`; el archivo anterior se borra después de confirmar.

### Revisión · `COORDINADOR`

| Método y ruta | Cuerpo | Respuesta `data` |
|---|---|---|
| `GET /matricula/solicitudes?anioId=&estado=` | — | `{ items: [{ solicitudId, estudiante, dni, grado, apoderado, enviadaEn, estado, documentos: { requeridos, aprobados, observados, enRevision } }], totales }` |
| `GET /matricula/solicitudes/{id}` | — | La solicitud con `documentos`, `puedeAsignar`, `documentosPendientes` y `secciones` del grado con sus vacantes |
| `POST /matricula/solicitudes/{id}/documentos/{documentoId}/revisar` | `{ decision: "APROBAR" \| "OBSERVAR", observacion? }` | El detalle |
| `POST /matricula/solicitudes/{id}/asignar-seccion` | `{ seccionId, modalidadPago }` | El detalle de la matrícula (como `POST /matricula/matriculas`) |
| `GET /matricula/solicitudes/{id}/documentos/{documentoId}/archivo` · `COORDINADOR` o `APODERADO` del alumno | — | El archivo (PDF o JPG, inline); otro apoderado: `403 ESTUDIANTE_NO_VINCULADO` |

- Estados de la solicitud: `EN_REVISION`, `OBSERVADA` (algún documento observado), `APROBADA` (todos los obligatorios
  aprobados), `MATRICULADA` y `ANULADA` (si se anula la matrícula).
- Observar exige la observación (`400 OBSERVACION_REQUERIDA`); un documento ya revisado no se vuelve a revisar hasta que
  el apoderado lo reemplace. Auditoría `REVISAR_DOCUMENTO_MATRICULA`; aviso al apoderado en cada cambio.
- Asignar la sección usa la misma confirmación de `POST /matricula/matriculas` (también desde AD-10): exige los
  obligatorios aprobados (`422 DOCUMENTOS_PENDIENTES`) y una sección del grado pedido (`422 SECCION_OTRO_GRADO`), genera
  el cronograma (con la cuota de ingreso si es alumno nuevo), marca la solicitud `MATRICULADA` y avisa al apoderado.

## Códigos de error

| Código | HTTP | Cuándo |
|---|---|---|
| `DATOS_INVALIDOS` | 400 | Falta un campo o tiene formato incorrecto (`details` = mensaje por campo) |
| `SIN_MATRICULA_VIGENTE` | 403 | Portal del alumno: «No tienes una matrícula vigente. Comunícate con la secretaría del colegio.» (US49) |
| `MATRICULA_NO_ENCONTRADA` · `ESTUDIANTE_NO_ENCONTRADO` · `SECCION_NO_ENCONTRADA` | 404 | No existe |
| `YA_MATRICULADO` | 409 | «Este estudiante ya está matriculado en el periodo actual» |
| `SECCION_SIN_VACANTES` | 409 | «Sección sin vacantes disponibles» |
| `SECCION_INACTIVA` · `MATRICULA_NO_ANULABLE` · `MATRICULA_CON_PAGOS` | 409 | Estado que no permite la operación |
| `DESTINO_SIN_VACANTES` | 409 | «La sección destino no tiene vacantes disponibles» |
| `MATRICULA_NO_TRASLADABLE` · `MATRICULA_NO_RETIRABLE` · `FICHA_NO_DISPONIBLE` | 409 | Estado que no permite trasladar, retirar o generar la ficha |
| `TRASLADO_OTRO_GRADO` | 422 | «Solo se permite el traslado entre secciones del mismo grado» |
| `MOTIVO_RETIRO_REQUERIDO` | 422 | «Seleccione el motivo del retiro» |
| `FICHA_DATOS_PENDIENTES` | 422 | «No se puede generar la ficha: existen datos obligatorios pendientes» (`details.pendientes`) |
| `MISMA_SECCION` · `FECHA_TRASLADO_INVALIDA` · `FECHA_RETIRO_INVALIDA` | 422 | Reglas del traslado y del retiro |
| `NUMERO_OPERACION_REQUERIDO` | 422 | «El número de operación es obligatorio» |
| `MONTO_NO_COINCIDE` | 422 | «El monto ingresado no coincide con el total de las cuotas seleccionadas» (`details.total`) |
| `CUOTA_YA_PAGADA` | 409 | «Esta pensión ya fue cancelada el [fecha]» |
| `MATRICULA_PENDIENTE` | 409 | «Primero debe pagarse la matrícula [año]. Inclúyela en este pago o regístrala antes.» (D-14, `details.anio`) |
| `CUOTAS_ANTERIORES_PENDIENTES` | 409 | «Primero deben pagarse las cuotas anteriores: [conceptos].» (D-14, `details.conceptos`) |
| `RECIBO_NO_CONFIRMADO` | 422 | «No se puede generar un recibo de un pago no confirmado» |
| `PAGO_NO_OBSERVADO` · `PAGO_YA_ANULADO` · `CUOTA_ANULADA` | 409 | Estado que no permite confirmar, descartar, anular o pagar |
| `PAGO_NO_ENCONTRADO` · `CUOTA_NO_ENCONTRADA` | 404 | No existe |
| `ESTUDIANTE_NO_VINCULADO` | 403 | Portal del apoderado: «No tienes acceso a la información de este estudiante.» |
| `MONTO_NO_COINCIDE_PENDIENTE` | 422 | «El monto no coincide con el total pendiente» (pago anual, `details.total`) |
| `SIN_CUOTAS_PENDIENTES` | 422 | Pago anual sin cuotas pendientes |
| `PAGO_ANUAL_NO_PERMITIDO` | 409 | Pago anual de una matrícula que no está Matriculado |
| `SIN_CUOTAS` · `CUOTA_REPETIDA` · `CUOTAS_DE_VARIOS_ESTUDIANTES` · `FECHA_PAGO_FUTURA` · `MOTIVO_ANULACION_REQUERIDO` · `DETALLE_ANULACION_REQUERIDO` | 422 | Reglas del pago y de su anulación |
| `MATRICULA_INCOMPLETA` | 422 | «Complete la sección y el apoderado responsable para confirmar la matrícula» |
| `SIN_MONTOS` · `ANIO_NO_MATRICULABLE` · `SECCION_OTRO_ANIO` · `RESPONSABLE_NO_VINCULADO` | 422 | Reglas de la matrícula |
| `FIRMA_INVALIDA` | 401 | Aviso de la pasarela sin una firma `x-signature` válida |
| `INTENTO_NO_ENCONTRADO` | 404 | El intento no existe o es de otra persona |
| `PAGO_EN_LINEA_NO_DISPONIBLE` · `SIMULACION_NO_DISPONIBLE` | 409 | Pasarela sin configurar, o simulación con una pasarela que no es la falsa |
| `DEVOLUCION_NO_PERMITIDA` · `USAR_DEVOLUCION` | 409 | Devolución de algo que no es un pago en línea Observado; descarte de un pago en línea |
| `CUOTAS_DE_VARIAS_MATRICULAS` | 422 | «Elige cuotas de un mismo año académico.» |
| `PASARELA_NO_RESPONDE` | 502 | La pasarela no creó la order |
| `INGRESO_CON_MATRICULA` · `MORA_CON_PENSION` | 409 | Bloque M4: orden de pago con cuota de ingreso y mora |
| `CUOTA_NO_ES_MORA` · `CUOTA_NO_ES_EXTRAORDINARIA` | 422 | Condonar algo que no es una mora o anular algo que no es una extraordinaria |
| `MORA_PAGADA` · `MORA_YA_CONDONADA` · `CUOTA_PAGADA` · `CUOTA_YA_ANULADA` · `LOTE_YA_ANULADO` | 409 | Estado que no permite condonar o anular |
| `MOTIVO_REQUERIDO` · `CONCEPTO_REQUERIDO` · `DESTINO_REQUERIDO` | 400 | Datos de la condonación o del lote |
| `VENCIMIENTO_PASADO` · `ANIO_NO_ADMITE_CUOTAS` · `LOTE_SIN_MATRICULAS` | 422 | Reglas del lote extraordinario |
| `DESTINO_NO_ENCONTRADO` · `LOTE_NO_ENCONTRADO` · `SOLICITUD_NO_ENCONTRADA` | 404 | No existe |
| `FECHAS_PROCESO_INVALIDAS` · `SIN_DOCUMENTOS_REQUERIDOS` · `DEMASIADOS_DOCUMENTOS` · `DOCUMENTO_SIN_NOMBRE` | 400 | Configuración del proceso de matrícula |
| `DOCUMENTO_REPETIDO` | 409 | Dos documentos con el mismo nombre |
| `MATRICULA_NO_CONFIGURADA` · `MATRICULA_AUN_NO_ABRE` · `MATRICULA_CERRADA` | 422 | Matrícula en línea fuera de las fechas (con la fecha en el mensaje) |
| `HIJO_YA_MATRICULADO` · `SOLICITUD_EXISTENTE` · `SOLICITUD_CERRADA` · `DOCUMENTO_NO_REEMPLAZABLE` · `DOCUMENTO_YA_REVISADO` | 409 | Estado que no permite matricular, reemplazar o revisar |
| `DATOS_NO_CONFIRMADOS` · `GRADO_NO_VALIDO` · `DOCUMENTO_FALTANTE` · `DOCUMENTO_NO_REQUERIDO` · `OBSERVACION_REQUERIDA` | 400 | Datos de la solicitud o de la revisión |
| `DOCUMENTOS_PENDIENTES` · `SECCION_OTRO_GRADO` | 422 | Asignar la sección sin los obligatorios aprobados o en otro grado |
| `ARCHIVO_NO_PERMITIDO` · `ARCHIVO_DEMASIADO_GRANDE` | 400 · 413 | «Cada documento debe ser un PDF o una imagen JPG de hasta 5 MB.» |

## Auditoría (RF03)

`CONFIRMAR_MATRICULA` (estado anterior, sección, responsable, modalidad y fecha), `GENERAR_CRONOGRAMA` (cantidad de cuotas, total, si fue extemporánea y los montos usados) `ANULAR_MATRICULA` (estado anterior, cuotas anuladas y motivo), `TRASLADAR_SECCION` (sección antes y después, fecha y motivo), `RETIRAR_ESTUDIANTE` (estado anterior, fecha, motivo y la lista de cuotas anuladas) y `GENERAR_FICHA_MATRICULA` (estado, fecha de generación y tamaño; nunca el contenido del PDF).

Los pagos (US04) se registran con `entidad_afectada = "operacion_pago"`:
- `REGISTRAR_PAGO`: `administradorId`, `fechaHora`, `monto`, `conceptos`, `numeroOperacion`, `medioPago`, `fechaPago`, `estadoResultante` («PAGADO» u «OBSERVADO») y `comprobante`.
- `CONFIRMAR_PAGO_OBSERVADO`: estado anterior y nuevo, monto, conceptos, número, comprobante y `confirmadoPorId`.
- `ANULAR_PAGO`: estado anterior, motivo, monto, conceptos, número, comprobante, cuotas revertidas y, al descartar, `decision: "DESCARTAR_OBSERVADO"`. La columna `motivo` guarda «MOTIVO: observación».
- Desde US70, `REGISTRAR_PAGO` también guarda `actor` (`USUARIO` | `SISTEMA`), `origen` (`TESORERIA` | `PASARELA`) y `motivoObservacion`. En un pago en línea agrega `referenciaExterna` (order) e `intentoId`, y `usuario_id` queda nulo (actor Sistema).
- `REGISTRAR_DEVOLUCION` (US71): estado anterior (`OBSERVADO` y su motivo), estado nuevo `ANULADO`, motivo `DEVUELTO`, origen, monto, conceptos, número y `referenciaExterna`. La columna `motivo` guarda «Devuelto: observación».

El portal del apoderado registra `DESCARGAR_COMPROBANTE_APODERADO` (`entidad_afectada = "comprobante"`) con `estudianteId`, `cuotaId`, `operacionId` y `comprobante`.

La bitácora es inmutable (trigger `tg_auditoria_inmutable`) y `platform/auditoria` la lee con `eventosDeAuditoria` para el log de AD-11. Los montos del año registran `GUARDAR_MONTOS_ANIO` (valores anteriores y nuevos). El DNI no se escribe en la auditoría ni en los logs.

## Migración `20261106120000_anular_matricula_en_proceso`

La restricción `ck_matricula_confirmada_completa` exigía sección y responsable en todo estado distinto de `EN_PROCESO`. Por eso anular un borrador de US17 (sin sección) fallaba con 500. La migración también exime a `ANULADO`. Es compatible con la versión anterior: solo relaja la regla y ninguna fila existente deja de cumplirla.

## Migración `20261111120000_pasarela_pagos`

US70 y US71. Agrega el valor `PASARELA` a `MedioPago` y `DEVUELTO` a `MotivoAnulacion`, y los enum `OrigenPago` y `EstadoIntentoPago`. En `operacion_pago` agrega `origen` (por defecto `TESORERIA`), `referencia_externa` (única, `uq_operacion_pago_referencia_externa`) y `motivo_observacion`, y permite `registrado_por_id` nulo solo con origen `PASARELA` (`ck_operacion_pago_registrador`). Una operación de la pasarela exige `referencia_externa` (`ck_operacion_pago_referencia_pasarela`). Crea la tabla `intento_pago`, con `ck_intento_pago_monto` y `ck_intento_pago_cuotas`. Es compatible con la versión anterior: las operaciones existentes quedan con origen `TESORERIA` y conservan su registrador.

## Migraciones del bloque M4

- `20261129120000_tipos_cuota_m4`: `INGRESO`, `MORA` y `EXTRAORDINARIA` en `TipoConcepto`.
- `20261129130000_mora_cuota_origen`: `concepto_cobro.cuota_origen_id` (única), `anulado_por_id`, `anulado_en` y
  `motivo_anulacion`; `ck_concepto_cobro_mora_origen`.
- `20261129140000_cuota_extraordinaria`: tabla `lote_cuota_extraordinaria` y `concepto_cobro.lote_id`
  (`ck_concepto_cobro_lote`, `uq_concepto_cobro_lote_matricula`).
- `20261129150000_ck_concepto_mes_m4`: `ck_concepto_mes` admite los tipos nuevos (la mora puede llevar el mes de su
  pensión; ingreso y extraordinaria, sin mes).
- `20261129160000_proceso_matricula`: `proceso_matricula` y `documento_requerido`.
- `20261129170000_solicitud_matricula`: `solicitud_matricula` y `documento_matricula`.

Todas son compatibles con la versión anterior: solo agregan valores, columnas opcionales y tablas.
