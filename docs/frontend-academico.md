# Frontend · Académico: año y bimestres (AD-02), grados, secciones y aulas (AD-03)

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
- **Periodos de evaluación · año** (abajo): los 4 bimestres con fechas, semanas, registro de notas y estado; se guardan juntos con «Guardar configuración».
- **Estados de la pantalla:** cargando, error con «Reintentar», vacío y con datos. Los mensajes del backend se muestran tal cual.

## Diferencias con el Figma (y por qué)

| En el Figma | En el código | Motivo |
|---|---|---|
| Botón «Habilitar» en la fila de un año planificado | «Abrir matrícula» (y «Iniciar clases», «Iniciar cierre», «Cerrar año») | Es el nombre de la acción en US06; cada estado tiene su propio botón |
| Alerta «No se puede cerrar el año 2026 todavía» con el número de notas sin publicar | El mensaje del backend aparece al intentar cerrar | La API aún no devuelve cuántos cierres faltan; llegará con el módulo de evaluación |
| Fila del bimestre con error resaltada en rojo y detalle de qué bimestres chocan | Alerta con el mensaje del backend sobre la tabla | El backend informa la regla incumplida, no la fila |
| Bimestre «Activo» con fechas en solo lectura | Editable mientras no esté finalizado | La regla de US07 solo bloquea los finalizados |
| «Agregar bimestre» | Visible y deshabilitado | El año se divide siempre en 4 bimestres |
| Insignia «Año 2026 · Bimestre III en curso» en la barra superior | No se muestra | Es de la barra común a todo el portal; se hará aparte |
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
