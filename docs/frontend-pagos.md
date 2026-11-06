# Frontend · Pensiones y pagos (AD-11), registrar pago (M-01), anular pago (M-02) y recibo (M-03)

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
| «Cambiar a pago anual» (M-15) | No está | El pago anual adelantado es de otra historia |
| «Otros filtros: Estado» | No está | El estado de cuenta muestra todas las cuotas de un estudiante; los filtros por estado son del panel de morosidad (US24) |
| Recuadro «Reglas de cobro» | No está | Las reglas se explican en los avisos de cada acción y en las notas al pie de las tablas |
| M-02: aviso «El N.° de operación … también está en otro pago» | El aviso de número repetido está en la fila de la operación Observado | Solo las Observado comparten número con otra operación vigente |
| Recibo «R-000398» | «R-2026-000001» | El encargo pide el correlativo por año |
| Fecha de pago con hora («30/09/2026 · 10:15») | Solo la fecha; la hora del registro está en el log | La fecha de pago la indica el administrador (la del voucher); la hora real es la del registro |
