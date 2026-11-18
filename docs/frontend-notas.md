# Frontend · Registro de notas del docente (DO-04) y cierre del bimestre (M-10)

Sprint 3, bloque 6 (US37, US39, US40). Frames de la página **«1 · Prototipo escritorio»** del Figma «Kubo – Prototipo», con capturas en `docs/figma/`: `DO-04-registro-de-notas.png` (frame `25:366`) y `M-10-cerrar-registro-del-bimestre.png` (frame `35:229`). API: [evaluacion.md](api/evaluacion.md). Casos de prueba: [pruebas/casos-sprint3-notas.md](pruebas/casos-sprint3-notas.md).

## Archivos

```
src/components/docente/notas.tsx            DO-04 y M-10: tipos de la API, escala de logros, celda editable, grilla,
                                            avance y modal de cierre
src/app/(portal)/docente/notas/page.tsx     DO-04: curso y sección, pestañas por bimestre, guardado y cierre (US37, US39, US40)
src/components/docente/PortalDocente.tsx    «Registro de notas» deja de ser «Próximamente»
src/app/(portal)/docente/page.tsx           DO-01: tarjeta de acceso «Registro de notas»
```

## DO-04 · Registro de notas (US37)

`/docente/notas`.

1. **Encabezado:** «Registro de notas» y «Año 2026 · Bimestre IV en curso» (o «ningún bimestre en curso hoy»).
2. **Curso y sección** (`GET /evaluacion/registros`): lista desplegable con los cursos y secciones del docente («Matemática · 3° B»), solo los suyos. Debajo, una **pestaña por bimestre** con su estado para ese curso: «Bimestre III · activo», «Bimestre II · cerrado», «Bimestre IV · no activo». En el celular las pestañas dicen «Bim. III · activo». Se abre por defecto el bimestre activo (si no hay, el último que ya empezó).
3. **Registro** (`GET …/bimestres/{periodoId}`): «Matemática 3° B», «Bimestre III (10/08 – 09/10/2026) · Califica cada competencia solo con la escala AD, A, B o C.», la regla de consolidación que rige («Moda de los logros · versión 1») y, a la derecha, «Cerrar registro del bimestre».
4. **Leyenda:** AD Logro destacado, A Logro esperado, B En proceso, C En inicio, con sus colores (verde, celeste, ámbar y rojo).
5. **Grilla** (desde 1024 px): «Estudiante», una columna por competencia («C1» con el nombre abreviado debajo y el completo al pasar el cursor) y «Consolidado». Cada celda es un campo: se escribe el logro (las minúsculas pasan a mayúsculas) o se elige de la lista que se abre al enfocarla, con «AD Logro destacado», «A Logro esperado», «B En proceso» y «C En inicio», como en el Figma. Las celdas con cambios sin guardar se ven subrayadas. Al pasar el cursor sobre una nota guardada se lee quién la registró y, si se cambió, el valor anterior («Registrada por J. Pérez el …; cambiada de AD a B por J. Pérez el …»).
6. **Consolidado:** insignia «Incompleto» (ámbar) mientras falte alguna competencia; con todas, el logro que resultaría al cerrar con la regla del bimestre (vista previa calculada en el servidor).
7. **Pie:** «Avance del registro: 72 %» con su barra y «3 estudiantes con competencias pendientes»; a la derecha, «Guardar cambios» (deshabilitado si no hay cambios). Se puede guardar una parte y volver luego: «Notas guardadas.» con «2 notas nuevas y 1 cambio. Puedes volver luego para completar el registro.».
8. **Valor no permitido:** si una celda tiene otra cosa («15», «D»…), al guardar aparece la alerta roja «Solo se permiten los valores AD, A, B o C» con «Se rechazó el valor «15» ingresado para Castillo Ramos, Bruno en C2. El registro no se guardó.», la celda y la fila se resaltan en rojo y no se envía nada. El servidor valida lo mismo con Zod.
9. **Bimestre no activo:** alerta ámbar «Este periodo de evaluación no está activo.» con «El registro se muestra en solo lectura…». Las celdas son insignias de solo lectura y no hay «Guardar cambios» ni «Cerrar registro del bimestre».
10. **Celular** (menos de 1024 px): cada alumno es una tarjeta con su nombre y su consolidado arriba y una celda por competencia («C1 · Cantidad») en dos columnas (tres desde 640 px). La lista de logros se alinea a la derecha de la celda para no salirse de la pantalla. No hay desplazamiento horizontal de la página a 390 px.
11. **Estados:** cargando (spinner), error con «Reintentar», sin cursos («Aún no tienes cursos asignados.») y sección sin alumnos («No hay estudiantes con matrícula vigente en esta sección.»).

## M-10 · Cerrar registro del bimestre (US39)

Modal con el ícono de candado, «Cerrar registro del bimestre» y «Matemática 3° B · Bimestre III».

- **Incompleto:** alerta «Existen registros de notas incompletos» con «Completa estas calificaciones para poder cerrar el registro.» y una fila por alumno con sus competencias faltantes («Quispe Rojas, Valeria · C4 · sin calificar»). «Cerrar registro» queda deshabilitado. Si el servidor responde `NOTAS_INCOMPLETAS` (otra pestaña, por ejemplo), la lista se llena con sus `details.pendientes`.
- **Cambios sin guardar:** aviso «Tienes cambios sin guardar · Guarda tus cambios antes de cerrar el registro.» y el botón deshabilitado.
- **Completo:** solo el recuadro «Al cerrar el registro:» con «Se calcula el logro consolidado con la regla vigente (moda de los logros, versión 1).», «El estado cambia a «Cerrado» y ya no podrás editar las notas.» y «Se notifica a la administración para que publique las notas a los apoderados.». Botones «Volver al registro» y «Cerrar registro».
- **Al cerrar** (`POST …/cerrar`): se cierra el modal, alerta verde «Registro cerrado.» con «Se calculó el logro consolidado de 8 estudiantes con la regla vigente. Se avisó por correo a 1 de 1 administrador.» (o que el correo no salió, sin revertir el cierre), la columna «Consolidado» muestra el logro guardado de cada alumno y la pestaña pasa a «cerrado».

## Registro cerrado (US40)

- Insignia «Cerrado» junto al título, celdas de solo lectura y alerta azul «Este registro está cerrado y no puede modificarse directamente.» con «Registro cerrado el 17/11 a las 22:57 por J. Pérez. Si necesitas corregir una nota, solicítalo al Administrador por el canal de soporte institucional.».
- Si una escritura choca con un cierre hecho en otra pestaña (`409 REGISTRO_CERRADO`), se muestra el mensaje y el registro se vuelve a cargar en solo lectura.

## Diferencias con el Figma

- **Pestañas:** el Figma muestra el bimestre activo y, debajo, el bimestre anterior cerrado. Aquí cada bimestre se ve en su pestaña (el Figma ya las tiene); el anterior no se repite debajo para no duplicar la grilla.
- **Evidencia:** la columna «Evidencia» («Adjuntar», «1 archivo», «Comentario») y el ícono de evidencia en la leyenda son de US38, que no es de esta entrega. No se muestran.
- **Solicitar rectificación:** el botón del registro cerrado es de US41 (Could), que no está en esta entrega. En su lugar, el mensaje indica que la corrección se pide al Administrador por el canal de soporte institucional (US40, criterio 3).
- **Valor no válido en el modal:** el Figma lista «C2 · valor no válido». Aquí un valor no válido no llega a guardarse (se rechaza al pulsar «Guardar cambios»), así que el modal solo lista competencias «sin calificar» de lo guardado y avisa si hay cambios sin guardar.
- **Encabezado:** el título del Figma es «Registro de notas · Matemática 3° B» en una línea; aquí «Registro de notas» es el título de la página y «Matemática 3° B», el de la sección, para que el selector de curso quede antes de la grilla y el título no cambie al elegir otro curso.
- **Barra lateral:** el menú del Figma incluye «Mis cursos», que es del módulo de aula virtual (DO-05) y aún no existe; no se agregó.
