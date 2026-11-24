# Frontend · Evidencias pedagógicas (M-07 en DO-04, M-09 en AP-04 y AL-03)

Sprint 4, bloque 2 (US38, US47). Frames de la página **«1 · Prototipo escritorio»** del Figma «Kubo – Prototipo», con capturas en `docs/figma/`: `M-07-adjuntar-evidencia.png` (frame `35:51`, «Adjuntar evidencia pedagógica»), `M-09-evidencia-del-docente.png` (`35:166`, «Evidencia del docente»), `DO-04-registro-de-notas.png` (`25:366`, columna «Evidencia» y leyenda «Con evidencia»), `AP-04-libreta-de-notas-apoderado.png` (`29:290`, columna «Evidencia del docente») y `AL-03-mis-notas-alumno.png` (`32:214`). API: [evaluacion.md](api/evaluacion.md#evidencias-pedagógicas-us38-y-su-consulta-us47). Casos de prueba: [pruebas/casos-sprint4-evidencias.md](pruebas/casos-sprint4-evidencias.md). Almacenamiento: [DESPLIEGUE-AWS.md](DESPLIEGUE-AWS.md#archivos-evidencias-y-aula-virtual).

Los dos modales sí tienen frame en el Figma (M-07 y M-09), así que se siguieron; las diferencias están al final.

## Archivos

```
src/components/docente/evidencias.tsx    M-07 (modal del docente), tipos de la API, peso legible y abrir un archivo
src/components/docente/notas.tsx         DO-04: clip con el número de evidencias en la celda y columna «Evidencia»
src/app/(portal)/docente/notas/page.tsx  DO-04: abre M-07 y actualiza el registro sin perder notas sin guardar
src/components/portal/evidencias.tsx     M-09 (visor del apoderado y del alumno) y el enlace «Ver evidencia»
src/components/portal/libreta.tsx        AP-04: columna «Evidencia del docente» y «N evidencias adjuntas…»
src/app/(portal)/apoderado/notas/page.tsx AP-04: abre M-09
src/app/(portal)/alumno/notas/page.tsx   AL-03: la calificación con evidencia es un botón con un clip
src/lib/api.ts                           api() acepta FormData; obtenerArchivo, descargar y abrirEnPestana
public/figma/icon-clip.svg               paperclip de Lucide (como en el Figma), y también icon-subir,
public/figma/icon-imagen.svg             icon-imagen e icon-descargar, con el trazo de los demás íconos
```

## DO-04 · Registro de notas (US38)

1. **Celda:** una calificación con evidencias muestra a su lado un clip azul con el número («📎 2»). El clip abre M-07 con esa calificación. Sin evidencias no hay clip.
2. **Columna «Evidencia»** (en el celular, una fila «Evidencia» al pie de la tarjeta de cada alumno):
   - Registro **abierto** y el alumno con alguna calificación guardada: «📎 Adjuntar» y, debajo, «1 archivo» o «2 comentarios» si ya tiene. Abre M-07 con la lista de competencias calificadas del alumno.
   - Registro abierto sin calificaciones guardadas del alumno: «—» (la evidencia se asocia a una calificación).
   - Registro **cerrado o publicado**: el resumen («1 archivo», «1 comentario») abre M-07 en solo lectura; sin evidencias, «—».
3. Las evidencias se agregan en un registro **abierto** aunque el bimestre ya no sea el activo (la grilla de notas sigue en solo lectura con «Este periodo de evaluación no está activo.»).
4. Al guardar o eliminar una evidencia, la grilla se actualiza y aparece la alerta verde «Evidencia guardada para Quispe Rojas, Valeria en C1.» o «Se eliminó una evidencia de Quispe Rojas, Valeria.». Las notas escritas y aún no guardadas no se pierden.
5. A 1366 px la tabla con cuatro competencias y la columna nueva entra sin barra horizontal (el nombre de la competencia en la cabecera se recorta a 110 px con su título completo al pasar el cursor).

## M-07 · Adjuntar evidencia pedagógica

Modal con el ícono del clip, «Adjuntar evidencia pedagógica» y «Matemática 3° B · Bimestre IV». En solo lectura, «Evidencias de la calificación» y solo el botón «Cerrar».

1. Recuadro gris con el alumno, «C1 · Resuelve problemas de cantidad» y su logro.
2. **«Competencia calificada»** (solo si se abrió desde la columna «Evidencia»): las competencias con calificación guardada, «C2 · … (A)».
3. **Evidencias guardadas** de esa calificación: ícono de imagen, PDF o comentario; el nombre del archivo (abre el archivo en otra pestaña), el comentario, «21 KB · Guardada el 23/11 a las 09:06» y, con el registro abierto, el tacho para eliminar.
4. **«Comentario para el apoderado»**: hasta 1000 caracteres, con contador «90 / 1000».
5. **Zona de carga**: «Arrastra un archivo o selecciónalo» y «Formatos PDF o JPG · máximo 5 MB». Acepta arrastrar y soltar o elegir.
6. **Archivo elegido**: nombre, peso e insignia verde «Listo»; si la extensión no es .pdf, .jpg o .jpeg, si pesa 0 bytes o más de 5 MB, la tarjeta se pone roja con «Formato no permitido o archivo demasiado pesado (máx. 5 MB, formatos PDF/JPG)» y no se puede guardar. La «x» quita el archivo. Es una revisión previa: el servidor decide por el contenido real.
7. **«Guardar evidencia»** se habilita con un comentario o un archivo válido. Un rechazo del servidor (por ejemplo, un PDF falsificado) se muestra en una alerta roja dentro del modal con el mismo mensaje; el modal no se cierra.

## AP-04 · Libreta de notas del apoderado (US47)

1. La tercera columna pasa de «Detalle» a **«Evidencia del docente»**: en cada competencia, «🖼 Ver evidencia» si alguna evidencia trae archivo, «💬 Ver comentario» si solo hay comentarios, o «—». La fila del curso sigue con «Logro consolidado». En el celular esa columna no entra: el enlace aparece bajo el nombre de la competencia.
2. «Resumen del bimestre» agrega «2 evidencias adjuntas por los docentes.» cuando hay.
3. Con la restricción por deuda (AP-06) no llega ninguna nota ni evidencia.

## AL-03 · Mis notas del alumno (US47)

La insignia del logro de una competencia con evidencia lleva un pequeño clip en la esquina y es un botón («Resuelve problemas de cantidad: Logro destacado. Ver la evidencia del docente»). Sin evidencia la insignia no es clicable. Igual en la tabla de escritorio y en las tarjetas del celular.

## M-09 · Evidencia del docente

Modal con el ícono de imagen, «Evidencia del docente» y «Matemática · Resuelve problemas de cantidad».

1. «Logro» con su insignia y «Docente» (el del curso).
2. Por cada evidencia de la calificación:
   - **JPG:** la imagen en un **visor integrado** (fondo gris, sin descargarla). Se pide a la API con la sesión y se muestra desde la memoria del navegador; mientras carga, «Cargando la imagen…».
   - **PDF:** recuadro con el ícono, el nombre y **«Abrir PDF»**, que lo abre en otra pestaña con el visor del navegador.
   - «Fecha», «Archivo» («ficha_racionales.jpg · 20 KB»), «Comentario del docente» en un recuadro gris y **«Descargar»** si hay archivo.
3. Pie: **«Cerrar»**.

## Diferencias con el Figma

| Figma | Implementado | Motivo |
|---|---|---|
| M-07 lista dos archivos a la vez (uno «Listo» y otro rechazado) | Un archivo por evidencia; para varios archivos se guardan varias evidencias | Cada evidencia guarda un archivo (`archivo_clave`), como en el diagrama de clases. El caso de error del Figma se ve igual con el archivo rechazado |
| M-07 no muestra las evidencias ya guardadas ni cómo eliminarlas | Sección de evidencias guardadas con el tacho (solo con el registro abierto) | US38 pide que se puedan eliminar mientras el registro esté abierto |
| M-07 se abre siempre desde una celda | Desde la columna «Evidencia» se elige la competencia en «Competencia calificada» | La columna es por alumno y la evidencia es de una calificación |
| DO-04: «1 archivo» o «Comentario» en lugar de «Adjuntar» | «Adjuntar» con el resumen debajo mientras el registro esté abierto | Así se puede agregar otra evidencia al mismo alumno |
| DO-04: el clip va dentro de la insignia del logro, sin número | Clip con el número de evidencias junto a la celda | US38 pide «un ícono con el número de evidencias»; la celda editable es un campo de texto |
| M-09 es una sola evidencia con un ancho de 700 px | Lista todas las evidencias de la calificación en el modal común de 560 px | Una calificación puede tener varias; el modal de `components/ui` tiene un ancho fijo |
| AL-03 no muestra cómo se llega a la evidencia | Clip en la esquina de la insignia | US47 pide presionar la calificación; el clip indica cuáles tienen evidencia |
