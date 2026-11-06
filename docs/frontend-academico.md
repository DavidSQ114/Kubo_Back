# Frontend · Académico: año y bimestres (AD-02), grados, secciones y aulas (AD-03), cursos y competencias (AD-04) y reglas de evaluación (AD-05)

# AD-02 · Año académico y bimestres

Pantalla `/admin/anio`, conectada a la API de [academico.md](api/academico.md). Casos de prueba en [pruebas/casos-academico.md](pruebas/casos-academico.md).

## Archivos

```
src/app/(portal)/admin/anio/page.tsx   AD-02: registrar año, años registrados y periodos de evaluación
src/components/admin/anio.tsx          Tipos, badges, formulario del año, tabla de bimestres y modal de cambio de estado
public/figma/icon-calendar*.svg        Calendario en azul y en gris (derivados del ícono del menú lateral)
public/figma/icon-plus-*.svg           «+» en blanco y en gris para los botones del frame
```

El ítem «Año y bimestres» del menú lateral y una tarjeta en el inicio del administrador (AD-01) llevan a esta pantalla.

## Qué muestra

Sigue el frame **AD-02** del Figma «Kubo – Prototipo» (captura en `docs/figma/AD-02-anio-bimestres.png`):

- **Registrar año académico** (izquierda): año y fechas, con los errores del backend bajo el campo que corresponde («La fecha de fin…» en *Fecha de fin*, «El año debe coincidir…» en *Año*) y los conflictos (solapamiento, año en curso) en una alerta ámbar. El botón «Nuevo año académico» lleva el foco a este formulario.
- **Años registrados** (derecha): año, vigencia con «Matrícula habilitada / no habilitada», estado y el botón de la única transición posible, con confirmación en un modal. Al hacer clic en una fila se muestran sus periodos.
- **Periodos de evaluación · año** (abajo): los 4 bimestres con fechas, semanas, registro de notas y estado. Se muestran sin edición hasta pulsar «Editar bimestres», que habilita los campos (salvo los bimestres finalizados) y muestra «Guardar cambios» y «Cancelar». Un año sin bimestres empieza en edición, con «Guardar configuración». Si el año está «En curso», el bimestre que contiene hoy lleva la etiqueta «Vigente» (no cambia su estado guardado).
- **Editar año / Eliminar año** (feedback del JP), en la cabecera del detalle: «Editar año» abre un modal con las fechas de inicio y fin (no en años cerrados); «Eliminar año» aparece solo en años «Planificado» y pide confirmación. Si el año tiene secciones, planes o matrículas, el modal muestra el mensaje del backend.
- **Estados de la pantalla:** cargando, error con «Reintentar», vacío y con datos. Los mensajes del backend se muestran tal cual.

## Diferencias con el Figma (y por qué)

| En el Figma | En el código | Motivo |
|---|---|---|
| Botón «Habilitar» en la fila de un año planificado | «Abrir matrícula» (y «Iniciar clases», «Iniciar cierre», «Cerrar año») | Es el nombre de la acción en US06; cada estado tiene su propio botón |
| Alerta «No se puede cerrar el año 2026 todavía» con el número de notas sin publicar | El mensaje del backend aparece al intentar cerrar | La API aún no devuelve cuántos cierres faltan; llegará con el módulo de evaluación |
| Fila del bimestre con error resaltada en rojo y detalle de qué bimestres chocan | Alerta con el mensaje del backend sobre la tabla | El backend informa la regla incumplida, no la fila |
| Bimestre «Activo» con fechas en solo lectura | Editable mientras no esté finalizado | La regla de US07 solo bloquea los finalizados |
| «Agregar bimestre» | Visible y deshabilitado | El año se divide siempre en 4 bimestres |
| Insignia «Año 2026 · Bimestre III en curso» en la barra superior | Se muestra con datos reales del año por defecto (Sprint 2): «En matrícula», «Bimestre IV en curso» o «Vacaciones»; sin año abierto no aparece | — |
| Sin «Editar año», «Eliminar año» ni «Editar bimestres» | Botones en la cabecera de «Periodos de evaluación» | Feedback del JP (Sprint 2) |
| Sin marca del bimestre actual | Etiqueta «Vigente» junto al nombre del bimestre | Ajuste pendiente del Sprint 1 |
| Selector de fecha sin ícono a la derecha | El navegador muestra su propio botón de calendario | Es el control nativo de fecha |

---

# AD-03 · Grados, secciones y aulas

Pantalla `/admin/grados` (US08, US09), según el frame **AD-03 · Grados, secciones y aulas** del Figma «Kubo – Prototipo» (captura en `docs/figma/AD-03-grados-secciones-aulas.png`). Se llega por el ítem «Grados, secciones y aulas» del menú lateral.

## Archivos

```
src/app/(portal)/admin/grados/page.tsx   AD-03: pestañas, tabla de secciones, panel de sección y bloque de aulas
src/components/admin/grados.tsx          Tipos, barra de vacantes, panel «Nueva sección», formulario de aula,
                                         selector con estilo de Campo y confirmación para eliminar
public/figma/icon-puerta.svg             Ícono del botón «Nueva aula»
public/figma/act-trash.svg               Acción «Eliminar» de la fila
```

## Qué muestra

- **Encabezado:** «Nueva aula» lleva el foco al formulario de aulas y «Nueva sección» al panel.
- **Pestañas:** «Secciones (n)» y «Aulas físicas (n)», con el **selector de año** a la derecha (por defecto el año en curso; si no hay, el que está en matrícula).
- **Tabla de secciones** con filtros de grado, estado y búsqueda, ordenada por grado. Muestra aula, tutor, vacantes (barra y matriculados/aforo), estado («Activa», «Aforo completo» con la fila en rojo, «Inactiva») y las acciones editar, inactivar/activar y eliminar. Pagina de 8 en 8.
- **Panel «Nueva sección» / «Editar sección»** a la derecha. Al elegir un aula, el aforo se completa con el suyo si estaba vacío. Los errores del backend aparecen bajo el campo correspondiente.
- **Alertas** sobre la tabla. Al eliminar una sección con alumnos aparece «No se puede eliminar una sección con alumnos matriculados» con el botón «Inactivar sección», como en el frame.
- **Aulas físicas:** formulario en línea (registrar o editar) y tabla con ubicación, aforo, sección asignada, ocupación y las acciones editar y desactivar/activar. En la pestaña Secciones se ven 3 aulas y «Ver todas».
- **Estados de la pantalla:** cargando, error, vacío y con datos; año cerrado en solo lectura.

## Diferencias con el Figma (y por qué)

| En el Figma | En el código | Motivo |
|---|---|---|
| Sin selector de año | Selector a la derecha de las pestañas | Pedido en US08 para ver otros años |
| «Aula física *» obligatoria y sin campo de aforo | Aula opcional y campo «Aforo máximo» | US08: el aula es opcional y la sección tiene su propio aforo (el del aula es el tope) |
| Papelera en las aulas | Desactivar/activar | US09: las aulas se desactivan, no se borran |
| Fila de la sección: editar y bloquear | Editar, inactivar/activar y eliminar | Eliminar (sin matrículas) también es parte de US08 |
| Fila «Lab. de Ciencias · Uso compartido · Por horario» | «Sin sección» y «—» | El uso por horario llegará con el módulo de horarios |
| Insignia «Año 2026 · Bimestre III en curso» | No se muestra | Es de la barra superior común del portal |

---

# AD-04 · Cursos y competencias

Pantalla `/admin/cursos` (US10, US11), según el frame **AD-04 · Cursos y competencias** del Figma «Kubo – Prototipo» (captura en `docs/figma/AD-04-cursos-competencias.png`). Se llega por el ítem «Cursos y competencias» del menú lateral.

## Archivos

```
src/app/(portal)/admin/cursos/page.tsx   AD-04: pestañas, malla curricular con filtros y bloques del curso elegido
src/components/admin/cursos.tsx          Tipos, ítem de la malla, detalle, grados y horas, competencias por grado,
                                         formulario «Registrar nuevo curso», eliminar y catálogo oficial
src/components/admin/anio.tsx            anioPorDefecto (ahora compartido con AD-03)
public/figma/icon-award.svg              Ícono de «Competencias del curso» (marca-award en azul)
public/figma/alerta-warn.svg             Triángulo ámbar de los avisos (alerta-err en ámbar)
```

## Qué muestra

- **Pestañas** «Malla curricular» y «Catálogo oficial», con el selector de año a la derecha (por defecto el año en curso).
- **Malla curricular:** cursos con código, nombre, «1° a 5° · 6 h/sem» y competencias, o «Inactivo». Búsqueda por nombre o código y filtros por área y estado.
- **Detalle del curso:** estado, código y área; grados, horas, docentes asignados y horarios publicados. «Desactivar»/«Activar», «Editar» y «Eliminar» (solo si no está en uso; si lo está, el aviso «Este curso no puede eliminarse»).
- **Grados y horas semanales** del año elegido: cada grado con su casilla y sus horas.
- **Competencias del curso:** un botón por grado del curso; las competencias del área con «N notas» o «Sin notas» y el contador «n de m seleccionadas». Una competencia con notas no se desmarca: aparece la alerta del frame.
- **Registrar nuevo curso / Editar:** código, nombre, área (determina las competencias), grados, horas, descripción y competencias del área. Los errores del backend aparecen bajo su campo.
- **Catálogo oficial:** las 11 áreas con sus competencias, solo lectura.
- **Estados:** cargando, error, vacío («Aún no hay cursos» / «Ningún curso coincide») y con datos; año cerrado en solo lectura.

## Diferencias con el Figma (y por qué)

| En el Figma | En el código | Motivo |
|---|---|---|
| Solo búsqueda en la malla | Búsqueda más filtros de área y estado | Pedido en US10 |
| Competencias por curso | Competencias por curso **y grado** (un botón por grado) | El modelo guarda las competencias por plan de estudio (curso + grado + año) |
| Sin bloque de grados y horas | Bloque «Grados y horas semanales» | US10: los grados del curso son los planes del año con sus horas |
| «Grados» como lista desplegable | Botones 1° a 5° (varios a la vez) | Un `select` simple no permite elegir varios grados |
| Sin selector de año | Selector a la derecha de las pestañas | Los planes son de un año, como en AD-03 |
| Sin «Eliminar» ni descripción | «Eliminar» (si el curso no se usa) y «Descripción (opcional)» | Parte de US10 |
| «4 de 4 seleccionadas» junto al título | Sobre la lista de competencias | Depende del grado elegido, que se elige debajo del título |
| «Catálogo oficial» editable (frame AD-04b) | Solo lectura | Gestionar el catálogo no es parte de US10 ni US11 |
| Peso de cada competencia | Campo «%» por competencia y «Total de pesos», solo si la regla vigente del año es «Promedio ponderado» (US12). Con moda, el peso guardado se conserva | Los pesos solo cuentan en el ponderado; van en todas las competencias o en ninguna |
| Horas de cada grado sin etiqueta | Sufijo «h/sem», placeholder «Ej.: 6» y `aria-label` «Horas semanales de …» | Ajuste pendiente del Sprint 1 (el campo no se entendía) |
| Insignia «Año 2026 · Bimestre III en curso» | Se muestra con datos reales (barra superior común) | Sprint 2 |

---

# AD-05 · Reglas de evaluación

Pantalla `/admin/reglas` (US12, RF10), según el frame **AD-05 · Reglas de evaluación** del Figma «Kubo – Prototipo» (captura en `docs/figma/AD-05-reglas-evaluacion.png`). Se llega por el ítem «Reglas de evaluación» del menú lateral, que antes estaba deshabilitado.

## Archivos

```
src/app/(portal)/admin/reglas/page.tsx   AD-05: selector de año, editor de la regla e historial
src/components/admin/reglas.tsx          Tipos, «Método de consolidación», vista previa del cálculo, historial y
                                         el modal que confirma la nueva versión
public/figma/icon-sliders.svg            Ícono del método (nav-sliders en azul)
```

## Qué muestra

- **Encabezado:** selector de año (por defecto el año en curso) e insignia «Regla vigente: versión N» o «Sin regla vigente».
- **Método de consolidación:** «Moda de los logros» o «Promedio ponderado». Con moda, el criterio de desempate (mayor o menor jerarquía); con ponderado, un aviso con enlace a «Cursos y competencias», donde se configuran los pesos. «Rige desde» ofrece los bimestres del año; los cerrados aparecen deshabilitados. Si hay bimestres cerrados, el aviso «Este cambio no afectará los bimestres ya cerrados».
- **Guardar cambios** abre un modal que resume la nueva versión (método, criterio y desde qué bimestre rige) y repite el aviso; al confirmar se crea la versión N + 1. «Descartar» vuelve a la regla vigente. Si el método y el criterio son los vigentes, «Guardar cambios» queda deshabilitado.
- **Vista previa del cálculo:** un estudiante de ejemplo con 4 competencias de Matemática (datos ficticios). Se cambia el logro de cada una (y su peso, en el ponderado) y el resultado lo calcula el backend con la misma función que usará el cierre del bimestre: frecuencias, aviso de empate y «Logro consolidado del curso».
- **Historial de versiones:** versión, método, desempate, a qué bimestres se aplicó, responsable y estado («Vigente» o «Archivada»), de solo lectura.
- **Estados:** cargando, error con «Reintentar», sin años («Aún no hay años académicos»), sin versiones («Aún no hay versiones») y año cerrado en solo lectura.

## Diferencias con el Figma (y por qué)

| En el Figma | En el código | Motivo |
|---|---|---|
| Tabla «Peso por competencia · Matemática» dentro de AD-05 | Los pesos se editan en AD-04 (bloque de competencias), visibles solo con «Promedio ponderado» vigente | Los pesos son de cada curso y grado (`CompetenciaPlan.peso`); así lo pide US12 |
| Etiqueta «Pendiente de validar con el Product Owner» | No se muestra | Era una nota del prototipo |
| Interruptor «Exigir todas las competencias calificadas antes del cierre» activo | Fila bloqueada con candado y la nota «Se configura con el cierre de bimestre (US39, Sprint 3)» | Ese criterio pertenece a US39 |
| Interruptor «Notificar a la administración al cerrar un registro» | No se muestra | Las notificaciones no son parte de US12 |
| Versión nueva en estado «Borrador» | La versión se guarda directamente como «Vigente»; la anterior pasa a «Archivada» | US12: guardar crea la nueva versión que rige desde el bimestre elegido |
| Sin selector de año ni de «rige desde» | Selector de año en el encabezado y «Rige desde» en el formulario | La regla es por año y cada versión rige desde un bimestre |
| Vista previa con una alumna real del colegio | «Estudiante de ejemplo · 3.° B» con logros editables | Solo datos ficticios (RNF14); editable para probar empates y pesos |
| Desempate «Sin definir» en la versión 1 | «Mayor jerarquía», o «No aplica» en el ponderado | El criterio siempre tiene un valor (por defecto, mayor jerarquía) |
