# Frontend · Solicitud de rectificación (M-08, DO-04), bandeja de AD-15 y bitácora de notas (AD-16)

Sprint 3, bloque 8 (US41, US03). Frames de la página **«1 · Prototipo escritorio»** del Figma «Kubo – Prototipo», con capturas en `docs/figma/`: `M-08-solicitud-de-rectificacion.png` (frame `35:116`), `DO-04-registro-de-notas.png` (`25:366`, botón «Solicitar rectificación» del registro cerrado), `AD-15-notas-y-rectificaciones.png` (`21:270`, tarjetas de solicitudes) y `AD-16-auditoria.png` (`22:282`, tabla «Cambios de notas»). API: [evaluacion.md](api/evaluacion.md). Casos de prueba: [pruebas/casos-sprint3-rectificacion.md](pruebas/casos-sprint3-rectificacion.md). Decisión de diseño: [arquitectura/AD-16-bitacora-notas.md](arquitectura/AD-16-bitacora-notas.md).

## Archivos

```
src/components/docente/rectificaciones.tsx  M-08 (modal del docente), «Mis solicitudes de rectificación» y piezas
                                             que comparte la bandeja: estado de la solicitud y el cambio «B › A»
src/app/(portal)/docente/notas/page.tsx      DO-04: «Solicitar rectificación» en el registro cerrado o publicado
src/components/admin/rectificaciones.tsx     AD-15: bandeja «Solicitudes de rectificación» (aprobar o rechazar)
src/app/(portal)/admin/notas/page.tsx        AD-15: pestaña nueva con el número de pendientes
src/components/admin/bitacoraNotas.tsx       AD-16: «Cambios de notas» con filtros, tabla y paginación
src/app/(portal)/admin/auditoria/page.tsx    AD-16: pestañas «Cambios de notas» y «Errores del sistema»
public/figma/icon-comentario.svg             Ícono de M-08 y del botón (message-square de Lucide, como en el Figma)
```

## DO-04 · Registro cerrado (US40, US41)

1. La alerta azul del registro `CERRADO` o `PUBLICADO` dice «Este registro está cerrado y no puede modificarse directamente.» con «Registro cerrado el … por J. Pérez. Si detectas un error, envía una solicitud de rectificación a la coordinación académica.» y el botón **«Solicitar rectificación»** (se oculta si el registro no tiene alumnos).
2. Debajo de la grilla, **«Mis solicitudes de rectificación»** del registro que se está viendo, de la más reciente a la más antigua: «Ortiz Vela, Camila · C1», «Enviada el 18/11 a las 07:18 · motivo», el cambio «B › A» y la insignia «Pendiente de aprobación» (ámbar), «Aprobada» (verde, con «Resuelta el …») o «Rechazada» (roja, con «Motivo del rechazo: …»). Sin solicitudes, la sección no aparece. Si no carga, alerta roja con «Reintentar».

## M-08 · Solicitud de rectificación de nota

Modal con el ícono de comentario, «Solicitud de rectificación de nota» y «Bimestre IV · Matemática 3° B · registro cerrado» (o «registro publicado»).

1. **Estudiante \*** y **Competencia \*** (C1 · nombre, C2 · nombre…): listas del registro.
2. Recuadro gris con **«Logro registrado»** (el valor actual de esa nota) › **«Valor correcto \*»** con AD, A, B y C. El valor registrado queda deshabilitado (debe ser distinto) y el elegido, con borde azul.
3. **«Motivo del error \*»**: obligatorio, hasta 500 caracteres.
4. Alerta azul «La solicitud quedará «Pendiente de aprobación» y se notificará a la administración. Te avisaremos si se aprueba o rechaza.».
5. Si esa nota ya tiene una solicitud pendiente, alerta ámbar «Esta nota ya tiene una solicitud pendiente de aprobación» y no se puede enviar (el servidor también lo rechaza con `409 RECTIFICACION_PENDIENTE`).
6. **«Enviar solicitud»** se habilita con estudiante, competencia, valor distinto y motivo. Al enviar: se cierra el modal, alerta verde «Solicitud de rectificación enviada.» con «La nota de Quispe Rojas, Valeria en C2 quedó «Pendiente de aprobación». Se avisó por correo a 2 de 2 administradores.» (o que el correo no salió y la solicitud quedó registrada) y la solicitud aparece en la lista. Un error del servidor se muestra dentro del modal.

## AD-15 · Pestaña «Solicitudes de rectificación (N)»

`/admin/notas`, entre «Registros por publicar» y «Publicados». N es el número de pendientes.

1. Botones **«Pendientes (N)»** y **«Resueltas»**. Pendientes, de la más antigua a la más reciente; resueltas, de la más reciente a la más antigua. Diez por página con «Anterior» y «Siguiente».
2. **Tarjeta pendiente** (borde ámbar): iniciales y nombre del docente, «Matemática 3° B · Bimestre IV · 18/11/2026», insignia «Pendiente de aprobación», «Estudiante», «Registro» («Cerrado» o «Publicado»), «Competencia» («C1 · Resuelve problemas de cantidad»), «Cambio solicitado» B › A, «Motivo», **«Comentario (obligatorio si rechazas)»**, «Rechazar» (rojo) y «Aprobar» (verde), y «Al aprobar, la nota se actualiza y se registra en la bitácora como «Rectificación aprobada».».
3. **Rechazar** sin comentario marca el campo en rojo con «Escribe el motivo del rechazo.». Con comentario: alerta verde «Solicitud rechazada.» con «La nota de Ortiz Vela, Camila en C1 no cambió. Se avisó por correo al docente.».
4. **Aprobar** abre «Aprobar rectificación» con el estudiante, la competencia, el cambio y «La nota se actualiza al valor solicitado, se recalcula el logro del curso del estudiante con la regla usada al cerrar el registro y el cambio queda en la bitácora de notas como «Rectificación aprobada».» (más «El registro ya está publicado: el apoderado y el alumno verán el valor corregido.» si corresponde). Al confirmar: «Rectificación aprobada.» con «La nota de … cambió de A a AD y quedó en la bitácora de notas. Logro del curso: AD → AD. Se avisó por correo al docente.».
5. **Solicitud propia** (usuario con perfil de Docente y de Administrador): alerta ámbar «Es tu propia solicitud · La pediste con tu perfil de Docente: otro administrador debe aprobarla o rechazarla.» y sin botones.
6. **Tarjeta resuelta** (borde gris): insignia «Aprobada» o «Rechazada», el motivo del rechazo y «Aprobó / Resolvió Rosa Huamán Torres el 18/11 a las 07:24».
7. Si otro administrador la resolvió antes (`409 SOLICITUD_YA_RESUELTA`) o la nota cambió (`409 NOTA_CAMBIO`), alerta roja con el mensaje y la bandeja se vuelve a cargar.
8. **Vacío:** «No hay solicitudes de rectificación pendientes. Aparecen aquí cuando un docente pide corregir una nota de un registro cerrado.» / «Aún no hay solicitudes de rectificación resueltas.».

## AD-16 · Auditoría · «Cambios de notas»

`/admin/auditoria`. Encabezado «Seguridad / Auditoría», «Auditoría y registros del sistema» y «Bitácoras de solo lectura para cambios de notas y errores técnicos. Los registros son inmutables.». Pestañas **«Cambios de notas»** (se abre esta) y **«Errores del sistema»** (el log de errores de US05, sin cambios).

1. **Filtros:** «Desde», «Hasta», «Docente» («Todos los docentes» y los docentes con cambios en la bitácora) y «Aplicar filtros»; a la derecha, «Solo lectura». Se aplican al pulsar el botón y se cumplen todos a la vez. «Desde» posterior a «Hasta»: alerta roja «La fecha «Desde» no puede ser posterior a la fecha «Hasta».» (el servidor también lo rechaza).
2. «23 registros · del más reciente al más antiguo».
3. **Tabla:** «Fecha y hora» (Lima), «Docente» (en una rectificación, debajo «aprobó Rosa Huamán Torres»), «Curso» (con «3° B · Bimestre IV 2026»), «Estudiante», «Comp.» (C1…; al pasar el cursor, el nombre), «Valor anterior → nuevo» (insignias; «—» en el primer registro) y «Origen» («Registro docente» gris o «Rectificación aprobada» azul). Veinte por página con «Anterior» y «Siguiente». La tabla se desplaza dentro de su tarjeta.
4. **Vacío:** «Aún no hay cambios de notas. Aparecen aquí cuando un docente registra o cambia una nota.» o, con filtros, «No hay cambios de notas con estos filtros. Prueba con otro rango de fechas u otro docente.».
5. Debajo de las dos pestañas, alerta azul **«Registros inmutables»**: «Ningún usuario puede editar ni eliminar entradas de la bitácora. Cualquier intento de modificación directa es rechazado por el sistema.» y dónde está el log de pagos.

## Estados

Las tres pantallas resuelven cargando (spinner), error con «Reintentar», vacío y con datos. Revisadas a 1366 px y a 390 px: a 390 px DO-04 y M-08 no tienen desplazamiento horizontal (el modal ocupa 358 px). El portal del administrador (AD-15 y AD-16) no es responsivo, como el resto de sus pantallas: la barra lateral es fija y a 390 px la página mide unos 650 px; las tablas se desplazan dentro de su tarjeta.

## Diferencias con el Figma

- **Bandeja de AD-15:** en el Figma las tarjetas de solicitudes están en una columna a la derecha de la tabla de registros por publicar. Aquí están en la pestaña «Solicitudes de rectificación (N)» que el mismo Figma dibuja, en dos columnas desde 1280 px, con «Pendientes» y «Resueltas» para no mezclar las que esperan acción con el historial.
- **Tarjeta pendiente compacta:** el Figma muestra la segunda solicitud pendiente reducida («Sebastián Rivas · C1 C › B»). Aquí todas las pendientes muestran el detalle completo y el comentario, porque cualquiera se puede atender.
- **Confirmación al aprobar:** el Figma aprueba con un clic; el backlog dice «cuando confirma la acción», así que «Aprobar» abre un modal de confirmación. El rechazo se confirma con el comentario obligatorio.
- **Campo «Registro»** en la tarjeta (Cerrado o Publicado): no está en el Figma; se agregó porque aprobar sobre un registro publicado cambia lo que ven el apoderado y el alumno.
- **Motivo obligatorio en M-08:** el Figma no marca «Motivo del error» con asterisco; el backlog lo pide obligatorio y se marca con «\*».
- **Valor registrado deshabilitado** entre los valores correctos de M-08: el backlog pide un valor distinto del actual; el Figma no lo indica.
- **«Mis solicitudes de rectificación»** en DO-04 no está en el Figma; la pide el encargo («el docente ve sus solicitudes y su estado»). Se muestran solo las del registro elegido.
- **AD-16:** el Figma tiene la pestaña «Operaciones de pago»; el log de pagos ya existe por estudiante en «Pensiones y pagos» (US04) y no se duplicó. La fila «Evidencia agregada» del Figma es de US38 (evidencias), que no es de esta entrega. El Figma muestra el log de errores debajo de la tabla de notas; aquí cada bitácora está en su pestaña. El docente se muestra con el nombre completo («Juan Pérez Salazar») y no abreviado («J. Pérez»): la bitácora guarda el nombre completo y no separa nombres de apellidos.
- **Filtro «Docente»:** lista los docentes que tienen cambios en la bitácora (también los dados de baja), no todos los docentes activos.
- **Ícono:** el de comentario (`icon-comentario.svg`) no estaba exportado en `public/figma`; se dibujó con el trazo de Lucide «message-square» que usa el Figma.
