# Frontend · Matrícula en sección (AD-10) y anulación (M-19)

# AD-10 · Matrícula en sección (US18, US21)

Pantalla `/admin/matricula`, según el frame **AD-10 · Matrícula en sección** de la página «1 · Prototipo escritorio - Propuesta» del Figma (captura en `docs/figma/AD-10-matricula-seccion.png`) y el modal **M-19 · Anular matrícula** (`docs/figma/M-19-anular-matricula.png`). Se llega con «Matrícula» del menú lateral (ya habilitado) y desde AD-09 con «Guardar y matricular», que abre la pantalla con el estudiante elegido (`?estudiante=<id>`).

## Archivos

```
src/app/(portal)/admin/matricula/page.tsx     AD-10: año, montos, nueva matrícula, resumen y listado
src/components/admin/matricula.tsx            Montos del año (barra y modal), tarjeta de sección, cronograma,
                                              modales de detalle y de anulación (M-19), filtros del listado
src/app/(portal)/admin/usuarios/registrar-estudiante/page.tsx   AD-09: «Guardar y matricular» y pasos 2 y 3
src/components/admin/PortalAdmin.tsx          «Matrícula» habilitado en el menú lateral
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

## Diferencias con el Figma (y por qué)

| En el Figma | En el código | Motivo |
|---|---|---|
| Sin montos del año en la pantalla | Barra «Montos 2026» con «Editar montos» y aviso si faltan | US21 exige los montos del año; se editan aquí (el encargo permitía AD-02 o matrícula) |
| Modalidad «Mensual (10 cuotas)» | «Mensual» y «Anual», con la nota de que generan las mismas cuotas | El Backlog no define un cronograma distinto para la modalidad anual |
| Solo las secciones del grado de ingreso | Selector de grado (por defecto, el de ingreso) | Un estudiante que vuelve otro año pasa a otro grado |
| «Matrículas recientes» del año | «Matrículas» con filtros de estado, grado y sección y paginación | El encargo pide filtros y búsqueda |
| Fila con imprimir, trasladar y menú «⋯» (M-23: Anular, Retirar) | «Ver» (detalle) y el lápiz para completar las «En proceso»; Anular desde el detalle | Ficha PDF (US20), traslado (US19) y retiro son de otros bloques |
| «Generar ficha de matrícula (PDF)» en el resumen | No está | US20, fuera de este bloque |
| M-19: solo texto libre para el motivo | Motivo (MotivoAnulacion) más detalle | El encargo pide `MotivoAnulacion`; el detalle cubre el texto libre del frame |
| M-19: «Ir a Pensiones y pagos» y lista de operaciones confirmadas | Aviso con la cantidad de pagos | La pantalla de pagos es de US22 |
| Aviso de traslado con botón «Trasladar» | Aviso con la sugerencia, sin botón | El traslado es del bloque 4 (US19) |
| Menú lateral «Matrícula» bajo Comunidad | Igual, ahora habilitado | — |
