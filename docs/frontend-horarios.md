# Frontend · Horarios: matriz de horarios (AD-13) y asignar clase (M-06)

# AD-13 · Matriz de horarios (US27, US28, US29, US30, US31)

Pantalla `/admin/horarios`, según los frames **AD-13 · Matriz de horarios** y **M-06 · Asignar clase** de la página «1 · Prototipo escritorio» del Figma «Kubo – Prototipo» (capturas en `docs/figma/AD-13-matriz-horarios.png` y `docs/figma/M-06-asignar-clase.png`). Se llega con «Horarios» del menú lateral, que queda habilitado. API: [horarios.md](api/horarios.md). Casos de prueba: [pruebas/casos-sprint3-horarios.md](pruebas/casos-sprint3-horarios.md).

## Archivos

```
src/app/(portal)/admin/horarios/page.tsx   AD-13: selección de año, grado y sección, y editor del horario
src/components/admin/horarios.tsx          Tipos de la API, cuadrícula, paneles, ModalClase (M-06) y ModalPublicar
src/components/admin/PortalAdmin.tsx       «Horarios» del menú lateral apunta a /admin/horarios
```

No se agregaron íconos: se usan los de `public/figma` (`nav-grid-gris`, `icon-plus-gris`, `icon-send`, `act-edit`, `act-trash`, `check-blanco`, `icon-check-verde`, `alerta-warn`, `alerta-err`, `icon-info`).

## Qué muestra

- **Encabezado:** «Académico / Horarios», título «Matriz de horarios» y la descripción.
- **Selección** (tarjeta): «Año académico» (por defecto el año en curso), «Grado» y «Sección» (los grados y las secciones del año elegido; una sección inactiva se marca «(inactiva)»).
- **Barra del horario** (tarjeta): la insignia de la versión («Sin horario», «Borrador · versión 3», «Publicado · versión 2» o «Archivado · versión 1»), el avance «32 / 35 bloques» con su barra y, a la derecha:
  - el selector «Versión» (solo si la sección tiene más de una), para ver la vigente o una anterior;
  - «Editar horario», si lo que se ve es la versión publicada y no hay borrador: crea el borrador con las mismas clases;
  - «Publicar» o «Publicar nueva versión», si lo que se ve es el borrador.
- **Avisos:** verde al asignar, vaciar o publicar («Horario publicado (versión 2). Se avisó por correo a 9 de 10 docentes.»); rojo «No se puede publicar: existen bloques horarios sin asignar» con los cursos a los que les faltan bloques y los bloques libres (hasta 8 y «y N más»); ámbar «Esta sección no pertenece al periodo académico activo» en solo lectura; azul al ver una versión archivada o la publicada mientras hay un borrador.
- **Cuadrícula:** «Hora» y los 5 días en columnas; los bloques del año en filas, con la hora de inicio en negrita y la de fin debajo; el recreo es una franja gris «RECREO · 10:00 – 10:20» sin celdas. Cada clase es una tarjeta con borde izquierdo azul: curso, docente («E. Castro») y aula. Un bloque libre es un recuadro punteado «+ Asignar». Al hacer clic en una clase o en un bloque libre se abre M-06. En solo lectura (año cerrado, sección inactiva, versión publicada o archivada) las celdas no responden al clic.
- **Panel «Validaciones»:** «Sin cruces de docente» y «Sin cruces de aula» (el sistema los impide al guardar), «Curso y docente coinciden» (o, en rojo, las clases cuyo docente ya no tiene el curso), «N bloques sin asignar», «Cursos con bloques de más» y «Horario completo».
- **Panel «Cursos de 5° A»:** cada curso del plan de estudios con las iniciales y el nombre de su docente («Sin docente asignado» en rojo si no tiene) y sus bloques «4 / 6» (en ámbar si faltan o sobran).
- **Estados de la pantalla:** cargando (secciones y horario), error con «Reintentar», vacío («Aún no hay años académicos», «El año 2026 aún no tiene secciones») y con datos.

## M-06 · Asignar clase

`Modal` con el ícono de la cuadrícula en tono azul, título «Asignar clase» (o «Editar clase») y subtítulo «5° A · Martes 12:35 – 13:20».

- **Curso** (obligatorio): los cursos del plan de la sección, con su avance («Matemática (4 de 6 bloques)»). Al elegirlo se selecciona solo el docente que lo tiene asignado.
- **Docente** (obligatorio): los docentes con cursos en la sección. Debajo, en gris, «Ya tiene clase en 4° A en este bloque.» si está ocupado.
- **Aula** (obligatorio): las aulas activas; por defecto, el aula habitual de la sección. Debajo: «Aula disponible en este bloque.» u «Ocupada por 5° B en este bloque.».
- **«Docentes con Arte y Cultura asignado»:** el docente del curso con la insignia «Disponible» (verde) u «Ocupado · 4° A» (roja).
- **Errores:** «Debe completar curso, docente y aula antes de guardar» en una alerta roja (se valida también antes de enviar). «Error: Cruce de Docente · ya tiene clase en 4° A (martes 12:35 – 13:20)» y «Este docente no tiene asignado el curso seleccionado», en rojo bajo «Docente»; «Error: Aula Ocupada · Aula 305 está asignada a 5° B (…)», en rojo bajo «Aula». Los textos son los del backend y se decide dónde mostrarlos por el `code`.
- **Pie:** «Vaciar bloque» (solo si el bloque tiene clase), «Cancelar» y «Guardar bloque». Mientras se guarda, los botones quedan deshabilitados.

## Publicar

«Publicar» abre un modal de confirmación: «El horario quedará visible para los docentes y alumnos de la sección» y, si ya había una versión publicada, «La versión 2 pasará a «Archivado» y quedará en solo lectura». Avisa que se enviará un correo a los docentes y que, si falla, el horario se publica igual.

## Diferencias con el Figma (y por qué)

| En el Figma | En el código | Motivo |
|---|---|---|
| Selector «Sección: 5° A» y selector de año | «Año académico», «Grado» y «Sección» | El encargo pide selector de grado y sección |
| «Ver por docente», «Ver por aula» e «Importar CSV» | No están | No son de este bloque (US27–US31). La consulta por docente ya existe en la API para el bloque de portales; la importación es AD-17 |
| Botón «Guardar» | No está | Cada bloque se guarda al confirmar el modal; el horario completo se confirma con «Publicar» |
| «Ver versiones anteriores» (botón) | Selector «Versión», visible con más de una versión | Muestra la versión elegida en la misma cuadrícula, en solo lectura |
| «Publicar nueva versión» siempre visible | «Publicar» la primera vez; «Editar horario» sobre un horario publicado y «Publicar nueva versión» sobre su borrador | US31: editar un horario publicado crea un borrador a partir de él |
| Sin confirmación al publicar | Modal de confirmación | Publicar archiva la versión anterior y envía correos |
| La alerta de publicar lista solo los bloques | Lista los cursos a los que les faltan bloques y los bloques libres | La regla de US31 es por horas semanales de cada curso |
| Celda roja «Aula ocupada» en la cuadrícula y «Error: Aula Ocupada» en el panel | El cruce se informa en el modal y el bloque no se guarda | US29 y US30 piden bloquear el guardado: en la cuadrícula nunca queda un cruce |
| Panel «Validaciones en tiempo real» | Panel «Validaciones» | Los cruces se validan al guardar cada bloque |
| Panel «Docentes de 5° A» (docente y bloques) | Panel «Cursos de 5° A» (curso, docente y bloques frente a horas) | Es lo que decide si se puede publicar |
| Tarjetas verdes para clases fuera del aula habitual | Todas con borde azul | El modelo no distingue tipos de ambiente |
| M-06 lista dos docentes para un curso | Un solo docente | US14: un curso tiene un solo docente activo por sección |
| M-06 con la nota «Otras validaciones: …» | No se muestra | Es una anotación del prototipo; esos mensajes aparecen cuando ocurren |
| M-06 sin forma de vaciar el bloque | «Vaciar bloque» | El encargo pide poder vaciar un bloque del borrador |
| Insignia «Publicado» gris | Verde; «Borrador» en ámbar y «Archivado» en gris | Distingue de un vistazo el borrador de lo publicado |
| «El sistema valida en tiempo real los cruces…» | «El sistema valida al guardar los cruces…» | Describe lo que hace el sistema |

## Pendiente

- Vistas «Ver por docente» y «Ver por aula», e «Importar CSV» (AD-17).
- «Mi horario» del docente (DO-02), del alumno (AL-02) y el horario del apoderado (AP-05) llegaron en el bloque 4: ver [frontend-portales-horario.md](frontend-portales-horario.md).
- Editar el catálogo de bloques horarios desde la aplicación.
