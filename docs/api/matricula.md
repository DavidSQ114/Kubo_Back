# API · Matrícula: matrícula en sección, cronograma de pagos y anulación (US18, US21, M-19)

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
- `DetalleMatricula`: `{ matriculaId, estado, fechaMatricula, modalidadPago, anio, estudiante, seccion: { id, nombre, aula, tutor } | null, apoderados: [… , esResponsablePago], cronograma: { cuotas: [{ id, tipo, mes, concepto, monto, fechaVencimiento, estado }], total }, anulacion: { anuladoEn, motivo } | null, pagos, puedeAnular }`. `total` suma las cuotas no anuladas.

### Anular (M-19)

- `motivo`: `ERROR_DIGITACION` · `SOLICITUD_APODERADO` · `OTRO` (los valores de `MotivoAnulacion` que aplican a una matrícula; `PAGO_DUPLICADO` es de los pagos). `detalle`: 5 a 200 caracteres. Se guarda en `motivo_anulacion` como «CODIGO: detalle».
- Solo `EN_PROCESO` o `MATRICULADO`: si no, `409 MATRICULA_NO_ANULABLE`. Con pagos no anulados aplicados a sus cuotas: `409 MATRICULA_CON_PAGOS` «No se puede anular esta matrícula: primero anula los pagos confirmados de esta matrícula.».
- En una transacción: las cuotas `PENDIENTE` pasan a `ANULADO` (US21), la matrícula pasa a `ANULADO` con `anulado_en`, `anulado_por_id` y el motivo, se cierra su historial de sección (libera la vacante) y se registra `ANULAR_MATRICULA` con el motivo.

## Códigos de error

| Código | HTTP | Cuándo |
|---|---|---|
| `DATOS_INVALIDOS` | 400 | Falta un campo o tiene formato incorrecto (`details` = mensaje por campo) |
| `MATRICULA_NO_ENCONTRADA` · `ESTUDIANTE_NO_ENCONTRADO` · `SECCION_NO_ENCONTRADA` | 404 | No existe |
| `YA_MATRICULADO` | 409 | «Este estudiante ya está matriculado en el periodo actual» |
| `SECCION_SIN_VACANTES` | 409 | «Sección sin vacantes disponibles» |
| `SECCION_INACTIVA` · `MATRICULA_NO_ANULABLE` · `MATRICULA_CON_PAGOS` | 409 | Estado que no permite la operación |
| `MATRICULA_INCOMPLETA` | 422 | «Complete la sección y el apoderado responsable para confirmar la matrícula» |
| `SIN_MONTOS` · `ANIO_NO_MATRICULABLE` · `SECCION_OTRO_ANIO` · `RESPONSABLE_NO_VINCULADO` | 422 | Reglas de la matrícula |

## Auditoría (RF03)

`CONFIRMAR_MATRICULA` (estado anterior, sección, responsable, modalidad y fecha), `GENERAR_CRONOGRAMA` (cantidad de cuotas, total, si fue extemporánea y los montos usados) y `ANULAR_MATRICULA` (estado anterior, cuotas anuladas y motivo). Los montos del año registran `GUARDAR_MONTOS_ANIO` (valores anteriores y nuevos). El DNI no se escribe en la auditoría ni en los logs.
