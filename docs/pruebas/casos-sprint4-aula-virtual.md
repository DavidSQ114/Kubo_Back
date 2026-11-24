# Casos de prueba · Sprint 4, bloque 3: aula virtual (US61, US62, US67)

Pantallas DO-05 «Aula virtual» del docente con M-16 «Subir material de estudio» y M-17 «Agregar enlace de clase virtual» (`/docente/aula-virtual`) y AL-05 «Mis cursos» del alumno (`/alumno/cursos` y `/alumno/cursos/{cursoId}`). Pantallas: [frontend-aula-virtual.md](../frontend-aula-virtual.md). API: [aula-virtual.md](../api/aula-virtual.md).

Pruebas automáticas:

- `tests/aula-virtual/reglas.test.ts` (sin base): formatos del material (PDF, imagen como IMAGEN, archivo falsificado, exactamente 5 MB y 5 MB + 1 con su motivo), estados Borrador, Publicado y Oculto y sus cambios, visibilidad para el alumno (unidad activa o no), URL http/https y rechazos, estado del enlace en los **límites exactos** (un milisegundo antes del inicio, el inicio, un milisegundo antes del fin y el fin), hora de Lima, fin posterior al inicio, orden de las unidades, agrupación por unidad y esquemas.
- `tests/aula-virtual/aulaVirtual.integracion.test.ts` (PostgreSQL, en el CI): 401 y 403 en **cada endpoint**, vínculo del docente (403 en un aula ajena, 404 en sus unidades, materiales y enlaces) y del alumno (otra sección, curso fuera de su plan y sin matrícula vigente), unidades por la API, archivo en el almacén y su borrado, rechazos sin guardar nada, borradores y ocultos invisibles y con descarga 404, unidad desactivada, enlaces con su estado y su URL solo si está activo, auditoría, avisos solo a los alumnos con cuenta de la sección y solo lectura fuera del año en curso.

**Precondición común (PC):** seed cargado; año **2026** «En curso». Docente **Juan Pérez Salazar** (con cuenta) con Matemática en **1° A** y **1° B** y Comunicación en 1° A; otro docente con Matemática en otra sección. Alumno **Diego Quispe Rojas** (con cuenta) matriculado en 1° A; otra alumna con cuenta en 1° B; un alumno de 1° A sin cuenta; un estudiante con cuenta y sin matrícula vigente. Almacén configurado (`ARCHIVOS_DRIVER=disco` en desarrollo o `s3` en AWS). Archivos ficticios: `guia.pdf` (≈ 2 KB), `diapositivas.pptx`, `mapa.png`, `grande.pdf` (5 242 881 bytes), `exacto.pdf` (5 242 880 bytes), `tarea.pdf` (un HTML renombrado) y `programa.exe`. Solo datos ficticios (RNF14).

Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y muestra el mensaje).

## Unidades didácticas (DO-05)

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US61-01 | US61 | básico | PC; sesión de Juan | 1. Menú «Aula virtual». 2. Pestaña «Matemática · 1° A». 3. En «Nueva unidad» escribir el nombre. 4. «Crear unidad». Repetir con otras dos. | «Números enteros», «Fracciones», «Ecuaciones» | Las tres unidades aparecen numeradas 1, 2 y 3 con «0 materiales». «Subir material» se habilita. |
| CP-US61-02 | US61 | alterno | CP-US61-01 | 1. En «Ecuaciones», ✎. 2. Cambiar el nombre y «Guardar». 3. En la misma, «↑» dos veces. | «Ecuaciones lineales» | La unidad se renombra y queda primera (número 1); las demás bajan. En el extremo superior «↑» está deshabilitado. |
| CP-US61-03 | US61 | alterno | CP-US61-01 | 1. En «Fracciones», el ojo tachado «Desactivar». | — | Queda gris con «Desactivada» y «los alumnos no la ven». No aparece en «Unidad o tema» de M-16. El ojo la vuelve a activar. |
| CP-US61-04 | US61 | excepción | Docente sin unidades activas en el curso | 1. Abrir el aula. | — | «Subir material» deshabilitado y el aviso «Crea una unidad para subir materiales». Por la API, subir a una unidad desactivada: `422 UNIDAD_INACTIVA`. |

## US61 · Publicación de materiales de estudio (docente, DO-05 y M-16)

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US61-05 | US61 | básico | CP-US61-01 | 1. «Subir material». 2. Título, unidad «Números enteros», tipo «Archivo». 3. Arrastrar el PDF. 4. Dejar activado «Visible para los alumnos». 5. «Subir material». | «Guía de ejercicios», `guia.pdf` | Se cierra M-16; alerta «“Guía de ejercicios” quedó publicado para tus alumnos de 1° A.» y la fila con PDF, «Unidad 1 · Números enteros», su peso, la fecha y «Publicado». En `material_estudio`, `archivo_clave = materiales/<uuid>`; en `registro_auditoria`, `PUBLICAR_MATERIAL`. Diego recibe en la campana «Nuevo material en Matemática»; la alumna de 1° B no. |
| CP-US61-06 | US61 | alterno | CP-US61-01 | Igual que CP-US61-05 con una presentación. | `diapositivas.pptx` | Fila con tipo «PPTX» y «Publicado». Al descargarla, se baja con su nombre original. |
| CP-US61-07 | US61 | alterno | CP-US61-01 | 1. «Subir material» con tipo «Enlace». 2. URL. 3. Visible. 4. «Subir material». | «Video: la recta numérica», `https://www.youtube.com/watch?v=…` | Fila con tipo «Enlace», peso «—» y el ícono de enlace, que abre la URL en otra pestaña. |
| CP-US61-08 | US61 | alterno | CP-US61-01 | 1. «Subir material» con la imagen. 2. **Desactivar** «Visible para los alumnos». 3. «Subir material». | «Mapa conceptual», `mapa.png` | Alerta «… quedó guardado como borrador.»; fila con tipo «Imagen», «Borrador» y sin fecha de publicación. Sin auditoría ni aviso a los alumnos. |
| CP-US61-09 | US61 | excepción | CP-US61-01 | 1. «Subir material». 2. Elegir el archivo. | `programa.exe` | En la tarjeta del archivo: «Formato no permitido. Sube un PDF, PPTX, DOCX, XLSX o una imagen JPG o PNG.»; no se envía. |
| CP-US61-10 | US61 | excepción | CP-US61-01 | 1. «Subir material» con un HTML renombrado a .pdf. 2. Título. 3. «Subir material». | `tarea.pdf` | El servidor revisa el contenido: alerta roja en M-16 «Formato no permitido. Sube un PDF, PPTX, DOCX, XLSX o una imagen JPG o PNG.» (`400 ARCHIVO_NO_PERMITIDO`). No se guarda nada. |
| CP-US61-11 | US61 | excepción | CP-US61-01 | 1. «Subir material» con el archivo de 5 MB + 1 byte. | `grande.pdf` | «El archivo supera el tamaño máximo de 5 MB. Elige un archivo más liviano.»; por la API, `413 ARCHIVO_DEMASIADO_GRANDE` con el mismo mensaje. No se guarda. |
| CP-US61-12 | US61 | alterno | CP-US61-01 | 1. Subir el archivo de exactamente 5 MB. | `exacto.pdf` | Se acepta y se publica. |
| CP-US61-13 | US61 | excepción | CP-US61-01 | 1. «Subir material» tipo «Enlace» sin protocolo. 2. «Subir material». | `meet.kubo.edu.pe/mat` | Bajo el campo: «Ingresa un enlace válido»; no se envía. Por la API, `400 ENLACE_INVALIDO` con el mismo mensaje. |
| CP-US61-14 | US61 | básico | CP-US61-05 | 1. En la fila del PDF, el ojo tachado «Ocultar». | — | Alerta «… quedó oculto: tus alumnos ya no lo ven.»; estado «Oculto». Auditoría `OCULTAR_MATERIAL`. |
| CP-US61-15 | US61 | alterno | CP-US61-14 y CP-US61-08 | 1. En el material oculto, ✓ «Publicar». 2. En el borrador, ✓ «Publicar». | — | Ambos pasan a «Publicado» con la fecha de hoy; auditoría `PUBLICAR_MATERIAL` y aviso a los alumnos de 1° A. |
| CP-US61-16 | US61 | básico | CP-US61-06 | 1. Papelera del material. 2. «Eliminar» en la confirmación. | — | Desaparece de la tabla; su archivo se borra del almacén; auditoría `ELIMINAR_MATERIAL`. Su descarga responde 404. |
| CP-US61-17 | US61 | excepción | Sesión de otro docente | 1. Por la API, publicar, ocultar, eliminar o descargar un material de Juan. 2. `GET /aula-virtual/asignaciones/{id}` de un curso de Juan. | ids de Juan | 1: `404 NO_ENCONTRADO`. 2: `403 ACCESO_DENEGADO`. |
| CP-US61-18 | US61 | excepción | Sin sesión o con sesión de apoderado | 1. Llamar cualquier endpoint del aula del docente. | — | Sin sesión `401 NO_AUTENTICADO`; apoderado `403 ACCESO_DENEGADO`. |
| CP-US61-19 | US61 | excepción | Año 2026 pasado a «En cierre» | 1. Abrir el aula. 2. Por la API, crear una unidad. | — | Aviso «El año 2026 ya no está en curso» y sin botones de cambio; la API responde `422 ANIO_NO_EN_CURSO`. |

## US62 · Publicación de enlaces de clase virtual (docente, DO-05 y M-17)

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US62-01 | US62 | básico | PC; sesión de Juan; Matemática · 1° A | 1. «Agregar enlace». 2. Tipo «Clase virtual», título, URL, inicio hace 10 minutos y fin dentro de 50. 3. Visible. 4. «Guardar enlace». | «Clase de Matemática · 1° A», `https://meet.google.com/abc-defg-hij` | Alerta «Se guardó el enlace …»; tarjeta «CLASE VIRTUAL», «Activo», el día y las horas en Lima y la URL. Auditoría `PUBLICAR_ENLACE`; Diego recibe «Clase virtual en Matemática». |
| CP-US62-02 | US62 | alterno | CP-US62-01 | 1. Agregar una «Asesoría» para mañana. 2. Un «Taller» de hace tres días. | — | La asesoría muestra «Programado» y el taller «Finalizado». |
| CP-US62-03 | US62 | excepción | CP-US62-01 | 1. «Agregar enlace» con URL sin protocolo. 2. «Guardar enlace». | `meet.kubo.edu.pe/mat-1a` | Bajo la URL: «Ingresa un enlace válido»; no se guarda. Por la API, `400 ENLACE_INVALIDO` «Ingresa un enlace válido» y no se crea la fila. |
| CP-US62-04 | US62 | excepción | CP-US62-01 | 1. Fin igual o anterior al inicio. 2. «Guardar enlace». | inicio 10:00, fin 09:00 | Bajo «Fin»: «El fin debe ser posterior al inicio». Por la API, `400 FECHAS_ENLACE_INVALIDAS`. |
| CP-US62-05 | US62 | alterno | CP-US62-01 | 1. Agregar un enlace con «Visible para los alumnos» desactivado. | — | La tarjeta muestra «Oculto»; sin auditoría ni aviso. Diego no lo ve. |
| CP-US62-06 | US62 | básico | CP-US62-01 | 1. En la tarjeta activa, «Ocultar». 2. Luego «Mostrar». | — | Pasa a «Oculto» y de vuelta a «Activo»; auditoría `OCULTAR_ENLACE` y `PUBLICAR_ENLACE`. Al mostrarlo, aviso a los alumnos. |
| CP-US62-07 | US62 | alterno | CP-US62-02 | 1. ✎ en la asesoría. 2. Cambiar la hora y «Guardar enlace». | — | «Se actualizó el enlace …»; nuevas horas en la tarjeta. |
| CP-US62-08 | US62 | básico | CP-US62-02 | 1. Papelera del taller. 2. «Eliminar». | — | Desaparece; auditoría `ELIMINAR_ENLACE`. |
| CP-US62-09 | US62 | alterno | Enlace de 10:00 a 11:30 (Lima) | 1. Consultar el aula a las 09:59:59, 10:00:00, 11:29:59 y 11:30:00 (hora de Lima). | — | Programado, Activo, Activo y Finalizado (prueba automática en los límites exactos). |
| CP-US62-10 | US62 | básico | CP-US62-01 | 1. «Copiar enlace». | — | Alerta «Enlace copiado.» y la URL en el portapapeles. |

## US67 · Acceso a materiales y clases virtuales (alumno, AL-05)

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US67-01 | US67 | básico | CP-US61-05, CP-US61-07, CP-US61-08 y CP-US62-02; sesión de Diego | 1. «Mis cursos». 2. «Matemática». | — | «Matemática · 1° A» con «Docente: Juan Pérez Salazar». En «Materiales de estudio», agrupados por unidad, la guía y el video; **no** el mapa en borrador. En escritorio, la lista de cursos a la izquierda. |
| CP-US67-02 | US67 | básico | CP-US67-01 con un enlace activo | 1. Ver «Clases virtuales». 2. «Entrar a clase». | — | Franja verde «Tu clase virtual está disponible» y la fila «Activo» con «Entrar a clase». Abre la URL en otra pestaña (`target=_blank`, `rel="noopener noreferrer"`). Los programados y finalizados no tienen botón ni URL. |
| CP-US67-03 | US67 | básico | CP-US67-01 | 1. «Descargar» en la guía PDF. 2. En una PPTX. | — | El PDF se abre en otra pestaña; la PPTX se descarga con su nombre. Ambas por `/aula-virtual/materiales/{id}/archivo`. |
| CP-US67-04 | US67 | excepción | CP-US61-14 (material oculto) | 1. Recargar el curso. 2. Por la API, descargar el material oculto. | id del material | No aparece en la lista; la descarga responde `404 NO_ENCONTRADO`. |
| CP-US67-05 | US67 | excepción | CP-US61-08 (borrador) y CP-US62-05 (enlace oculto) | 1. Por la API, descargar el borrador. 2. Ver «Clases virtuales». | — | 1: `404`. 2: el enlace oculto no aparece. |
| CP-US67-06 | US67 | excepción | CP-US61-03 (unidad desactivada con materiales publicados) | 1. Ver el curso. 2. Descargar uno de esos materiales por la API. | — | La unidad y sus materiales no aparecen; la descarga responde 404. |
| CP-US67-07 | US67 | excepción | Sesión de la alumna de 1° B | 1. Abrir Matemática. 2. Por la API, descargar la guía de 1° A. | — | 1: el aula de 1° B (sin los materiales de 1° A). 2: `404`. |
| CP-US67-08 | US67 | excepción | Sesión de Diego | 1. `GET /aula-virtual/alumno/cursos/{id}` de un curso que no está en el plan de su sección. | id cualquiera | `404 NO_ENCONTRADO` «El curso no existe en tu sección.». |
| CP-US67-09 | US67 | excepción | Sesión del estudiante sin matrícula vigente | 1. Entrar al portal. 2. Por la API, pedir un curso. | — | 1: «Tu portal aún no está disponible». 2: `403 SIN_MATRICULA_VIGENTE`. |
| CP-US67-10 | US67 | alterno | Curso del plan sin docente (Comunicación sin asignación) | 1. Abrir el curso. | — | «Este curso aún no tiene docente» con qué esperar. |
| CP-US67-11 | US67 | básico | CP-US67-01 en un celular (390 px) | 1. Abrir el curso. | — | Una sola columna, sin la lista lateral y sin desplazamiento horizontal; los botones ocupan el ancho. |
| CP-US67-12 | US67 | excepción | Sin sesión, o con sesión de docente | 1. `GET /aula-virtual/alumno/cursos/{id}`. | — | `401 NO_AUTENTICADO`; con docente, `403 ACCESO_DENEGADO`. |
