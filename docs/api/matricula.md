# API · Matrícula: matrícula en sección, cronograma, anulación, traslado, retiro y ficha (US18, US21, M-19, US19, US57, US20) y pagos (US22, US23, US04, US25)

Base: `/api/v1` · Formato: JSON · Éxito `{ "data": … }` · Error `{ "error": { "code", "message", "details" } }`
El `message` de los errores ya está redactado para mostrarse al usuario (RNF09). Todas las rutas exigen sesión con el rol `ADMINISTRADOR` (ver [identidad.md](identidad.md)). Ejemplos en [matricula.http](matricula.http).

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

- `conceptoIds`: de 1 a 11 cuotas `PENDIENTE` del **mismo estudiante**. `monto`: texto con hasta dos decimales (`"900"` o `"900.00"`). `medioPago`: `EFECTIVO` · `TRANSFERENCIA` · `DEPOSITO` · `TARJETA`. `numeroOperacion`: se guarda sin espacios sobrantes y en mayúsculas. `fechaPago`: `AAAA-MM-DD`, no futura.
- Validaciones:
  - Sin número de operación: `422 NUMERO_OPERACION_REQUERIDO` «El número de operación es obligatorio».
  - Fecha futura: `422 FECHA_PAGO_FUTURA`.
  - Cuota ya pagada: `409 CUOTA_YA_PAGADA` «Esta pensión ya fue cancelada el 03/07/2026» (la fecha de pago de la operación que la canceló).
  - Cuota anulada `409 CUOTA_ANULADA`, inexistente `404 CUOTA_NO_ENCONTRADA`, repetida `422 CUOTA_REPETIDA`, de otro estudiante `422 CUOTAS_DE_VARIOS_ESTUDIANTES`.
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

## Códigos de error

| Código | HTTP | Cuándo |
|---|---|---|
| `DATOS_INVALIDOS` | 400 | Falta un campo o tiene formato incorrecto (`details` = mensaje por campo) |
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
| `RECIBO_NO_CONFIRMADO` | 422 | «No se puede generar un recibo de un pago no confirmado» |
| `PAGO_NO_OBSERVADO` · `PAGO_YA_ANULADO` · `CUOTA_ANULADA` | 409 | Estado que no permite confirmar, descartar, anular o pagar |
| `PAGO_NO_ENCONTRADO` · `CUOTA_NO_ENCONTRADA` | 404 | No existe |
| `SIN_CUOTAS` · `CUOTA_REPETIDA` · `CUOTAS_DE_VARIOS_ESTUDIANTES` · `FECHA_PAGO_FUTURA` · `MOTIVO_ANULACION_REQUERIDO` · `DETALLE_ANULACION_REQUERIDO` | 422 | Reglas del pago y de su anulación |
| `MATRICULA_INCOMPLETA` | 422 | «Complete la sección y el apoderado responsable para confirmar la matrícula» |
| `SIN_MONTOS` · `ANIO_NO_MATRICULABLE` · `SECCION_OTRO_ANIO` · `RESPONSABLE_NO_VINCULADO` | 422 | Reglas de la matrícula |

## Auditoría (RF03)

`CONFIRMAR_MATRICULA` (estado anterior, sección, responsable, modalidad y fecha), `GENERAR_CRONOGRAMA` (cantidad de cuotas, total, si fue extemporánea y los montos usados) `ANULAR_MATRICULA` (estado anterior, cuotas anuladas y motivo), `TRASLADAR_SECCION` (sección antes y después, fecha y motivo), `RETIRAR_ESTUDIANTE` (estado anterior, fecha, motivo y la lista de cuotas anuladas) y `GENERAR_FICHA_MATRICULA` (estado, fecha de generación y tamaño; nunca el contenido del PDF).

Los pagos (US04) se registran con `entidad_afectada = "operacion_pago"`:
- `REGISTRAR_PAGO`: `administradorId`, `fechaHora`, `monto`, `conceptos`, `numeroOperacion`, `medioPago`, `fechaPago`, `estadoResultante` («PAGADO» u «OBSERVADO») y `comprobante`.
- `CONFIRMAR_PAGO_OBSERVADO`: estado anterior y nuevo, monto, conceptos, número, comprobante y `confirmadoPorId`.
- `ANULAR_PAGO`: estado anterior, motivo, monto, conceptos, número, comprobante, cuotas revertidas y, al descartar, `decision: "DESCARTAR_OBSERVADO"`. La columna `motivo` guarda «MOTIVO: observación».

La bitácora es inmutable (trigger `tg_auditoria_inmutable`) y `platform/auditoria` la lee con `eventosDeAuditoria` para el log de AD-11. Los montos del año registran `GUARDAR_MONTOS_ANIO` (valores anteriores y nuevos). El DNI no se escribe en la auditoría ni en los logs.

## Migración `20261106120000_anular_matricula_en_proceso`

La restricción `ck_matricula_confirmada_completa` exigía sección y responsable en todo estado distinto de `EN_PROCESO`. Por eso anular un borrador de US17 (sin sección) fallaba con 500. La migración también exime a `ANULADO`. Es compatible con la versión anterior: solo relaja la regla y ninguna fila existente deja de cumplirla.
