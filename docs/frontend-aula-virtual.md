# Frontend · Aula virtual (DO-05 con M-16 y M-17, AL-05)

Sprint 4, bloque 3 (US61, US62, US67). Frames de la página **«1 · Prototipo escritorio»** del Figma «Kubo – Prototipo», con capturas en `docs/figma/`: `DO-05-mis-cursos-docente.png` (frame `249:316`, «DO-05 · Mis cursos · Docente»), `M-16-subir-material.png` (`251:59`, «Subir material de estudio»), `M-17-agregar-enlace.png` (`251:129`, «Agregar enlace de clase virtual») y `AL-05-mis-cursos-alumno.png` (`250:260`, «AL-05 · Mis cursos · Alumno»). API: [api/aula-virtual.md](api/aula-virtual.md). Casos de prueba: [pruebas/casos-sprint4-aula-virtual.md](pruebas/casos-sprint4-aula-virtual.md).

Los cuatro frames existen y se siguieron; las diferencias están al final.

## Archivos

```
src/app/(portal)/docente/aula-virtual/page.tsx   DO-05: pestañas de cursos y secciones, enlaces, unidades y materiales
src/components/docente/aulaVirtual.tsx           M-16, M-17, confirmar eliminación, tarjetas de enlace, unidades y tabla
src/components/docente/PortalDocente.tsx         menú «Aula virtual»
src/app/(portal)/alumno/cursos/page.tsx          AL-05: cada curso de «Mis cursos» abre su aula
src/app/(portal)/alumno/cursos/[cursoId]/page.tsx AL-05: clases virtuales y materiales del curso
src/components/portal/aulaVirtual.tsx            tipos, insignias de estado, peso legible y descarga por la API
src/lib/formato.ts                               rangoDeHoras y entradaFechaHora (hora de Lima)
public/figma/icon-video*.svg, icon-enlace.svg,   íconos con el trazo de los demás (Lucide): video, enlace, asesoría,
icon-asesoria.svg, icon-taller.svg, act-*.svg    taller, documento, capas, ojo tachado, subir/bajar, copiar, publicar
```

## DO-05 · Aula virtual del docente (US61, US62)

1. **Menú «Aula virtual»** en el portal del docente. Arriba, una pestaña por curso y sección del año en curso («Matemática · 1° A»); en el celular la fila se desplaza de lado. Sin cursos en el año en curso: «No tienes cursos en el año en curso» con qué hacer.
2. **Clase virtual y enlaces:** tarjetas (una columna en el celular, dos en tableta, tres en escritorio) con el tipo, el estado que calcula el servidor (Programado ámbar, Activo verde, Finalizado gris; «Oculto» si no es visible), el título, el día y las horas en Lima («martes 24/11, 10:00 – 11:30»), la URL y «Copiar enlace», mostrar u ocultar, editar y eliminar. «Agregar enlace» abre M-17.
3. **Unidades didácticas:** lista por número con cuántos materiales tiene cada una; subir y bajar, renombrar en la misma fila y desactivar o activar (una desactivada se ve gris con «Desactivada»). Al pie, «Nueva unidad» y «Crear unidad».
4. **Materiales de estudio:** el subtítulo resume los estados («3 publicados, 1 en borrador y 1 oculto en Matemática · 1° A.»). En escritorio, la tabla del Figma (Material, Tipo, Unidad, Peso, Publicado, Estado, Acciones); en el celular, una tarjeta por material. Acciones: descargar (o abrir el enlace), publicar (borrador u oculto), ocultar (publicado) y eliminar con confirmación. «Subir material» abre M-16 y se deshabilita, con un aviso, mientras no haya una unidad activa.
5. Cada acción muestra una alerta verde con lo que pasó o roja con el mensaje del servidor. En un año que ya no está en curso, el aula se ve en solo lectura con su aviso y sin botones de cambio.

## M-16 · Subir material de estudio

Título, «Unidad o tema» (solo las activas), «Tipo» (Archivo o Enlace), la zona para arrastrar o elegir el archivo (PDF, PPTX, DOCX, XLSX, JPG o PNG; máximo 5 MB) o el campo «Enlace (URL)», e interruptor «Visible para los alumnos» con «Si lo desactivas, el material se guarda como borrador y solo tú puedes verlo.». El navegador avisa antes de enviar si el archivo pesa más de 5 MB o su extensión no está permitida, y «Ingresa un enlace válido» si la URL no es http o https; el servidor vuelve a validar por el contenido real y su motivo se muestra en la alerta del modal.

## M-17 · Agregar o editar enlace de clase virtual

Tipo (Clase virtual, Asesoría o Taller), título, URL, **inicio y fin** (campos de fecha y hora), interruptor «Visible para los alumnos» y el aviso de que las horas son de Lima y que «Entrar a clase» aparece solo entre el inicio y el fin. «Ingresa un enlace válido» y «El fin debe ser posterior al inicio» se muestran bajo cada campo.

## AL-05 · Mis cursos del alumno (US67)

1. «Mis cursos» (US49) sigue siendo la lista de cursos de su sección; ahora cada tarjeta abre el aula del curso.
2. **Página del curso:** «← Mis cursos», el título «Matemática · 1° A» y el docente. En escritorio (≥ 1024 px), a la izquierda la lista de sus cursos como en el Figma; en el celular, una sola columna sin esa lista.
3. **Clases virtuales:** si un enlace está Activo, la franja verde «Tu clase virtual está disponible» con «Entrar a clase». Cada enlace muestra su tipo, día y horas y su estado; solo el activo tiene «Entrar a clase», que abre la URL en otra pestaña con `rel="noopener noreferrer"` (la URL de los demás ni siquiera llega al navegador).
4. **Materiales de estudio:** agrupados por unidad, con tipo, peso y fecha de publicación. «Descargar» abre el PDF o la imagen en otra pestaña y descarga PPTX, DOCX y XLSX, siempre por la API con permiso; un material tipo enlace tiene «Abrir». Pie: «Solo ves los materiales publicados…».
5. Estados: cargando, error con «Reintentar», curso sin docente («Este curso aún no tiene docente») y sin enlaces o sin materiales con su mensaje.

## Diferencias con el Figma

- **Nombre del menú:** el Figma del docente llama a la pantalla «Mis cursos»; el encargo pide el menú **«Aula virtual»**, y así se llama (título y menú). La pestaña «Trabajos» de DO-05 y AL-05 no se construye: los trabajos son de otra historia.
- **Fechas del enlace:** M-17 tiene «Día» y «Hora» como listas («Lunes a viernes», «Según el horario publicado»); US62 pide fecha y hora de **inicio y fin** para calcular el estado, así que son dos campos de fecha y hora. El aviso del Figma «Los alumnos podrán entrar desde 10 minutos antes del inicio del bloque» se cambió por el que corresponde a la regla pedida: «Entrar a clase» solo entre el inicio y el fin.
- **Estados del enlace:** el Figma muestra «En curso» y «Disponible» en AL-05; se usan los tres de US62 (Programado, Activo, Finalizado) en ambas pantallas.
- **Unidades didácticas:** el Figma no tiene dónde gestionarlas (solo la columna «Unidad»); se agregó la tarjeta «Unidades didácticas» con el mismo estilo de las demás.
- **Curso y sección en M-16:** el Figma tiene un selector «Curso y sección» dentro del modal; aquí el curso y la sección son los de la pestaña elegida (subtítulo del modal), para no subir por error a otra sección.
- **Editar material, buscador y filtro por tipo** de DO-05 y AL-05 no se construyeron (no los pide el encargo). El ícono «editar» de cada material se cambió por «descargar» o «abrir».
- **AL-05:** el Figma muestra la lista de cursos y el curso en la misma pantalla; aquí «Mis cursos» es la lista y cada curso tiene su página, con la lista a la izquierda en escritorio (igual que el Figma) y una columna en el celular. El contador «2 nuevos» no se construyó.
