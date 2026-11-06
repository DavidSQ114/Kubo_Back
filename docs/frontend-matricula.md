# Frontend · Matrícula en sección (AD-10), anulación (M-19), traslado (M-05), retiro (M-18) y ficha PDF

# AD-10 · Matrícula en sección (US18, US21)

Pantalla `/admin/matricula`, según el frame **AD-10 · Matrícula en sección** de la página «1 · Prototipo escritorio - Propuesta» del Figma (captura en `docs/figma/AD-10-matricula-seccion.png`) y el modal **M-19 · Anular matrícula** (`docs/figma/M-19-anular-matricula.png`). Se llega con «Matrícula» del menú lateral (ya habilitado) y desde AD-09 con «Guardar y matricular», que abre la pantalla con el estudiante elegido (`?estudiante=<id>`).

## Archivos

```
src/app/(portal)/admin/matricula/page.tsx     AD-10: año, montos, nueva matrícula, resumen y listado
src/components/admin/matricula.tsx            Montos del año (barra y modal), tarjeta de sección, cronograma,
                                              modales de detalle y de anulación (M-19), filtros del listado
src/app/(portal)/admin/usuarios/registrar-estudiante/page.tsx   AD-09: «Guardar y matricular» y pasos 2 y 3
src/components/admin/PortalAdmin.tsx          «Matrícula» habilitado en el menú lateral
src/components/admin/cambiosMatricula.tsx     M-05 traslado, M-18 retiro, botón de la ficha PDF e historial de secciones
src/lib/api.ts                                descargar(): baja un archivo de la API (la ficha) con la sesión renovada
public/figma/icon-traslado*.svg, icon-retiro*.svg, icon-pdf.svg   íconos nuevos con el trazo de los del Figma
```

## Qué muestra

- **Cabecera:** «Matrícula 2026», el selector de año (por defecto el «En matrícula» y, si no hay, el «En curso») y «Registrar estudiante».
- **Montos del año:** «Montos 2026 · Matrícula S/ 350.00 · Pensión mensual S/ 450.00 · Editar montos». Sin montos, un aviso «El año 2026 no tiene montos de matrícula y pensión» con «Configurar montos» (el modal precarga los montos generales) y «Matricular» queda deshabilitado.
- **Nueva matrícula (paso 2 de 3):** buscador de estudiantes por DNI o nombre; al elegir uno se ve su grado de ingreso, apoderado principal y la insignia «Sin matrícula 2026», «En proceso» o «Matriculado».
  - Ya matriculado: aviso «Este estudiante ya está matriculado en el periodo actual» con la sugerencia del traslado de sección.
  - Secciones activas del grado (por defecto, el de ingreso; un selector permite otro grado) como tarjetas con aula, tutor, barra «28/30» y «2 vacantes» o «Sin vacantes» con candado.
  - Apoderado responsable del pago (solo sus vínculos; por defecto el principal) y modalidad (Mensual o Anual).
  - Alertas: «Sección sin vacantes disponibles (30/30)», «Matrícula extemporánea» con los meses que se generarán y los errores del backend.
- **Resumen:** estudiante, responsable del pago, año, sección, aula, fecha y «Cronograma que se generará» (cuota de matrícula, pensiones con su vencimiento y total). Al confirmar, la tarjeta pasa a «Paso 3 de 3 · Cronograma de pagos» y muestra el cronograma generado.
- **Matrículas:** búsqueda por estudiante y filtros por estado, grado y sección, paginado. Cada fila tiene «Ver» (detalle con apoderados, responsable del pago y cronograma con el estado de cada cuota) y, si está «En proceso», un lápiz para completarla arriba.
- **Anular (M-19):** desde el detalle, si la matrícula está «En proceso» o «Matriculado» sin pagos. Pide motivo (Se registró por error, Solicitud del apoderado, Otro motivo) y detalle, y explica qué ocurre al anular. Con pagos, el modal lo indica y no deja anular.

# Traslado (M-05, US19), retiro (M-18, US57) y ficha PDF (US20)

Capturas en `docs/figma/M-05-traslado-seccion.png` y `docs/figma/M-18-retirar-estudiante.png`. El Figma no tiene un frame de la ficha, solo el botón «Generar ficha de matrícula (PDF)» en AD-10.

- **Detalle de una matrícula «Matriculado»:** el pie suma «Generar ficha PDF», «Trasladar» y «Registrar retiro» junto a «Anular matrícula». Una «Retirado» solo ofrece la ficha (constancia). Debajo del cronograma aparece el «Historial de secciones» (sección, desde, hasta y motivo) cuando hubo traslado o retiro, y una alerta «Retirado el … · motivo» con el detalle.
- **M-05 Traslado de sección:** estudiante con su sección actual y aula, tarjetas de las otras secciones activas del mismo grado (aula, tutor, barra «26/30» y vacantes; las llenas con candado y sin poder elegirse), fecha efectiva (por defecto hoy, entre su ingreso a la sección actual y el fin del año), motivo opcional y el aviso de que el historial se conserva. Si no hay otra sección del grado, lo explica con «Solo se permite el traslado entre secciones del mismo grado». Los errores del backend («La sección destino no tiene vacantes disponibles») se muestran tal cual.
- **M-18 Retirar estudiante:** fecha de retiro (por defecto hoy, entre la fecha de matrícula y el fin del año), motivo (Traslado a otro colegio, Motivos económicos, Motivos de salud, Otro motivo), detalle opcional, tabla «Efecto en el cronograma de cobros» que se recalcula al cambiar la fecha («Se anula · pensión de diciembre 2026 (vence 05/12)» y «Se conservan» con su total) y «Se liberará 1 vacante en 3° B». Sin motivo: «Seleccione el motivo del retiro».
- **Ficha PDF:** «Generar ficha PDF» descarga `ficha-matricula-<año>-<id>.pdf`; si faltan datos, la alerta «No se puede generar la ficha: existen datos obligatorios pendientes» aparece en el detalle.

## Diferencias con el Figma (y por qué)

| En el Figma | En el código | Motivo |
|---|---|---|
| Sin montos del año en la pantalla | Barra «Montos 2026» con «Editar montos» y aviso si faltan | US21 exige los montos del año; se editan aquí (el encargo permitía AD-02 o matrícula) |
| Modalidad «Mensual (10 cuotas)» | «Mensual» y «Anual», con la nota de que generan las mismas cuotas | El Backlog no define un cronograma distinto para la modalidad anual |
| Solo las secciones del grado de ingreso | Selector de grado (por defecto, el de ingreso) | Un estudiante que vuelve otro año pasa a otro grado |
| «Matrículas recientes» del año | «Matrículas» con filtros de estado, grado y sección y paginación | El encargo pide filtros y búsqueda |
| Fila con imprimir, trasladar y menú «⋯» (M-23: Anular, Retirar) | «Ver» (detalle) y el lápiz para completar las «En proceso»; ficha, traslado, retiro y anulación desde el detalle | El encargo del bloque 4 pide las acciones en el detalle de una matrícula Matriculado |
| «Generar ficha de matrícula (PDF)» en el resumen al confirmar | En el detalle de la matrícula | Mismo motivo; tras confirmar, «Ver» abre el detalle con el botón |
| M-18: fecha de retiro «No puede ser posterior a hoy» | Hasta el fin del año académico | El encargo define el rango (de la fecha de matrícula al fin del año); el Backlog no lo limita |
| M-18: «Se conservan · 7 cuotas pagadas» y «setiembre vencida y octubre pendiente» en filas separadas | Una fila «Se conservan» con la cantidad y el total | La vista previa no conoce los pagos parciales (llegan con US22); el backend aplica la regla completa |
| M-05: «Las secciones de 4° … no están disponibles» como alerta fija | Solo se listan las secciones del mismo grado; la alerta aparece si no hay ninguna | Mostrar el error sin que el usuario haya intentado nada confunde |
| Sin historial de secciones en el detalle | «Historial de secciones» con fechas y motivo | US19 pide conservar el historial; así se ve el traslado |
| M-19: solo texto libre para el motivo | Motivo (MotivoAnulacion) más detalle | El encargo pide `MotivoAnulacion`; el detalle cubre el texto libre del frame |
| M-19: «Ir a Pensiones y pagos» y lista de operaciones confirmadas | Aviso con la cantidad de pagos | La pantalla de pagos es de US22 |
| Aviso de traslado con botón «Trasladar» en «Ya matriculado» | Aviso con la sugerencia, sin botón; el traslado se hace desde «Ver» en el listado | El traslado vive en el detalle de la matrícula |
| Menú lateral «Matrícula» bajo Comunidad | Igual, ahora habilitado | — |
