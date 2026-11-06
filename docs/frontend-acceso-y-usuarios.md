# Frontend · Acceso y administración de usuarios (Fase 1)

Pantallas construidas a partir del Figma **Kubo – Prototipo** y conectadas a la API de identidad.
Las capturas de referencia del Figma están en `docs/figma/`.

## Pantallas y rutas

| Figma | Ruta | Qué hace |
|---|---|---|
| AC-01 · Iniciar sesión | `/login` | Login con correo y contraseña, «Recordarme», enlace a recuperar |
| AC-02 · Credenciales incorrectas | `/login` | Alerta roja al fallar el login |
| AC-03 · Cuenta bloqueada | `/login` | Alerta ámbar y botón con contador «Esperar mm:ss min» |
| AC-08 · Elección de perfil *(por diseñar)* | `/login` | Si la cuenta tiene más de un perfil, elige con cuál ingresar |
| AC-04 · Recuperar contraseña | `/recuperar` | Envía el enlace y muestra «Solicitud enviada» |
| AC-06 · Restablecer contraseña | `/restablecer?token=…` | Enlace válido (con minutos restantes) o expirado; requisitos en vivo |
| AC-09 · Cambiar contraseña *(por diseñar)* | `/cambiar-password` | Obligatorio en el primer ingreso; también voluntario desde el menú |
| AC-07 · Acceso denegado | `/acceso-denegado` | Página 403 con «Volver a mi inicio» |
| AD-01 · Inicio administrador | `/admin` | Bienvenida y acceso a Usuarios (los indicadores llegan con los otros módulos) |
| AD-06 · Usuarios | `/admin/usuarios` | KPIs, pestañas por rol, búsqueda, filtro de estado, tabla paginada |
| M-04 · Suspender acceso | modal en AD-06 | Motivo, detalle, notificar por correo |
| Reactivar acceso *(por diseñar)* | modal en AD-06 | Motivo opcional |
| Registrar administrador *(por diseñar)* | modal en AD-06 | Crea persona, perfil y cuenta; muestra la contraseña temporal una vez |
| — | `/inicio` | Inicio temporal para Docente, Apoderado y Alumno |

## Archivos

```
src/app/globals.css                  Tokens de color, sombras y fuente (Tailwind v4)
src/app/layout.tsx                   Fuente IBM Plex Sans, idioma es
src/app/page.tsx                     / → /login
src/app/login/page.tsx               AC-01, AC-02, AC-03, AC-08
src/app/recuperar/page.tsx           AC-04
src/app/restablecer/page.tsx         AC-06
src/app/cambiar-password/page.tsx    AC-09
src/app/acceso-denegado/page.tsx     AC-07
src/app/inicio/page.tsx              Inicio temporal de otros perfiles
src/app/(portal)/admin/layout.tsx    Portal del administrador (guardia + barra lateral + barra superior)
src/app/(portal)/admin/page.tsx      AD-01
src/app/(portal)/admin/usuarios/page.tsx   AD-06
src/components/ui/index.tsx          Icono, Logo, Alerta, Campo, CampoPassword, Casilla, Boton, Badge, Tarjeta, Modal, ChecklistPassword
src/components/acceso/index.tsx      Panel de marca del login y página centrada con tarjeta
src/components/admin/PortalAdmin.tsx Barra lateral (minimizable), barra superior, contexto de sesión
src/components/admin/usuarios.tsx    Badges, avatar y modales de AD-06
src/lib/api.ts                       Cliente de la API (renueva la sesión sola), tipos y rutas por rol
src/lib/formato.ts                   «Hoy, 07:41», «Ayer, 20:15», cuenta regresiva
public/figma/*.svg                   Íconos, logos y decoración exportados del Figma (65 archivos)
scripts/descargar-assets-figma.mjs   Descarga esos SVG desde el Figma
```

## Cómo protege las páginas

- Las páginas `/admin/*` piden `GET /api/v1/identidad/sesion` al cargar:
  - Sin sesión → `/login`.
  - Debe cambiar contraseña → `/cambiar-password`.
  - Otro perfil → `/acceso-denegado`.
- La seguridad real está en el backend: cada endpoint vuelve a validar el rol (RNF01). El frontend solo evita mostrar pantallas que no corresponden.
- Si el token de acceso vence (15 min), `src/lib/api.ts` renueva la sesión una vez y repite la solicitud sin que el usuario lo note.

## Diferencias con el Figma (y por qué)

| En el Figma | En el código | Motivo |
|---|---|---|
| Botones «PROTOTIPO · INGRESAR COMO» en AC-01 | No se incluyen | Son navegación del prototipo; en el sistema real saltarían el login |
| Botón «Exportar» en AD-06 | No se incluye | Decisión D7: las exportaciones CSV están fuera de alcance |
| Insignia «Año 2026 · Bimestre III en curso» | No se muestra | Depende del módulo académico; no se muestran datos inventados |
| Notas de los KPI («26 con carga asignada», «Último: 30/07/2026») | «Con perfil activo» | Esos datos dependen de módulos que aún no existen |
| «Registrar apoderado» y «Registrar docente» | Visibles pero deshabilitados; se agregó «Registrar administrador» | Los registros de docente y apoderado son de la fase del módulo comunidad |
| Acciones «Ver» y «Editar» de la tabla | Deshabilitadas | Pantallas de detalle y edición pendientes |
| Opciones del motivo de suspensión | Lista propuesta (el Figma solo muestra una) | Validar la lista con el equipo de Figma |
| Texto de la alerta «Suspensión de accesos» | Usa el mensaje real del backend | Que lo que ve el usuario coincida con lo que dice la alerta |
| Menú lateral: módulos no construidos | Se ven atenuados y no navegan | Se habilitan a medida que se construyan |
| AC-07 dentro del portal del usuario (barra lateral y superior) | Página centrada con el logo | Los portales de docente, apoderado y alumno aún no existen |

## Requisitos

- Next.js con **Tailwind CSS v4**, que es lo que instala `create-next-app`. Si el proyecto usara Tailwind v3, hay que mover los tokens de `@theme` a `tailwind.config`.
- La fuente IBM Plex Sans se descarga de Google Fonts la primera vez que se compila, así que necesita internet.

---

# AD-07 · Registrar docente y asignar cursos (US13, US14)

Pantalla `/admin/usuarios/registrar-docente`, según el frame **AD-07 · Registrar docente y asignar cursos** del Figma (captura en `docs/figma/AD-07-registrar-docente.png`). Se llega con el botón «Registrar docente» de AD-06, que ya está habilitado.

## Archivos

```
src/app/(portal)/admin/usuarios/registrar-docente/page.tsx   AD-07: registro y orden de los bloques
src/components/admin/docentes.tsx                             Datos personales, acceso al sistema, vista previa
                                                              del correo y carga académica
src/app/inicio/page.tsx                                       «Mis cursos» del docente (US14, criterio 1)
src/components/ui/index.tsx                                   Boton variante «exito» (verde, «+ Asignar»)
```

## Qué muestra

- **1 · Datos personales:** nombres, apellidos, DNI, fecha de nacimiento, correo institucional («Aquí se enviarán las credenciales de acceso.»), teléfono celular y especialidad. Los errores aparecen bajo cada campo, también los del backend («Ya existe un usuario registrado con este DNI»).
- **DNI ya registrado (defecto D-07):** al completar los 8 dígitos se consulta `GET /comunidad/personas?dni=`.
  - Si la persona ya es docente activa, aparece bajo el DNI «Ya existe un usuario registrado con este DNI» y no se registra.
  - Si existe con otro perfil, una alerta dice «Este DNI ya está registrado: Nombre Apellido (Perfiles). Se le agregará el perfil Docente con sus datos actuales.»; nombres, apellidos y correo se llenan con los registrados y quedan bloqueados, y el botón pasa a «Agregar perfil Docente». Si ya tiene cuenta, «Acceso al sistema» dice que ingresará con su contraseña actual y no se muestra la vista previa del correo.
  - Al cambiar el DNI se liberan los campos llenados.
- **Acceso al sistema:** avatar, nombre, correo y perfil Docente; «Temporal · se genera al guardar»; la casilla «Enviar correo de bienvenida con credenciales» y los avisos del primer ingreso. Al registrar se muestra una sola vez la contraseña temporal.
- **Vista previa del correo:** el mismo texto que envía identidad, con la contraseña oculta.
- **2 · Carga académica:**
  - Se elige docente (el recién registrado u otro ya existente), año, sección y curso, y luego «Asignar».
  - La tabla muestra curso, sección, horas por semana, horario («Publicado» o «Sin horario») y la papelera.
  - Un contador muestra «n secciones · h h/sem».
  - Los errores del backend aparecen en una alerta, como en el frame.

## Diferencias con el Figma (y por qué)

| En el Figma | En el código | Motivo |
|---|---|---|
| Carga académica editable antes de registrar | Se habilita al registrar (o al elegir un docente existente) | La asignación necesita al docente ya creado; así cada asignación se valida y audita por separado |
| Sin selector de docente ni de año | «Docente» y «Año académico» en la carga académica | US14: asignar cursos a cualquier docente y elegir el año (por defecto, el de `anioPorDefecto`) |
| Orden «Curso» y luego «Sección» | «Sección» y luego «Curso» | El curso se elige entre los del plan de estudios del grado de la sección |
| Alerta de choque de horario con «Ver horario» | Alerta con el mensaje del backend, sin «Ver horario» | El módulo de horarios aún no existe |
| Especialidad libre en un desplegable | Desplegable con las áreas curriculares | No hay catálogo de especialidades; las áreas cubren las del colegio |
| «Registrar docente» abajo, una sola vez | Tras registrar cambia a «Terminar» | La pantalla sigue abierta para asignar cursos |
| Insignia «Año 2026 · Bimestre III en curso» | Se muestra con datos reales del año por defecto | Sprint 2 (barra superior común del portal) |
| Sin búsqueda del DNI | Alerta de persona ya registrada, campos bloqueados y «Agregar perfil Docente» | Defecto D-07 (Sprint 2) |

# AD-08 · Registrar apoderado (US15) y AD-09 · Registrar estudiante (US17)

Pantallas `/admin/usuarios/registrar-apoderado` y `/admin/usuarios/registrar-estudiante`, según los frames **AD-08 · Registrar apoderado** y **AD-09 · Registrar estudiante** de la página «1 · Prototipo escritorio - Propuesta» del Figma (capturas en `docs/figma/AD-08-registrar-apoderado.png` y `docs/figma/AD-09-registrar-estudiante.png`). Se llega con los botones «Registrar apoderado» y «Registrar estudiante» de AD-06, y entre ellas con «Registrar apoderado» (AD-09) y «Registrar un estudiante» (AD-08).

## Archivos

```
src/app/(portal)/admin/usuarios/registrar-apoderado/page.tsx    AD-08: datos del apoderado, estudiantes a cargo,
                                                                 resumen y acceso al portal
src/app/(portal)/admin/usuarios/registrar-estudiante/page.tsx   AD-09: datos del estudiante, apoderados vinculados,
                                                                 validaciones, «Guardar» y «Guardar como borrador»
src/components/admin/apoderados.tsx                              Buscador por DNI o nombre, fila de vínculo
                                                                 (parentesco, principal, autorizado), validaciones
```

## Qué muestra

- **AD-08 · Paso 1 · Datos del apoderado:** DNI con «Validar DNI» (consulta `GET /comunidad/personas?dni=`), nombres, apellidos, fecha de nacimiento, ocupación, correo, teléfono celular y dirección, todos obligatorios.
  - DNI de una persona con otro perfil: alerta «Esta persona ya está registrada como Docente» y se precargan y bloquean nombres y apellidos; el botón pasa a «Agregar perfil Apoderado».
  - DNI que ya es apoderado: alerta ámbar «Ya existe un apoderado registrado con este DNI» con cuántos estudiantes tiene; los datos quedan bloqueados y el botón pasa a «Vincular estudiantes» (no se crea un duplicado). Lo mismo ocurre si el backend responde `APODERADO_EXISTENTE` al guardar.
  - Teléfono de menos de 9 dígitos: «El número de teléfono debe tener 9 dígitos» bajo el campo.
- **AD-08 · Paso 2 · Estudiantes a cargo:** buscador de estudiantes ya registrados (DNI o nombre) con «Vincular»; cada estudiante agregado pide parentesco, «Apoderado principal» y «Autorizado», y dice quién es el principal actual o si lo reemplazará.
- **AD-08 · Resumen y Acceso al portal:** apoderado, estudiantes por vincular, el rol Apoderado, el usuario (correo), la casilla del correo de bienvenida y, al guardar, la contraseña temporal una sola vez.
- **AD-09 · Datos del estudiante:** nombres, apellidos, DNI («8 dígitos. No puede repetirse entre estudiantes.»), fecha de nacimiento, sexo (opcional), grado de ingreso, colegio de procedencia (opcional) y dirección (opcional). Al completar el DNI se consulta la persona: si ya es estudiante, «Ya existe un estudiante registrado con este DNI» bajo el campo; si tiene otro perfil, se precargan sus nombres.
- **AD-09 · Apoderados vinculados:** buscador de apoderados (DNI o nombre); cada uno con parentesco, principal y autorizado. El primero queda como principal; marcar a otro desmarca al anterior. Sin apoderados, al guardar aparece «Debe asociar al menos un apoderado antes de continuar».
- **AD-09 · Validaciones:** «DNI con 8 dígitos», «DNI no registrado», «Apoderado vinculado» (con el principal) y «Datos obligatorios completos», en verde, rojo o pendiente.
- **AD-09 · Guardar / Guardar como borrador:** «Guardar» registra al estudiante con sus vínculos; «Guardar como borrador» además deja su matrícula «En proceso» (sin sección ni cronograma) y el aviso dice en qué año.

## Diferencias con el Figma (y por qué)

| En el Figma | En el código | Motivo |
|---|---|---|
| AD-08: «Parentesco» en los datos del apoderado | Parentesco, principal y autorizado en cada estudiante vinculado | Son datos del vínculo (`VinculoApoderado`): un apoderado puede ser madre de uno y tutora de otro |
| AD-08: fecha de nacimiento y dirección sin `*`, sin ocupación | Todos obligatorios y con «Ocupación» | El Backlog (US15) pide DNI, nombres, apellidos, fecha de nacimiento, correo, teléfono, dirección y ocupación; manda el Backlog |
| AD-08: formulario «Nuevo estudiante» dentro del paso 2 | El paso 2 solo vincula estudiantes ya registrados; «Registrar un estudiante» lleva a AD-09 | US17 exige un apoderado existente y su propio formulario y validaciones; así hay un solo registro de estudiantes |
| AD-08: «Guardar y matricular» | «Guardar apoderado» (o «Agregar perfil Apoderado» / «Vincular estudiantes») | La matrícula en sección es del bloque 3 (US18) |
| AD-08: «Registrar un estudiante suelto» en el resumen | «Registrar un estudiante» tras guardar | Mismo motivo: el estudiante se registra en AD-09 |
| AD-08: vínculo «principal» automático para todos | El principal se elige por vínculo; si el estudiante no tenía, el nuevo lo es | Cada estudiante tiene exactamente un principal (US17) |
| AD-09: «Guardar y matricular» y pasos 2 y 3 activos | «Guardar» y los pasos 2 y 3 en gris | La matrícula en sección y el cronograma son del bloque 3 |
| AD-09: menú lateral con «Matrícula» activo | «Usuarios» activo y «Volver a Usuarios» | El módulo Matrícula aún no tiene pantalla; el frame también vuelve a Usuarios |
| AD-09: «Dirección» sin indicar si es opcional | «Dirección (opcional)» | El Backlog no la pide para el estudiante |
