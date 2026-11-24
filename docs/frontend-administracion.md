# Frontend · Administración (AD-14, AD-04 «Catálogo oficial», AD-06 vínculos, AP-01 y AL-01)

Sprint 4, bloque 4 (US32, US56, D-12, D-13). Frames de la página **«1 · Prototipo escritorio»** del Figma «Kubo – Prototipo», con capturas en `docs/figma/`: `AD-14-asistencia-docente.png` (frame `20:719`) y `AD-04-cursos-competencias.png`. API: [api/horarios.md](api/horarios.md#asistencia-del-personal-docente-us32), [api/academico.md](api/academico.md#catálogo-oficial-de-competencias-us56) y [api/comunidad.md](api/comunidad.md#vínculos-de-una-persona-d-12-pantalla-ad-06). Casos de prueba: [pruebas/casos-sprint4-administracion.md](pruebas/casos-sprint4-administracion.md).

## Archivos

```
src/app/(portal)/admin/asistencia-docente/page.tsx  AD-14: contadores, filtros, tabla del día y acciones
src/components/admin/asistenciaDocente.tsx          pestañas de asistencia, insignias, indicadores y modal «Justificar»
src/app/(portal)/admin/asistencia/page.tsx          «Asistencia de alumnos» ahora con las pestañas de AD-14
src/components/admin/PortalAdmin.tsx                menú «Asistencia docente» habilitado
src/components/admin/catalogoCompetencias.tsx       AD-04 «Catálogo oficial»: registrar, editar, desactivar y eliminar
src/app/(portal)/admin/cursos/page.tsx              recarga las áreas de la malla tras un cambio en el catálogo
src/components/admin/personas.tsx                   D-12: apoderados e hijos en el detalle de la persona
src/app/(portal)/admin/usuarios/page.tsx            abre el detalle de la persona vinculada
src/app/(portal)/apoderado/page.tsx                 D-13: tarjeta «Notas» y botón «Pagar»
src/components/apoderado/pagos.tsx                  D-13: el aviso de vencidas menciona el pago en línea
src/app/(portal)/alumno/page.tsx                    D-13: «Mis notas» con enlace; sin «Próximamente»
```

## AD-14 · Asistencia del personal docente (US32)

1. Pestañas «Asistencia docente | Asistencia de alumnos» (cada una es su propia ruta).
2. Cuatro indicadores: **Puntuales** «n / total» con el porcentaje del personal y las tardanzas; **Sin marcar** con «Se marcarán como inasistencia a las 08:00» (antes de la hora límite); **Faltas** con cuántas tienen justificación; **Hora actual** con los minutos que faltan para la hora límite. En una fecha pasada, la última tarjeta muestra la fecha consultada.
3. Filtros: fecha (hasta hoy), la etiqueta «Solo se registra el día actual», buscar docente y «Estado: todos / Puntual / Tardanza / Sin marcar / Inasistencia / Falta justificada».
4. Tabla: docente (iniciales, nombre y especialidad), primera clase del día en el horario publicado, hora de ingreso, hora de salida, estado y acción. Acciones: «Marcar “Asistió”» (verde) sin registro o con inasistencia; «✓ Registrado 07:31» y «Salida» tras el ingreso; «Justificar» en una inasistencia. La fila con inasistencia se resalta en rojo claro y dice «Verificación automática» si la marcó el sistema.
5. Rechazos en una alerta roja sobre la tabla. Con otra fecha: «Solo se puede registrar la asistencia del día actual» y «Se intentó registrar el dd/mm/aaaa. Las correcciones de días anteriores…», como en el Figma.

## AD-04 · Catálogo oficial (US56)

Antes era de solo lectura. Ahora cada área lista sus competencias con código, nombre, descripción, uso («2 planes · 318 notas» o «Sin planes de estudios») y las acciones «Editar», «Desactivar»/«Activar» y «Eliminar». A la derecha, «Registrar nueva competencia» (área, código, nombre y descripción). Eliminar abre una confirmación; si la competencia está en uso, el servidor lo impide y el modal ofrece «Desactivar en su lugar».

## AD-06 · Vínculos de la persona (D-12)

En el detalle (modal de «Ver detalle»), antes del historial: «Apoderados» de un estudiante (parentesco, «Principal», «Responsable del pago») e «Hijos (estudiantes vinculados)» de un apoderado (sección y estado de su matrícula más reciente, o «Sin matrícula»). Cada nombre abre el detalle de esa persona en el mismo modal.

## AP-01 y AL-01 (D-13)

- Apoderado: la tarjeta «Próximamente en tu portal» pasa a ser «Notas · Ver la libreta de …». Con pensiones vencidas y el pago en línea activo, el aviso dice «Puedes pagar en línea con «Pagar»…» y su botón es «Pagar» (lleva a Pagos, donde está el botón del Figma AP-02).
- Alumno: «Mis notas» enlaza a `/alumno/notas`. «Notificaciones» no tiene pantalla propia: la tarjeta explica que se abren con la campana de la barra superior. Ya no queda ningún «Próximamente» en los portales.

## Diferencias con el Figma

- **AD-14 «Reporte mensual»** no se implementó (no está en los criterios de US32); queda pendiente.
- AD-14 agrega la acción **«Salida»** y el estado **«Falta justificada»**, que el Figma no dibuja pero pide el encargo; la insignia de la falta dice «Inasistencia» (palabra del backlog) en vez de «Falta». La tardanza va en celeste para distinguirla de «Sin marcar» (ámbar).
- AD-14 en el menú: el Figma tiene solo «Asistencia docente» con las dos pestañas; se mantuvo además «Asistencia de alumnos» en el menú, que ya existía.
- AD-04 «Catálogo oficial» no tiene frame propio: sigue el estilo de las tarjetas de la malla y de los modales M-04.
- El portal del administrador no es responsivo (en 390 px la página se desplaza de lado, como el resto del portal); los portales del apoderado y del alumno sí.
