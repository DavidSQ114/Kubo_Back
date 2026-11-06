# Frontend · Pensiones y pagos (AD-11, M-01, M-02, M-03, M-15), morosidad (AD-12) y log de errores (AD-16)

# AD-11 · Pensiones y pagos (US22, US23, US04, US25)

Pantalla `/admin/pagos`, según el frame **AD-11 · Pensiones y pagos** de la página «1 · Prototipo escritorio - Propuesta» del Figma (captura en `docs/figma/AD-11-pensiones-pagos.png`) y los modales **M-01 · Registrar pago manual** (`docs/figma/M-01-registrar-pago.png`), **M-02 · Anular pago** (`docs/figma/M-02-anular-pago.png`) y **M-03 · Comprobante de pago (PDF)** (`docs/figma/M-03-comprobante-pago.png`). El aviso de pago observado está dentro de AD-11.

Se llega por «Pensiones y pagos» del menú lateral (ya habilitado) y desde el detalle de una matrícula en AD-10 con «Ir a Pensiones y pagos», que abre la pantalla con el estudiante y el año (`?estudiante=<id>&anio=<id>`). El modal M-19 «Anular matrícula» también enlaza aquí cuando la matrícula tiene pagos.

## Archivos

```
src/app/(portal)/admin/pagos/page.tsx       AD-11: búsqueda, estado de cuenta, cronograma, operaciones y log
src/components/admin/pagos.tsx              M-01, M-02, tablas de cronograma, operaciones y log, botón del recibo
src/components/admin/PortalAdmin.tsx        «Pensiones y pagos» habilitado en el menú lateral
src/app/(portal)/admin/matricula/page.tsx   «Ir a Pensiones y pagos» en el detalle de la matrícula
src/components/admin/matricula.tsx          enlace a Pensiones y pagos en M-19 cuando hay pagos
```

## Qué muestra

- **Avisos:**
  - Tras registrar o confirmar: «Operación registrada correctamente · Operación 00561207 · 2 cuotas (…) · S/ 900.00», con lo ocurrido con la copia por correo y «Ver recibo».
  - Con un número repetido: «Operación observada · Este número de operación ya fue utilizado en otro pago…».
  - Si el estudiante tiene operaciones observadas: «1 operación observada · pensión de …».
- **Búsqueda del estudiante** por DNI o nombre (el mismo buscador de AD-10).
  - Al elegir uno: nombre, sección, fecha de matrícula y responsable del pago, modalidad y estado, y los totales «Pagado», «Pendiente» y «Vencido» con la cantidad de cuotas.
  - Si tiene matrículas en varios años, un selector de año.
  - Sin matrícula con cronograma, un aviso con «Ir a Matrícula».
- **Cronograma de pensiones:** concepto, vencimiento, monto, estado (Pagado, Pendiente, Vencido, Observado o Anulado), fecha de pago, N.° de operación y comprobante.
  - Las vencidas van en rojo.
  - Una cuota pagada junto con otras indica «Operación 00561207 · 2 cuotas».
  - Las pagadas tienen el ícono para descargar el recibo y las pendientes, «Registrar pago», que abre M-01 con esa cuota marcada. Al pie, otro «Registrar pago» abre M-01 sin cuotas marcadas.
- **Operaciones de pago:** N.° de operación, fecha, cuotas que cubre, monto, comprobante y estado.
  - Confirmado: descargar recibo y anular (M-02).
  - Observado: el aviso «Número ya usado en R-…» y los botones «Descartar» y «Confirmar».
  - Anulado: «Anulado el … por R. Huamán · motivo: detalle», y su recibo se sigue descargando con la marca «ANULADO».
- **Log de auditoría de pagos:** fecha y hora, acción (Registro, Confirmación o Anulación), detalle y usuario.
- **M-01 Registrar pago manual:**
  - Estudiante y responsable; cuotas pendientes con casillas, vencimiento y estado.
  - «Total de la operación» con la cantidad de cuotas. El monto sigue al total mientras no se edite a mano.
  - Campos de monto, fecha de pago (hasta hoy), N.° de operación y medio de pago.
  - Mensajes: sin número, «El número de operación es obligatorio»; monto distinto, «El monto ingresado no coincide con el total de las cuotas seleccionadas»; cuota ya pagada, «Esta pensión ya fue cancelada el [fecha]».
- **M-02 Anular pago:**
  - Operación, recibo, cuotas y monto.
  - Motivos en tarjetas de opción (Error de digitación, Pago duplicado, Solicitud del apoderado, Otro), con la observación opcional, que pasa a ser obligatoria con «Otro».
  - Un aviso explica que las cuotas vuelven a «Pendiente» y que nada se borra.
- **Recibo (M-03):** «Ver recibo» y los íconos de descarga bajan el PDF (`recibo-R-2026-000001.pdf`).

## Diferencias con el Figma (y por qué)

| En el Figma | En el código | Motivo |
|---|---|---|
| M-03: vista previa del recibo en un modal con «Imprimir» y «Descargar PDF» | «Ver recibo» descarga el PDF directamente; se imprime desde el visor del navegador | El PDF se genera en el backend (US25); una vista HTML aparte podría no coincidir con el archivo |
| Recibo con el logo de Kubo y «Registrado por» en el pie | Encabezado con el nombre de la institución, datos, tabla de cuotas y «Registrado por» | El servicio `platform/pdf` usa fuentes estándar, sin imágenes; el contenido pedido por el Backlog está completo |
| Aviso de observado con «Descartar» y «Confirmar pago» en el banner | El banner avisa y los botones están en la fila de la operación, en «Operaciones de pago» | Con varias observadas, cada una se decide en su fila |
| «Otros filtros: Estado» | No está | El estado de cuenta muestra todas las cuotas de un estudiante; los filtros por estado son del panel de morosidad (US24) |
| Recuadro «Reglas de cobro» | No está | Las reglas se explican en los avisos de cada acción y en las notas al pie de las tablas |
| M-02: aviso «El N.° de operación … también está en otro pago» | El aviso de número repetido está en la fila de la operación Observado | Solo las Observado comparten número con otra operación vigente |
| Recibo «R-000398» | «R-2026-000001» | El encargo pide el correlativo por año |
| Fecha de pago con hora («30/09/2026 · 10:15») | Solo la fecha; la hora del registro está en el log | La fecha de pago la indica el administrador (la del voucher); la hora real es la del registro |

# M-15 · Pago anual adelantado (US58)

Captura en `docs/figma/M-15-pago-anual.png`. En AD-11, junto a la modalidad de la matrícula, aparece «Pago anual» si la matrícula está «Matriculado» y tiene cuotas pendientes (archivo `src/components/admin/pagos.tsx`, `ModalPagoAnual`).

- **Contenido del modal:**
  - Estudiante, sección y año.
  - El aviso de que no hay descuento.
  - El resumen: cuotas del año, cuotas ya pagadas (en negativo) y «Total a pagar hoy» con la cantidad de pendientes, calculado en céntimos.
  - Campos de monto (precargado con el total), fecha de pago, N.° de operación y medio.
  - El aviso de lo que ocurre al confirmar.
- **Al registrar:**
  - Con otro monto: «El monto no coincide con el total pendiente».
  - Si se registra: el aviso de AD-11 «Operación registrada correctamente · Operación … · N cuotas · S/ …», con «Ver recibo» de un único comprobante, y la modalidad pasa a «anual».
  - Con un número repetido queda «Observado», igual que un pago manual.

| En el Figma | En el código | Motivo |
|---|---|---|
| «10 pensiones de marzo a diciembre» y «Pensiones ya pagadas (marzo a agosto)» | «N cuotas del año» y «Cuotas ya pagadas (N)» | El total incluye la cuota de matrícula si sigue pendiente y los meses dependen de cada matrícula (las extemporáneas tienen menos) |
| Medio de pago sin asterisco | Medio de pago obligatorio | El registro de pagos (US22) lo exige |
| Texto «si más adelante se aprueba uno, debe configurarse como regla de cobro» | Solo «no hay descuento» | No existen reglas de cobro configurables todavía |

# AD-12 · Panel de morosidad (US24)

Pantalla `/admin/morosidad` (`src/app/(portal)/admin/morosidad/page.tsx`), con «Morosidad» habilitado en el menú lateral. Captura en `docs/figma/AD-12-panel-morosidad.png`.

- **Cabecera:** «Panel de morosidad» con la fecha de hoy (Lima) y «Exportar CSV» (con separador `;` y BOM, para Excel en español) cuando hay resultados.
- **Indicadores:** estudiantes con deuda, deuda vencida total y cuotas vencidas, según el filtro aplicado.
- **Filtros:** año (por defecto, el «En curso»), grado, sección (las del grado), meses adeudados (1, 2 o 3 o más) y orden (deuda total o meses). Se aplican con **«Filtrar»**, que siempre vuelve a consultar (sin caché); «Limpiar filtros» vuelve a todos.
- **Tabla:** estudiante, sección, meses adeudados como etiquetas (Matr., Ago, Set…), N.° de cuotas vencidas, deuda total, días de atraso y el apoderado responsable con parentesco y teléfono.
  - Las filas con 2 o más cuotas vencidas van resaltadas.
  - El ícono de la fila abre AD-11 con el estudiante y el año.
  - Vacío: «No hay estudiantes con pensiones vencidas con estos filtros.».

| En el Figma | En el código | Motivo |
|---|---|---|
| «Enviar recordatorios», casillas, columna «Último recordatorio» y aviso de recordatorios enviados | No están | Los recordatorios de pago son de otra historia (M-24) |
| Columna «Libreta» (Visible / Restringida) y recuadro de restricción automática | No están | La restricción de notas por deuda es de US26 (evaluación) |
| Indicadores «Libretas restringidas» y «Recuperado en setiembre» | «Cuotas vencidas» | Dependen de US26 y de un reporte de recaudación que no existen todavía |
| Buscador de estudiante en el panel | No está; el filtro es por grado y sección | El Backlog pide filtrar por grado y sección; la búsqueda de un estudiante está en AD-11 |
| Sin año ni orden | Selector de año y «Ordenar por» | El encargo pide ordenar por monto o meses; con varios años abiertos hay que elegir uno |
| — | «Exportar CSV» | El encargo lo pide si es trivial |

# AD-16 · Auditoría: log de errores (US05)

Pantalla `/admin/auditoria` (`src/app/(portal)/admin/auditoria/page.tsx`), con «Auditoría» habilitado en el menú lateral. Captura en `docs/figma/AD-16-auditoria-errores.png`.

- **Contenido:** «Log de errores» de solo lectura con filtros Desde, Hasta, Nivel (INFO, WARN, ERROR, FATAL) y Código HTTP (500, 400), aplicados con «Aplicar filtros».
- **Tabla:** fecha y hora, nivel («ERROR 500» en rojo, «INFO» en azul), endpoint con método y detalle (mensaje y correo del usuario), paginada de 20 en 20.
- **Detalle del error** («Ver»): fecha, endpoint, usuario, mensaje, el stack trace completo en un recuadro oscuro con desplazamiento, y el request ID. Un 400 muestra «Sin traza: evento informativo».
- Nota al pie con la rotación a 50 MB con gzip y los niveles. Los textos llegan ya redactados (sin DNI, correos ni tokens).

| En el Figma | En el código | Motivo |
|---|---|---|
| Pestañas «Cambios de notas», «Operaciones de pago» y «Errores del sistema» | Solo el log de errores, con un aviso de dónde están las otras bitácoras | Los cambios de notas llegan con el módulo de evaluación; el log de pagos ya está en AD-11 por estudiante |
| Filtro por docente | Filtros por fecha, nivel y código HTTP | Es el filtro de la bitácora de notas; el encargo pide estos para el log de errores |
| Usuario «r.huaman@kubo.edu.pe» en el detalle | El correo de la cuenta en la pantalla; en la base solo el `usuario_id` | Así no se repite el correo en la tabla de logs |
| «3 archivos comprimidos en el historial» | Texto fijo sobre la rotación | La pantalla no lee el disco del servidor |
