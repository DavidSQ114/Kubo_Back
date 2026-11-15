# Casos de prueba · Sprint 3, bloque 4: el horario en los portales (US34, US48, US49, US50)

Pantallas DO-02 «Mi horario» del docente (`/docente/horario`), AP-05 «Horario» del apoderado (`/apoderado/horario`), AL-01, AL-02 y AL-05 del alumno (`/alumno`, `/alumno/horario`, `/alumno/cursos`) y «Crear acceso al portal» en AD-06. Pantallas: [frontend-portales-horario.md](../frontend-portales-horario.md). API: [horarios.md](../api/horarios.md), [matricula.md](../api/matricula.md#portal-del-alumno-us49) y [comunidad.md](../api/comunidad.md#acceso-del-alumno-al-portal-us49-pantalla-ad-06).

Las reglas puras se prueban con Vitest: `tests/comunidad/accesoAlumno.test.ts` (crear el acceso), `tests/matricula/portalAlumno.test.ts` (matrícula vigente) y `tests/horarios/portales.test.ts` (resumen del docente). El acceso por perfil y por vínculo, el 401 y el 403 de cada endpoint, el ingreso del alumno y la actualización al publicar se prueban en `tests/horarios/portales.integracion.test.ts`, que corre en el CI con PostgreSQL.

**Precondición común (PC):** seed cargado y año **2026** «En curso». Solo datos ficticios (RNF14):
- Secciones **1° A** (horario **publicado**, versión 1) y **1° B** (horario en **borrador**, sin publicar), con el mismo plan de estudios.
- Docentes con cuenta: **Karen Rivera Soto** (dicta Matemática en 1° A y 1° B), **Mónica Torres Aguilar** (Comunicación) y **un docente nuevo sin cursos asignados**.
- Apoderada **Carmen Rojas Medina**, con cuenta, vinculada a **Diego Quispe Rojas** (matriculado en 1° A) y a **Valeria Quispe Rojas** (matriculada en 1° B). Otra apoderada, **Rosa Huamán**, vinculada solo a su hijo.
- Diego y Valeria todavía **no tienen cuenta**. Un estudiante más, **Luis Paredes**, registrado y **sin matrícula**.

Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y muestra el mensaje).

## US49 · Acceso al portal del alumno

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US49-01 | US49 | básico | PC; sesión de Administrador | 1. «Usuarios», pestaña Alumnos. 2. Abrir el detalle de Diego Quispe. 3. «Crear acceso al portal». 4. Escribir el correo. 5. «Crear acceso». | `diego.quispe@ejemplo.test` | Alerta «Se creó el acceso de Diego Quispe Rojas» con «Enviamos sus credenciales a …» y la contraseña temporal de 12 caracteres, que se muestra **solo esta vez**, con «Copiar». Al cerrar, Diego figura «Pendiente de activación». Queda la auditoría `CREAR_ACCESO_ALUMNO` y sale el correo de bienvenida. |
| CP-US49-02 | US49 | básico | CP-US49-01 | 1. Cerrar sesión. 2. Ingresar con el correo de Diego y la contraseña temporal. 3. Escribir una contraseña nueva. | Contraseña que cumple la política | El sistema lo lleva primero a «Cambiar contraseña» (no deja ver nada más). Al cambiarla entra a `/alumno`: barra lateral con Inicio, Mis cursos, Mi horario, «Mis notas · Próximamente» y «Mi asistencia · Próximamente»; panel «¡Hola, Diego!» con accesos solo a Mi horario, Mis cursos, Mis notas, Mi asistencia y Notificaciones (las tres últimas, «Próximamente»). |
| CP-US49-03 | US49 | básico | Sesión de Diego | 1. «Mis cursos». | — | Una tarjeta por curso del plan de estudios de 1° A, con su código, su nombre, el docente («Karen Rivera Soto» en Matemática) y sus horas semanales. Un curso sin docente dice «Docente por asignar». |
| CP-US49-04 | US49 | excepción | Sesión de Diego | 1. Escribir en el navegador `/admin/usuarios`, luego `/docente/horario` y `/apoderado/horario`. | — | En los tres casos: pantalla «No tiene permisos para acceder a este recurso.» con «Código 403» y «Volver a mi inicio». No se muestra ningún dato del otro perfil. |
| CP-US49-05 | US49 | excepción | Sesión de Diego | 1. `GET /horarios/mi-horario`. 2. `GET /horarios/apoderado/hijos/{id de Diego}/horario`. 3. `GET /horarios/secciones/{1° A}/publicado`. 4. `POST /comunidad/estudiantes/{id}/acceso`. | — | Todos responden `403 ACCESO_DENEGADO` «No tiene permisos para acceder a este recurso.». |
| CP-US49-06 | US49 | excepción | CP-US49-01 | 1. En el login, escribir el correo de Diego y una contraseña equivocada. 2. Repetir con un correo que no existe. | — | En ambos casos: «Correo o contraseña incorrectos. Verifica tus datos e inténtalo nuevamente.» (`401 CREDENCIALES_INVALIDAS`), sin indicar cuál de los dos campos falló. |
| CP-US49-07 | US49 | excepción | CP-US49-01 | 1. Abrir otra vez el detalle de Diego. 2. `POST /comunidad/estudiantes/{id de Diego}/acceso`. | — | El detalle ya no ofrece «Crear acceso al portal». La API responde `409 ACCESO_EXISTENTE` «El estudiante ya tiene una cuenta para ingresar al portal.». No se crea otra cuenta ni cambia su contraseña. |
| CP-US49-08 | US49 | excepción | PC; sesión de Administrador | 1. Detalle de Luis Paredes (sin matrícula). 2. «Crear acceso al portal» y «Crear acceso». | Un correo libre | Mensaje «El estudiante no tiene una matrícula vigente. Confirma su matrícula antes de crear su acceso al portal.» (`422 SIN_MATRICULA_VIGENTE`). No se crea la cuenta. |
| CP-US49-09 | US49 | excepción | CP-US49-01 | 1. «Crear acceso al portal» de Valeria con el correo que ya usa Diego. | El correo de Diego | «Ese correo ya está registrado en otra cuenta.» (`409 EMAIL_EN_USO`). Valeria sigue «Sin cuenta». |
| CP-US49-10 | US49 | excepción | Sesión de Diego; el Administrador anula o retira su matrícula | 1. Volver a entrar a `/alumno`. 2. `GET /horarios/alumno/horario`, `/matricula/alumno/panel` y `/matricula/alumno/cursos`. | — | La pantalla muestra «Tu portal aún no está disponible» con «No tienes una matrícula vigente. Comunícate con la secretaría del colegio.» y «Cerrar sesión». Las tres rutas responden `403 SIN_MATRICULA_VIGENTE`. |
| CP-US49-11 | US49 | excepción | Sin sesión | 1. `GET /matricula/alumno/panel`. 2. `GET /matricula/alumno/cursos`. 3. `POST /comunidad/estudiantes/{id}/acceso`. | — | `401 NO_AUTENTICADO`. Con sesión de Docente o Apoderado: `403 ACCESO_DENEGADO`. |
| CP-US49-12 | US49 | alterno | PC; el servidor de correo no responde | 1. «Crear acceso al portal» de Valeria. | Un correo libre | La cuenta se crea igual. La alerta dice «No se pudo enviar el correo a …: entrégale la contraseña temporal.» y muestra la contraseña. |

## US34 · Horario personal del docente

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US34-01 | US34 | básico | PC; sesión de Karen Rivera | 1. Menú «Mi horario». | — | Cuadrícula semanal con «Hora» y los 5 días. Cada bloque con clase muestra «Matemática · 1° A» y el aula («Aula 101»). Solo aparecen las clases de 1° A (publicado); las del borrador de 1° B no. Debajo: «Bloques por semana» y «Secciones a cargo: 1° A». |
| CP-US34-02 | US34 | excepción | PC; sesión del docente nuevo, sin cursos | 1. Menú «Mi horario». | — | Tarjeta «Aún no tienes cursos asignados para este periodo» con «Cuando la administración te asigne cursos y publique los horarios, aparecerán aquí.». No se muestra una cuadrícula vacía. |
| CP-US34-03 | US34 | básico | CP-US34-01; el Administrador cambia el aula de una clase de 1° A y publica la versión 2 | 1. Volver a «Mi horario» (o regresar a la pestaña del navegador). | — | La clase aparece con el aula nueva, sin hacer nada más. Mientras el cambio es solo un borrador, se sigue viendo la versión 1. |
| CP-US34-04 | US34 | básico | PC; el Administrador publica el horario de 1° B | 1. Sesión de Karen Rivera. 2. «Mi horario». | — | La cuadrícula consolida las clases de 1° A y de 1° B, cada una con su sección. «Secciones a cargo: 1° A · 1° B». |
| CP-US34-05 | US34 | excepción | Sin sesión, y luego con sesión de Alumno y de Apoderado | 1. `GET /horarios/mi-horario`. | — | Sin sesión: `401 NO_AUTENTICADO`. Con otro perfil: `403 ACCESO_DENEGADO` «No tiene permisos para acceder a este recurso.». |
| CP-US34-06 | US34 | excepción | Sesión de Karen Rivera | 1. `GET /horarios/secciones/{1° B}/publicado`. 2. `GET /horarios/docentes/{id de Mónica Torres}/publicado`. | — | `403 ACCESO_DENEGADO` en ambos: un docente solo ve su propio horario. La respuesta de `/horarios/mi-horario` no contiene clases de otro docente. |
| CP-US34-07 | US34 | alterno | Sesión de Karen Rivera en un celular (390 px) | 1. Abrir el menú con el botón de la barra superior. 2. «Mi horario». | — | La barra lateral se abre sobre el contenido y se cierra al elegir. El horario se ve un día a la vez con las pestañas «Lun … Vie». |

## US48 · Horario del estudiante (apoderado)

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US48-01 | US48 | básico | PC; sesión de Carmen Rojas con Diego elegido | 1. Menú «Horario». | — | Título «Horario de clases» y «Horario semanal de Diego · 1° de secundaria, sección A». Insignia «Publicado» con la fecha. Cuadrícula semanal con el curso, el docente («K. Rivera») y el aula de cada bloque. |
| CP-US48-02 | US48 | excepción | PC; sesión de Carmen Rojas | 1. «Cambiar de hijo» y elegir a Valeria. 2. Menú «Horario». | — | Tarjeta «El horario aún no ha sido publicado por la institución», en lugar de una cuadrícula vacía. No se ven las clases del borrador de 1° B. |
| CP-US48-03 | US48 | básico | CP-US48-02; el Administrador publica el horario de 1° B | 1. Volver a «Horario» con Valeria elegida. | — | Aparece la cuadrícula de 1° B sin hacer nada más. Si luego se publica una versión nueva, la consulta siguiente la muestra. |
| CP-US48-04 | US48 | excepción | Sesión de Rosa Huamán | 1. `GET /horarios/apoderado/hijos/{id de Diego}/horario`. | El id real de Diego | `403 ESTUDIANTE_NO_VINCULADO` «No tienes acceso a la información de este estudiante.». No se devuelve el horario ni el nombre del estudiante. |
| CP-US48-05 | US48 | excepción | Sin sesión, y luego con sesión de Docente y de Alumno | 1. `GET /horarios/apoderado/hijos/{id}/horario`. | — | Sin sesión: `401 NO_AUTENTICADO`. Con otro perfil (incluso el propio alumno): `403 ACCESO_DENEGADO`. |
| CP-US48-06 | US48 | excepción | Sesión de Carmen Rojas | 1. `GET /horarios/apoderado/hijos/abc/horario`. | Id con formato inválido | `400 DATOS_INVALIDOS`. |
| CP-US48-07 | US48 | alterno | Sesión de Carmen Rojas; Diego fue retirado en el año en curso | 1. Elegir a Diego. 2. Menú «Horario». | — | Diego se sigue viendo en el portal (insignia «Retirado»), pero su horario muestra «El horario aún no ha sido publicado por la institución» con «Diego no tiene una sección con matrícula vigente en este momento.». |

## US50 · Mi horario (alumno)

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US50-01 | US50 | básico | CP-US49-02; sesión de Diego (1° A, publicado) | 1. Menú «Mi horario». | — | Título «Mi horario» y «1° de secundaria · Sección A». Insignia «Publicado» con la fecha. Cuadrícula semanal con el curso, el nombre del docente y el aula de cada bloque; la franja «RECREO · 10:00 – 10:20»; la columna de hoy resaltada. |
| CP-US50-02 | US50 | excepción | Valeria con cuenta (1° B, sin publicar); sesión de Valeria | 1. Menú «Mi horario». | — | Tarjeta «El horario aún no ha sido publicado», sin errores ni cuadrícula vacía. |
| CP-US50-03 | US50 | básico | Sesión de Diego en un celular (390 px de ancho) | 1. Abrir el menú y elegir «Mi horario». 2. Tocar la pestaña «Jue». | — | En lugar de la tabla se ve un día a la vez: pestañas «Lun · Mar · Mié · Jue · Vie» (la de hoy marcada «Hoy» y abierta al entrar) y la lista de bloques del día con hora, curso, docente y aula; los bloques libres dicen «Sin clase». No hay desplazamiento horizontal. |
| CP-US50-04 | US50 | básico | CP-US50-01; el Administrador publica una versión nueva de 1° A | 1. Volver a «Mi horario». | — | Se ve la versión nueva y la fecha «Actualizado el …» cambia. Mientras la edición es un borrador, se sigue viendo la versión anterior. |
| CP-US50-05 | US50 | excepción | Sesión de Diego | 1. Revisar la respuesta de `GET /horarios/alumno/horario`. | — | Solo trae las clases de 1° A. La ruta no acepta ningún id: no hay forma de pedir el horario de otra sección. |
| CP-US50-06 | US50 | excepción | Sin sesión, y luego con sesión de Docente y de Apoderado | 1. `GET /horarios/alumno/horario`. | — | Sin sesión: `401 NO_AUTENTICADO`. Con otro perfil: `403 ACCESO_DENEGADO` «No tiene permisos para acceder a este recurso.». |
| CP-US50-07 | US50 | excepción | Diego ingresó con la contraseña temporal y aún no la cambia | 1. `GET /horarios/alumno/horario`. | — | `403 CAMBIO_PASSWORD_REQUERIDO`. La pantalla lo lleva a «Cambiar contraseña». |
