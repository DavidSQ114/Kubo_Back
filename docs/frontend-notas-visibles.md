# Frontend · Publicación de notas (AD-15), libreta del apoderado (AP-04, AP-06) y «Mis notas» del alumno (AL-03)

Sprint 3, bloque 7 (US39 criterio 4, US46, US51, US26, US66). Frames de la página **«1 · Prototipo escritorio»** del Figma «Kubo – Prototipo», con capturas en `docs/figma/`: `AD-15-notas-y-rectificaciones.png` (frame `21:270`), `AP-04-libreta-de-notas-apoderado.png` (`29:290`), `AP-06-libreta-restringida-por-deuda.png` (`30:345`) y `AL-03-mis-notas-alumno.png` (`32:214`). API: [evaluacion.md](api/evaluacion.md). Casos de prueba: [pruebas/casos-sprint3-notas-visibles.md](pruebas/casos-sprint3-notas-visibles.md).

## Archivos

```
src/app/(portal)/admin/notas/page.tsx       AD-15: registros por publicar y publicados, «Ver», «Publicar» y
                                            «Publicar seleccionados» (US39)
src/app/(portal)/apoderado/notas/page.tsx   AP-04 y AP-06: libreta del hijo elegido, restricción por deuda y PDF
                                            (US46, US26, US66)
src/app/(portal)/alumno/notas/page.tsx      AL-03: «Mis notas» con el filtro «Periodo» y PDF (US51, US66)
src/app/(portal)/apoderado/horario/page.tsx AP-05: «Descargar PDF» del horario publicado (US66)
src/components/portal/libreta.tsx           Tipos de la API, pestañas por bimestre, tabla por curso y competencia,
                                            escala, resumen del bimestre y estados de carga y error
src/components/admin/PortalAdmin.tsx        «Notas y rectificaciones» deja de ser «Próximamente»
src/components/apoderado/PortalApoderado.tsx «Notas» deja de ser «Próximamente»
src/components/alumno/PortalAlumno.tsx      «Mis notas» deja de ser «Próximamente»
```

Las insignias de logro (`BadgeLogro`), la leyenda y la grilla de solo lectura se reutilizan de `components/docente/notas.tsx` (DO-04).

## AD-15 · Notas y rectificaciones (US39, criterio 4)

`/admin/notas`.

1. **Encabezado:** «Académico / Notas y rectificaciones», «Notas y rectificaciones» y «Revisa los registros consolidados por los docentes y publícalos para los apoderados y los alumnos.».
2. **Pestañas:** «Registros por publicar (N)» (registros `CERRADO`) y «Publicados (N)».
3. **Filtros:** «Año» (por defecto el que está en curso), «Bimestre» y «Grado»; a la derecha, «Publicar seleccionados (N)», deshabilitado sin selección.
4. **Tabla:** casilla (solo en «por publicar», con «Seleccionar todos» en la cabecera), «Curso y docente» («Matemática» y «J. Pérez · cerró el 20/07 a las 10:24»; en publicados, «publicó R. Huamán el …»), «Sección», «Bimestre», «Estudiantes», «Estado» («Cerrado» celeste o «Publicado» verde) y «Acciones» («Ver» y «Publicar»).
5. **Ver:** debajo de la tabla se abre el registro en solo lectura (la grilla de DO-04 con las notas de cada competencia y el consolidado de cada alumno), con la regla de consolidación usada y «Cerrar».
6. **Publicar:** modal «Publicar notas» con la lista de registros elegidos y «Al publicar, los apoderados y los alumnos verán las notas de estos registros y se avisará por correo a los apoderados vinculados. Las notas siguen sin poder modificarse.». Al confirmar: alerta verde «Notas publicadas.» con «Se publicó 1 registro… Se avisó por correo a 2 apoderados.» (o «a 1 de 2 apoderados; la publicación no se revirtió» si un correo falla) y el registro pasa a «Publicados».
7. **Errores:** si otro administrador publicó antes (`409 REGISTRO_YA_PUBLICADO`) o el registro se reabrió, se muestra el mensaje del servidor y la lista se vuelve a cargar.
8. **Vacío:** «No hay registros cerrados por publicar con estos filtros. Aparecen aquí cuando un docente cierra su registro del bimestre.».
9. **Nota inferior** (Figma): «Un registro «Cerrado» solo es visible para el docente y la administración hasta que lo publiques…».

## AP-04 · Libreta de notas del apoderado (US46)

`/apoderado/notas`, para el hijo elegido en la barra superior (al cambiar de hijo la página se vuelve a cargar).

1. **Encabezado:** «Libreta de notas», «Logros de Valeria por curso y competencia, según la evaluación por competencias.» y «Descargar libreta (PDF)» (deshabilitado si el bimestre no tiene cursos publicados).
2. **Pestañas por bimestre:** «Bimestre I», «Bimestre II · parcial», «Bimestre III · pendiente», «Bimestre IV». En el celular, «Bim. II». Se abre el último bimestre con algo publicado.
3. **Datos:** «Estudiante», «Grado y sección» («3° de secundaria · B»), «Tutor» y «Estado» («Publicado el 27/07/2026», «Publicado en parte el …» o «Pendiente de publicación»).
4. **Tabla «Curso y competencia | Logro | Detalle»:** una fila por curso con el docente y el logro consolidado, y debajo una fila por competencia con su logro. Un curso sin publicar muestra la insignia gris «Pendiente de publicación» y ninguna competencia. En el celular se oculta la columna «Detalle».
5. **Columna derecha:** «Escala de calificación» (AD Logro destacado, A Logro esperado, B En proceso, C En inicio) y «Resumen del bimestre» con los cursos por logro («AD · 2 cursos»).
6. **Nota inferior:** «Solo se muestran cursos cerrados por el docente y publicados por la administración. Los demás aparecen como «Pendiente de publicación».».
7. **PDF:** descarga `Libreta_BimestreII_2026_ValeriaQuispe.pdf`. Si el servidor no lo genera (deuda, sin publicar), se muestra su mensaje en una alerta roja.

## AP-06 · Libreta restringida por deuda (US26)

Con 2 o más pensiones vencidas el servidor no envía ninguna nota. Se ven las pestañas (solo los nombres) y una tarjeta con el candado, el mensaje del backlog «Existen pagos pendientes que impiden visualizar esta información. Por favor, regularice su situación con tesorería.», «El acceso a la libreta se restablecerá automáticamente cuando se registre el pago.», «Ver pagos pendientes» (lleva a «Pagos»), «Pensiones vencidas de Diego» con cada pensión («venció 05/08», «S/ 450.00», «Vencido») y «Total por regularizar». «Descargar libreta (PDF)» queda deshabilitado; si se pide el PDF directo por la API, responde `403 LIBRETA_RESTRINGIDA` con el mismo mensaje.

## AL-03 · Mis notas del alumno (US51)

`/alumno/notas`.

1. **Encabezado:** «Mis notas», «Tus logros por curso y competencia. Solo se muestran bimestres cerrados y publicados.» y «Descargar libreta».
2. **Filtro «Periodo»:** «Bimestre II · finalizado», «Bimestre III · en curso», «Bimestre IV · próximo». Los bimestres anteriores siguen disponibles (criterio 3). A la derecha, la leyenda AD/A/B/C.
3. **Tabla** (desde 1024 px): «Curso» con el docente, «Competencia 1…n» (al pasar el cursor se lee el nombre de la competencia) y «Logro del bimestre». Solo cursos publicados.
4. **Celular:** una tarjeta por curso con el logro del bimestre arriba y cada competencia con su nombre y su logro.
5. **Pendientes:** tarjeta «Bimestre III · en curso», «Cierra el 09/10/2026», insignia «Aún no publicado» (o «3 por publicar») y una pastilla por curso «Matemática · Aún no publicado», con «Tus calificaciones no se muestran hasta que el docente cierre el registro y la administración lo publique.».

## AP-05 · Descargar PDF del horario (US66)

Con el horario publicado aparece «Descargar PDF» junto al título; descarga `Horario_2026_Valeria.pdf` con la versión vigente. Sin horario publicado no se muestra el botón (y la API responde `422 HORARIO_NO_PUBLICADO`).

## Estados

Todas las pantallas resuelven cargando (spinner «Cargando las notas…»), error con «Reintentar», vacío («El año escolar aún no tiene bimestres», «Aún no hay cursos en este bimestre») y con datos. A 390 px no hay desplazamiento horizontal de la página en los portales del apoderado y del alumno; la tabla de AD-15 se desplaza dentro de su tarjeta (el portal del administrador no es responsivo, como el resto de sus pantallas).

## Diferencias con el Figma

- **Solicitudes de rectificación:** la pestaña «Solicitudes de rectificación (2)» y las tarjetas «Aprobar / Rechazar» de AD-15 son de US41, que no es de esta entrega. No se muestran.
- **Registros abiertos y «Recordar»:** AD-15 lista también registros «Abierto» con su avance y el botón «Recordar». Aquí solo se listan los cerrados y los publicados (lo que se puede revisar y publicar); el recordatorio al docente no está en el backlog de este bloque.
- **Ver:** en el Figma «Ver» solo aparece en los publicados; aquí también en los cerrados, para revisar el registro antes de publicarlo (US39, criterio 4: «el Administrador revisa un registro consolidado»). Se abre debajo de la tabla y no en un modal, porque la grilla es ancha.
- **Evidencias:** la columna «Evidencia del docente» («Ver evidencia», «Ver comentario») de AP-04 y «3 evidencias adjuntas por los docentes» del resumen son de US38 y US47, que no son de esta entrega.
- **Restricción por deuda:** el Figma de AP-06 marca «Bimestre III · pendiente» en las pestañas. Con deuda el servidor no envía el estado de publicación de los bimestres (para no exponer nada de la libreta), así que las pestañas muestran solo el nombre.
- **Barra lateral del apoderado:** el Figma la muestra azul con «Libreta de notas», «Trabajos» y «Horario»; el portal ya construido es claro (se hizo con la «Propuesta») y el ítem conserva el nombre «Notas». «Trabajos» es de aula virtual (US65).
- **Mis notas:** el Figma muestra, debajo de la tabla del bimestre elegido, la tarjeta del bimestre en curso. Aquí la tarjeta de pendientes es la del bimestre elegido en «Periodo»; para ver el bimestre en curso se elige en el filtro.
- **Restricción en «Mis notas»:** no se aplica al alumno (ver [evaluacion.md](api/evaluacion.md)): el backlog la define para el apoderado y AL-03 no la contempla.
