# Frontend · Portal del apoderado: selección de hijo (AC-05), inicio (AP-01) y pagos (AP-02)

Primera vista que no es del Administrador (US42, US43, US44). Frames de la página «1 · Prototipo escritorio - Propuesta» del Figma, secciones «Acceso» y «Apoderado», con capturas en `docs/figma/AC-05-seleccion-estudiante.png`, `docs/figma/AP-01-inicio-apoderado.png` y `docs/figma/AP-02-pagos-apoderado.png`. API: [matricula.md](api/matricula.md#portal-del-apoderado-us42-us43-us44).

El portal es de **solo lectura**. Reutiliza el login y la elección de perfil (US53), los vínculos de US15, el cronograma de US21 y el recibo de US25.

## Archivos

```
src/app/(portal)/apoderado/layout.tsx        Envuelve las páginas con PortalApoderado
src/app/(portal)/apoderado/page.tsx          AP-01: saludo, aviso de vencidas, próximo vencimiento
src/app/(portal)/apoderado/pagos/page.tsx    AP-02: resumen, cronograma, comprobantes, «¿Cómo pagar?»
src/components/apoderado/PortalApoderado.tsx Guardia del rol, AC-05, barra lateral y barra superior, useHijo()
src/components/apoderado/pagos.tsx           Datos del cronograma, resumen, tabla, botón del comprobante, avisos
src/lib/api.ts                               inicioPorRol: el Apoderado entra a /apoderado
src/lib/formato.ts                           soles() (antes en components/admin/matricula) y fechaLarga()
public/figma/nav-*-gris.svg, nav-*-azul.svg  Íconos del menú para la barra lateral clara
```

## Flujo (US42)

1. El apoderado inicia sesión. Si además tiene otro perfil, elige «Apoderado» en AC-08 (US53). `inicioPorRol("APODERADO")` lleva a `/apoderado`.
2. `PortalApoderado` exige sesión con perfil `APODERADO` (si no, `/acceso-denegado`) y pide `GET /matricula/apoderado/hijos`:
   - **Sin hijos matriculados:** tarjeta «Aún no tienes estudiantes matriculados vinculados a tu cuenta», con qué hacer, los otros perfiles y «Cerrar sesión». Nunca una pantalla vacía.
   - **Un hijo:** entra directo a su panel.
   - **Dos o más sin elegir:** AC-05 «¿A quién deseas consultar?» con nombre, grado y sección, pensiones vencidas y estado de la matrícula de cada uno.
3. «Ver panel del estudiante» llama a `PUT /matricula/apoderado/hijo-elegido`. El servidor guarda la elección en una cookie httpOnly firmada, así que se mantiene al navegar y al recargar.
4. «Cambiar de hijo» en la barra superior (solo con dos o más hijos) vuelve a AC-05, con «Volver al panel».
5. Al cambiar de hijo, el contenido se monta de nuevo (`key` = id del estudiante) y vuelve a pedir sus datos.

El frontend solo oculta. Cada consulta lleva el id del hijo en la URL y el servidor verifica el vínculo (403 si no es suyo).

## AP-01 · Inicio

- «Hola, Carmen» y «Así va Valeria al viernes 6 de noviembre de 2026.».
- Con cuotas vencidas: aviso rojo «Tienes 1 pensión vencida» con la pensión, el monto y la fecha (o «Tienes 2 pensiones vencidas» con el total), y «Ver mis pagos».
- Al día: «Estás al día con tus pagos».
- Tarjeta «Próximo vencimiento» (fecha, concepto y monto) y una tarjeta que avisa que notas, asistencia y horario llegarán después.

## AP-02 · Pagos (US43, US44)

- **Resumen:** «Pagado» (Matrícula + N de M pensiones), «Vencido» (meses y primer vencimiento) y «Pendiente» (meses y cantidad).
- **Estás al día con tus pagos:** se muestra cuando no hay pendientes ni vencidas; la tabla sigue visible para descargar los comprobantes.
- **Cronograma:** concepto, vencimiento, monto, estado («Pagado», «Pendiente», «Vencido»), fecha de pago y «PDF».
  - Las filas «Vencido» van resaltadas en rojo y en negrita.
  - Un pago Observado no cuenta como pagado: la cuota sigue «Pendiente» o «Vencido» con la nota «Pago en revisión».
  - Filtro «Todos los estados / Pagado / Pendiente / Vencido».
  - Sin cuotas: «Aún no hay cuotas generadas para esta matrícula…».
- **Comprobante:** el botón «PDF» solo está habilitado en cuotas «Pagado». Descarga `Recibo_<Mes><Año>_<NombreApellido>.pdf` con el nombre que envía el servidor. Si falla, el mensaje aparece bajo el botón.
- **Cuotas anuladas:** «Ver cuotas anuladas (n)» las muestra atenuadas y tachadas.
- **Año:** si el hijo tiene matrícula en dos años abiertos, aparece un selector «Año académico».
- **¿Cómo pagar?:** código del estudiante (su DNI) y la nota del pago adelantado del año (US58).
- **Estados:** spinner al cargar, alerta con «Reintentar» si falla, vacío explicado y datos.

## Diferencias con el Figma (y por qué)

| En el Figma | En el código | Motivo |
|---|---|---|
| Menú: Inicio, Pagos, Asistencia, Libreta de notas, Trabajos, Horario | Inicio, Pagos y, deshabilitados con «Próximamente», Notas, Asistencia y Horario | Lo pide el encargo del bloque 7: solo hay pagos en este sprint |
| «Cambiar estudiante» en la barra superior | «Cambiar de hijo» | Texto pedido en el encargo; el Backlog solo pide «un menú de cambio de perfil» |
| AC-05: filas de asistencia del mes y libreta del bimestre | Filas «Pensiones» (vencidas o «Al día») y «Matrícula 2026» (estado) | Asistencia y notas aún no existen; no se muestran datos inventados |
| AP-01: clases de hoy, libreta, asistencia del mes y tarjetas de resumen | Aviso de vencidas, «Estás al día», «Próximo vencimiento» y una tarjeta «Próximamente» | Solo hay datos de pagos; el resto llega con sus módulos |
| Insignia «Año 2026 · Bimestre III en curso» y campana de notificaciones | Insignia «Año 2026» del año de la matrícula; sin campana | La insignia del bimestre vive en el portal del administrador; las notificaciones (M-13) no son de este bloque |
| Resumen: «Pagado», «Vencido», «Por pagar» | «Pagado», «Vencido», «Pendiente» | El encargo y el Backlog usan «Pendiente» |
| «Estás al día con tus pagos» en una tarjeta lateral de ejemplo («Cuando no hay deuda») | Tarjeta en el cuerpo, solo cuando no hay pendientes ni vencidas | Es el estado que pide US43, no un ejemplo |
| Nombre de ejemplo «Recibo_Agosto2026_ValeriaQuispe.pdf» | El mismo formato; la matrícula usa «Matricula» y el pago anual, «Anual» | US44 y el encargo |
| Concepto «Pensión marzo» | «Pensión de marzo 2026» | Es el concepto que guarda el cronograma de US21 |
| Barra lateral de 240 px | 256 px | Con la etiqueta «Próximamente» el texto no entraba en 240 px |
| Sin estado del vínculo «Retirado» | Insignia «Retirado» en la barra superior y en AC-05 | El encargo pide mostrar también al hijo retirado del año en curso |

## Pendiente

- Notas, asistencia, horario y trabajos del apoderado (sus módulos aún no existen); la restricción de libreta por deuda (US26, AP-06) depende de ellos.
- Notificaciones del apoderado (M-13) y el menú de usuario (M-22).
- Vista móvil del portal (página «2 · Prototipo móvil - Propuesta»).
