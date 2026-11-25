# Frontend · Mi tutoría: portal del tutor (bloque M3)

Bloque M3 (sprint 4). API: [api/horarios.md](api/horarios.md#tutoría-de-sección-bloque-m3),
[api/evaluacion.md](api/evaluacion.md#tutoría-conducta-y-notas-de-la-sección-bloque-m3) y
[api/academico.md](api/academico.md#tutor-y-cotutor-bloque-m3). Casos de prueba:
[pruebas/casos-sprint4-tutor.md](pruebas/casos-sprint4-tutor.md). Avance por fases: [progreso/M3.md](progreso/M3.md).
El Figma no tiene frames del tutor: las pantallas siguen el estilo de DO-03 (asistencia), DO-04 (notas) y AD-16.

## Archivos

```
src/components/admin/grados.tsx                    AD-03: selector «Cotutor (opcional)» junto al tutor
src/app/(portal)/coordinador/grados/page.tsx       tabla de secciones: el cotutor bajo el tutor
src/components/docente/PortalDocente.tsx           menú «Mi tutoría» solo si GET /academico/mi-tutoria trae una tutoría
src/components/docente/tutoria.tsx                 GuardiaTutoria (encabezado, pestañas y contexto), useMisTutorias
src/components/docente/tutoriaAsistencia.tsx       Inicio y Asistencia (clases del día, lista del tutor, justificar)
src/components/docente/asistencia.tsx              ListaAsistencia con modo tutor (motivo al modificar, «Justificar»)
src/components/docente/tutoriaReporte.tsx          Reporte de faltas y tardanzas (orden por columna, CSV y PDF)
src/components/docente/tutoriaConducta.tsx         Conducta por alumno y bimestre
src/components/docente/tutoriaNotas.tsx            Notas por alumno y Consolidado de la sección (CSV)
src/components/docente/tutoriaJustificaciones.tsx  Justificaciones de los apoderados: aprobar o rechazar
src/components/portal/notasDelAlumno.tsx           LibretaCompleta: la del coordinador (M2) y la del tutor, con conducta
src/components/portal/libreta.tsx                  TarjetaConducta en AP-04 y AL-03
src/components/apoderado/justificaciones.tsx       AP-03: «Justificar inasistencias» de los últimos 7 días
src/app/(portal)/docente/tutoria/…                 layout y una página por pestaña
```

## Pantallas

- **Menú.** «Mi tutoría» aparece al final del menú del docente solo si es tutor o cotutor de una sección del año en
  curso. Quien entra por URL sin tutoría ve «No tienes una tutoría este año»; la protección real es el 403 del servidor.
- **Encabezado y pestañas.** «Mi tutoría · 3° A», grado, año y si es tutor o cotutor. Pestañas: Inicio, Asistencia,
  Reporte de faltas, Conducta, Notas por alumno, Consolidado y Justificaciones (se desplazan en el celular).
- **Inicio.** Cuatro indicadores (alumnos, clases de hoy registradas, alumnos con faltas hoy y con aviso por umbral),
  las faltas de hoy por alumno y clase, y los alumnos con aviso (riesgo, aviso o alerta del mes). Si hay
  justificaciones pendientes, un aviso con el enlace para revisarlas.
- **Asistencia.** Fecha limitada al bimestre en curso y hasta hoy. Lista de las clases de la sección ese día con su
  docente y si ya tiene registro; «Registrar» o «Abrir» muestra la lista de DO-03 en modo tutor: si se cambian
  registros guardados aparece «Motivo de la modificación» (obligatorio) y cada falta o tardanza guardada tiene
  «Justificar falta/tardanza» (modal con motivo).
- **Reporte de faltas.** Selector de bimestre, tabla con encabezados que ordenan (flecha y `aria-sort`), fila de
  totales y botones CSV y PDF. En el celular la tabla se desplaza dentro de su tarjeta.
- **Conducta.** Selector de bimestre (marca los finalizados), resumen AD/A/B/C, por alumno un selector «Sin nota / AD
  / A / B / C» y un comentario de hasta 500 caracteres; con el periodo finalizado, solo lectura.
- **Notas por alumno.** Selector del alumno y la libreta completa del año con pestañas por bimestre, la conducta del
  bimestre y cada curso con «Publicado» o «Sin publicar · …».
- **Consolidado.** Matriz alumnos × cursos (código del curso; «Sin publicar» si aún no se publica) con la conducta,
  y al pie el resumen AD/A/B/C y «sin consolidado» por curso; la columna del alumno queda fija. Descarga CSV.
- **Justificaciones.** Pendientes con el alumno, la clase, el estado del registro, el motivo y el archivo adjunto
  («Ver archivo adjunto» lo abre en otra pestaña); «Aprobar» o «Rechazar» (modal con motivo). Debajo, las revisadas.
- **AP-03 · Justificar inasistencias.** Debajo del resumen del mes: faltas y tardanzas sin justificar de los últimos 7
  días con «Justificar» (motivo y constancia PDF/JPG opcional, validada también en el navegador) y las justificaciones
  enviadas con su estado y el motivo del rechazo.
- **AP-04 y AL-03.** Tarjeta «Conducta» con el valor y el comentario cuando el bimestre está publicado.
