# Arquitectura · Bitácora de notas y rectificación de nota (US03, US41)

Decisión AD-16. Sprint 3, bloque 8. Código en `src/modules/evaluacion` (dueño de `nota`, `bitacora_nota` y `solicitud_rectificacion`); migración `prisma/migrations/20261118180000_bitacora_y_rectificacion_notas`. API en [api/evaluacion.md](../api/evaluacion.md).

## AD-16 · Bitácora de notas inmutable, escrita por la aplicación, y un único camino para cambiar una nota cerrada

**Contexto.** US03 pide que cada cambio de una nota quede registrado (quién, cuándo, curso, estudiante, competencia, valor anterior y nuevo) en una bitácora de solo lectura que el Administrador consulta por fechas y docente. US41 agrega la única forma de corregir una nota después del cierre: una solicitud del docente que el Administrador aprueba. Desde US40, el trigger `tg_nota_registro_cerrado` impide crear o cambiar notas de un registro `CERRADO` o `PUBLICADO`, también fuera de la aplicación. La auditoría general (`registro_auditoria`, RF03) ya es inmutable, pero guarda JSON libre por entidad y no sirve para filtrar por docente, curso o estudiante.

**Decisión.**

1. **Tabla propia `bitacora_nota`**, separada de `registro_auditoria`: columnas tipadas para filtrar y mostrar sin abrir JSON (`docente_id`, `created_at` con índices), y una fila por nota, no por operación.
2. **Inmutable en la base:** `tg_bitacora_nota_inmutable` (`BEFORE UPDATE OR DELETE`, por fila) y `tg_bitacora_nota_sin_vaciar` (`BEFORE TRUNCATE`) lanzan `BITACORA_NOTA_INMUTABLE`, igual que `tg_auditoria_inmutable`. La aplicación no tiene ninguna operación que la cambie; el clasificador de errores traduce el código a un mensaje legible.
3. **Sin claves foráneas y con copia de los nombres.** Cada fila guarda los ids (nota, registro, matrícula, competencia, usuario, docente, solicitud) y, en texto, el nombre del usuario y del docente, el curso, la sección, el bimestre, el estudiante y la competencia **tal como eran al momento del cambio**. Una bitácora inmutable no puede depender de filas que después cambian o se borran: con claves foráneas, `ON DELETE SET NULL` haría un `UPDATE` (que el trigger rechaza) y `RESTRICT` impediría borrar un registro de notas o un usuario de prueba. Además, la consulta de AD-16 no necesita leer tablas de otros módulos (respeta la regla 3.3 del estándar).
4. **La escribe la aplicación, en la misma transacción que la nota:** `guardarNotas` (una fila por cada nota nueva y cada cambio; las que llegan con el mismo valor no) y `aprobarRectificacion` (origen `RECTIFICACION` con el id de la solicitud). Si la transacción falla, no queda ni la nota ni su fila de bitácora.
5. **Un único camino para cambiar una nota cerrada.** `fn_nota_registro_cerrado` sigue rechazando todo `INSERT` y `UPDATE` en un registro `CERRADO` o `PUBLICADO`, salvo un `UPDATE` que cumple **todo** esto:
   - la transacción declaró la solicitud con `set_config('kubo.rectificacion_id', <id>, true)` (variable local: se borra al terminar la transacción, y la aplicación además la vacía apenas cambia la nota);
   - esa solicitud existe, está `APROBADA` y es de esa misma nota;
   - el cambio es exactamente de `valor_anterior` a `valor_solicitado`, sin mover la nota a otro registro, alumno o competencia.

   La aplicación aprueba la solicitud **antes** de cambiar la nota, dentro de la misma transacción, con la solicitud y el registro bloqueados (`FOR UPDATE`). Dos aprobaciones a la vez: la segunda espera el bloqueo y encuentra la solicitud ya `APROBADA` (`409 SOLICITUD_YA_RESUELTA`).
6. **Recálculo fiel al cierre.** Al aprobar, el consolidado del alumno se recalcula con la versión de la regla y los pesos guardados en el `detalle_calculo` de su resultado (los que se usaron al cerrar), no con la versión que rige hoy.
7. **Restricciones de la solicitud en la base:** `uq_solicitud_rectificacion_pendiente_por_nota` (una sola pendiente por nota, también ante dos pedidos simultáneos), `ck_solicitud_rectificacion_valor_distinto` y `ck_solicitud_rectificacion_motivo_rechazo` (motivo obligatorio al rechazar). La solicitud guarda quién la pidió (`solicitado_por_id`) para que nadie apruebe la suya.

**Alternativas descartadas.**

- *Trigger `AFTER INSERT OR UPDATE ON nota` que escriba la bitácora:* registraría también los cambios hechos fuera de la aplicación, pero el trigger no conoce los nombres (curso, estudiante, docente) sin leer tablas de cuatro módulos, y el origen y la solicitud tendrían que pasar igual por variables de sesión. Como la escritura directa en registros cerrados ya está bloqueada, se prefirió escribirla en la aplicación junto con el resto de la operación.
- *Reusar `registro_auditoria`:* no tiene columnas para filtrar por docente ni por fechas de forma eficiente, y mezclaría los cambios de notas con los demás eventos críticos. La aprobación y el rechazo sí se registran ahí (`APROBAR_RECTIFICACION_NOTA`, `RECHAZAR_RECTIFICACION_NOTA`).
- *Desactivar el trigger de US40 durante la aprobación (`ALTER TABLE … DISABLE TRIGGER` o `session_replication_role`):* exige privilegios de dueño y deja la tabla abierta a cualquier escritura mientras dura. La variable de sesión solo habilita el cambio exacto de una solicitud aprobada.
- *Una variable de sesión «modo rectificación» sin comprobar la solicitud:* cualquier código (o un usuario con acceso a la base) podría usarla para cambiar cualquier nota. El trigger valida la solicitud, la nota y los dos valores.

**Consecuencias.**

- La bitácora crece con cada nota (unos 40 alumnos × 6 competencias × 4 bimestres por sección y curso al año, más los cambios). Los índices `(created_at)` y `(docente_id, created_at)` cubren los filtros de AD-16.
- Las filas de la bitácora no se borran nunca, ni siquiera en las pruebas: las pruebas de integración filtran por los ids que crean. Si se borra un registro de notas, su historia queda en la bitácora con los nombres de ese momento.
- Un usuario con acceso directo a la base podría insertar una solicitud `APROBADA` y declararla; eso exige además escribir en `solicitud_rectificacion`, y queda a la vista en la bandeja y sin la fila de auditoría `APROBAR_RECTIFICACION_NOTA`. El control de acceso a la base (Neon, AWS) sigue siendo la protección principal.
- La migración agrega `solicitud_rectificacion.solicitado_por_id NOT NULL`: la tabla no se usaba antes y no tiene filas.
