# Frontend · El horario en los portales: docente (DO-01, DO-02), apoderado (AP-05) y alumno (AL-01, AL-02, AL-05)

Sprint 3, bloque 4 (US34, US48, US49, US50). Frames de la página **«1 · Prototipo escritorio»** del Figma «Kubo – Prototipo», secciones «Docente», «Apoderado» y «Alumno», con capturas en `docs/figma/`: `DO-01-inicio-docente.png`, `DO-02-mi-horario-docente.png`, `AP-05-horario-apoderado.png`, `AL-01-inicio-alumno.png`, `AL-02-mi-horario-alumno.png` y `AL-05-mis-cursos-alumno.png`. API: [horarios.md](api/horarios.md), [matricula.md](api/matricula.md#portal-del-alumno-us49) y [comunidad.md](api/comunidad.md#acceso-del-alumno-al-portal-us49-pantalla-ad-06). Casos de prueba: [pruebas/casos-sprint3-portales-horario.md](pruebas/casos-sprint3-portales-horario.md).

## Archivos

```
src/components/portal/index.tsx               Estructura común (barra lateral azul, barra superior, guardia por perfil)
src/components/portal/horario.tsx             Horario semanal de solo lectura: cuadrícula y vista por día del celular
src/components/docente/PortalDocente.tsx      Menú y guardia del portal del docente
src/components/alumno/PortalAlumno.tsx        Menú, guardia y panel del alumno (grado y sección de su matrícula)
src/app/(portal)/docente/page.tsx             DO-01: saludo, acceso a «Mi horario» y «Mis cursos»
src/app/(portal)/docente/horario/page.tsx     DO-02: «Mi horario» del docente (US34)
src/app/(portal)/apoderado/horario/page.tsx   AP-05: «Horario» del hijo elegido (US48)
src/app/(portal)/alumno/page.tsx              AL-01: panel simplificado del alumno (US49)
src/app/(portal)/alumno/horario/page.tsx      AL-02: «Mi horario» del alumno (US50)
src/app/(portal)/alumno/cursos/page.tsx       AL-05: «Mis cursos» del alumno (US49)
src/components/admin/personas.tsx             AD-06: «Crear acceso al portal» en el detalle del estudiante (US49)
src/components/apoderado/PortalApoderado.tsx  «Horario» habilitado en el menú; barra lateral plegable en el celular
src/app/inicio/page.tsx                       Ya solo redirige al portal del perfil activo
src/lib/api.ts                                inicioPorRol: Docente → /docente, Alumno → /alumno
```

Íconos nuevos en `public/figma`: `nav-menu` (botón de menú del celular) y las variantes azules, para fondo claro, de cuatro íconos que ya existían en blanco: `nav-grid-azul`, `nav-book-azul`, `nav-award-azul` y `nav-usercheck-azul`.

## Estructura común de los portales del docente y del alumno

`EstructuraPortal` (en `components/portal`) sigue los frames DO-01 y AL-01: barra lateral azul (`bg-kubo-azul`) como la del administrador, con el logo, el menú, el nombre y el perfil del usuario, «Ingresar como …» si tiene otros perfiles, «Cambiar contraseña» y «Cerrar sesión». La barra superior lleva el saludo («Hola, Diego · 1° de secundaria A»), la insignia del año («Año 2026 · Bimestre III en curso», de `GET /academico/anios/actual`) y la campana de notificaciones, todavía sin función.

- **Guardia por perfil (RF04):** `useSesionDeRol(rol)` pide la sesión. Sin sesión va a `/login`; con la contraseña temporal, a `/cambiar-password`; con otro perfil activo, a `/acceso-denegado` (AC-07), que muestra «No tiene permisos para acceder a este recurso.». Es solo navegación: los datos los protege el servidor en cada endpoint.
- **Módulos que aún no existen:** se muestran en el menú atenuados, con la etiqueta «Próximamente» y sin enlace, igual que en el portal del apoderado. Un nombre largo («Registro de notas») ocupa dos líneas para que la etiqueta entre en los 264 px de la barra.
- **Celular (menos de 1024 px):** la barra lateral se oculta y se abre con el botón de menú de la barra superior, como un panel sobre el contenido; se cierra al elegir una opción o al tocar fuera. El contenido usa 16 px de margen lateral en lugar de 40.

## Horario semanal (`HorarioSemanal`)

Componente de solo lectura que comparten las tres pantallas. Recibe los días, los bloques del año y las clases de la versión publicada.

- **Escritorio y tableta (768 px o más):** la cuadrícula del Figma: «Hora» y los 5 días en columnas; los bloques en filas, con la hora de inicio en negrita y la de fin debajo; el recreo es una franja gris «RECREO · 10:00 – 10:20». Cada clase es una tarjeta con borde izquierdo azul. La columna de hoy se resalta en azul. Un bloque sin clase queda en blanco.
- **Celular (menos de 768 px):** un día a la vez. Arriba, cinco pestañas «Lun · Mar · Mié · Jue · Vie» (la de hoy lleva «Hoy» y es la que se abre; el fin de semana se abre el lunes); debajo, la lista de bloques de ese día con su hora, la clase o «Sin clase», y la franja del recreo. No hay desplazamiento horizontal.
- **Qué muestra cada clase:** al docente, «Curso · Sección» y el aula («Matemática · 1° A» / «Aula 101»); al alumno y al apoderado, el curso y «Docente · Aula» («Matemática» / «K. Rivera · Aula 101»).
- **Siempre la versión publicada vigente:** `useHorario` pide el horario al entrar y lo vuelve a pedir, sin mostrar el indicador de carga, cada vez que la pestaña recupera el foco. Si la administración publicó una versión nueva, se ve sin hacer nada más. El borrador en edición nunca llega al navegador.
- **Estados:** cargando (indicador), error (`Alerta` con el mensaje del backend y «Reintentar»), vacío (tarjeta con el mensaje del backlog) y con datos.

## DO-01 · Inicio del docente y DO-02 · Mi horario (US34)

- **Menú:** «Inicio», «Mi horario», y «Asistencia» y «Registro de notas» como «Próximamente».
- **DO-01** (`/docente`): saludo con la fecha, una tarjeta que lleva a «Mi horario» y «Mis cursos»: los cursos y secciones que tiene asignados (`GET /academico/mis-cursos`, US14), cada uno con sus horas semanales, el año y si su horario ya está publicado.
- **DO-02** (`/docente/horario`): título «Mi horario», la descripción del Figma y la insignia del año. La cuadrícula consolida las clases de **todas sus secciones con horario publicado**. Debajo, «Bloques por semana» y «Secciones a cargo» («1° A · 1° B»).
- **Sin clases publicadas:** tarjeta «Aún no tienes cursos asignados para este periodo» con «Cuando la administración te asigne cursos y publique los horarios, aparecerán aquí.», en lugar de una cuadrícula vacía.

## AP-05 · Horario del hijo (US48)

`/apoderado/horario`, con «Horario» habilitado en el menú del portal del apoderado y una tarjeta de acceso en AP-01.

- Título «Horario de clases» y «Horario semanal de Valeria · 3° de secundaria, sección B». Insignia «Publicado» y «Actualizado el 14/09/2026 · siempre verás la versión más reciente.».
- La cuadrícula muestra el curso, el docente y el aula de cada bloque del **hijo elegido** en la barra superior. Al cambiar de hijo, la página se vuelve a montar y pide el horario del otro.
- **Sin publicar:** tarjeta «El horario aún no ha sido publicado por la institución».
- El servidor valida el vínculo en cada consulta: la pantalla solo envía el id del hijo elegido y un id ajeno responde `403`.

## AL-01 · Panel del alumno, AL-05 · Mis cursos (US49) y AL-02 · Mi horario (US50)

- **Menú:** «Inicio», «Mis cursos», «Mi horario», y «Mis notas» y «Mi asistencia» como «Próximamente».
- **Guardia:** además del perfil, `PortalAlumno` pide `GET /matricula/alumno/panel`. Si responde `403 SIN_MATRICULA_VIGENTE` (alumno retirado, con la matrícula anulada o sin matrícula en un año abierto), muestra una tarjeta «Tu portal aún no está disponible» con el mensaje del servidor y «Cerrar sesión», en lugar del panel.
- **AL-01** (`/alumno`): «¡Hola, Diego!», la fecha, su grado y sección, y cinco accesos: «Mi horario» y «Mis cursos» (activos), y «Mis notas», «Mi asistencia» y «Notificaciones» con la etiqueta «Próximamente». Al pie, el aviso de que la cuenta es de consulta.
- **AL-05** (`/alumno/cursos`): una tarjeta por curso del plan de estudios de su sección, con el código del curso, su nombre, el docente («Docente por asignar» si aún no tiene) y las horas semanales. Vacío: «Tu sección aún no tiene cursos registrados».
- **AL-02** (`/alumno/horario`): título «Mi horario», «1° de secundaria · Sección A», la insignia «Publicado» con la fecha de la versión y la cuadrícula con curso, docente y aula. **Sin publicar:** «El horario aún no ha sido publicado». En el celular, un día a la vez con pestañas.

## AD-06 · «Crear acceso al portal» (US49)

En el detalle de una persona (modal de AD-06), si es un estudiante activo que aún no tiene cuenta, aparece un recuadro «Este estudiante aún no tiene una cuenta para ingresar al portal del alumno.» con el botón **«Crear acceso al portal»**.

1. El modal pide el «Correo del estudiante» (viene con el correo registrado, si lo tiene) y explica que la cuenta nace con una contraseña temporal que deberá cambiar.
2. «Crear acceso» llama a `POST /comunidad/estudiantes/{id}/acceso`. Los errores se muestran con el mensaje del servidor: «El estudiante no tiene una matrícula vigente…», «Ese correo ya está registrado en otra cuenta.» o el del campo si el correo no es válido.
3. Si todo va bien: alerta verde «Se creó el acceso de …» con «Enviamos sus credenciales a …» (o que el correo no se pudo enviar) y la **contraseña temporal, que se muestra solo esta vez**, con el botón «Copiar». Al cerrar, el listado se actualiza y el estudiante pasa de «Sin cuenta» a «Pendiente» y aparece el aviso «Se creó el acceso al portal de …».

## Diferencias con el Figma

| En el Figma | En la pantalla | Motivo |
|---|---|---|
| Portal del apoderado con barra lateral azul (AP-05) | Se mantiene la barra lateral clara de los sprints 1 y 2 | El portal del apoderado ya está en uso con ese estilo (se hizo con la página «Propuesta»); cambiarlo no es parte de este bloque. Los portales nuevos, docente y alumno, sí usan la barra azul del Figma |
| Botón «Descargar PDF» en DO-02, AP-05 y AL-02 | No está | Ninguna de las cuatro historias pide el PDF del horario |
| DO-02: aviso «Horario actualizado el … La administración modificó el jueves 11:05…» | Insignia «Publicado · Actualizado el …» (alumno y apoderado); el docente ve siempre lo vigente | El sistema no guarda qué cambió entre dos versiones; el aviso del cambio le llega al docente por correo (US31) |
| DO-02: selector «Semana del 14 al 18 de setiembre» | No está | El horario es el mismo todas las semanas |
| DO-02: colores por grado (verde y azul) y leyenda | Todas las clases con borde azul | La sección ya se lee en cada tarjeta; el color por grado no aporta con más de dos grados |
| DO-02: «24 bloques · 18 horas pedagógicas» | «Bloques por semana» sin horas pedagógicas | No hay una regla de conversión definida |
| DO-01: clase en curso, pendientes de asistencia y de notas | Acceso a «Mi horario» y «Mis cursos» | Asistencia y notas aún no existen; no se muestran datos inventados |
| Menú del docente con «Mis cursos» (DO-05) | «Mis cursos» está dentro de «Inicio» | DO-05 es del aula virtual; aquí solo se conserva la lista de cursos asignados de US14 |
| AP-05: «Tutora: Ana Vega» y tarjeta «Útiles para mañana» | No están | El tutor y los útiles no son parte de US48 |
| AP-05 y AL-02: «Hoy: miércoles» / «Clase en curso» resaltada | Se resalta la columna de hoy | La clase en curso depende de la hora y no la pide ninguna historia |
| AL-01: «Ahora / Siguiente», últimos logros y asistencia | Cinco accesos; notas, asistencia y notificaciones como «Próximamente» | US49 pide un panel solo con accesos; notas y asistencia aún no existen |
| AL-05: clases virtuales, materiales y trabajos | Lista de cursos con su docente | Es lo que pide el encargo para «Mis cursos»; lo demás llega con el aula virtual |
| Menú del alumno sin «Notificaciones» (campana en la barra superior) | Igual, más un acceso «Notificaciones · Próximamente» en el panel | US49 lo nombra entre los accesos del panel |
| Vista del celular en la página «2 · Prototipo móvil» | Pestañas por día y barra lateral plegable, sin seguir un frame | El encargo pide usar la página de escritorio; la vista móvil se resolvió con el mismo estilo |

## Accesibilidad

- La cuadrícula es una `table` con `caption`, cabeceras de columna (días) y de fila (horas). La columna de hoy lleva `aria-current="date"`.
- Las pestañas del celular usan `role="tablist"`, `role="tab"` con `aria-selected` y un `tabpanel` asociado; la de hoy se anuncia como «Miércoles (hoy)».
- El botón de menú y el de cerrar tienen `aria-label`; el ítem activo del menú, `aria-current="page"`.

## Pendiente

- PDF del horario (botón «Descargar PDF» del Figma).
- «Mis notas», «Mi asistencia» y «Notificaciones» del alumno; «Asistencia» y «Registro de notas» del docente.
- Dibujar en el Figma la vista por día del celular y el modal «Crear acceso al portal» de AD-06, que no tienen frame.
