# Casos de prueba · Inicio de sesión (US01), recuperación (US02), perfil (US53), cambio de contraseña (US54) y suspensión (US16)

Pantallas AC-01 a AC-09 (`/login`, `/recuperar`, `/restablecer`, `/cambiar-password`, `/acceso-denegado`) y AD-06 «Usuarios» (`/admin/usuarios`), y la API de identidad.
Las reglas puras se prueban además en `tests/identidad/reglas.test.ts`.

**Precondición común (PC):** base de pruebas con el seed cargado; administrador `admin@kubo.edu.pe` activo y con la contraseña ya cambiada; parámetros `MAX_INTENTOS_LOGIN = 5` y `MINUTOS_BLOQUEO = 15`. Todos los datos son ficticios.
Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y muestra el mensaje).

## US01 · Inicio de sesión administrativo

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US01-01 | US01 | básico | PC | 1. Abrir `/login`. 2. Ingresar correo y contraseña. 3. «Iniciar sesión». | admin@kubo.edu.pe y su contraseña, «Recordarme en este equipo» sin marcar | Ingresa al inicio del administrador (AD-01). Se crea una sesión de 12 h; el token de acceso dura 15 min y se renueva solo. |
| CP-US01-02 | US01 | alterno | PC | 1. Iniciar sesión marcando «Recordarme en este equipo». 2. Cerrar y volver a abrir el navegador. | Mismas credenciales | Sigue con la sesión iniciada: con esa opción la sesión dura 7 días. |
| CP-US01-03 | US01 | excepción | PC | 1. Iniciar sesión con contraseña incorrecta. | admin@kubo.edu.pe, «Clave999» | 401 `CREDENCIALES_INVALIDAS`. Alerta roja (AC-02): «Correo o contraseña incorrectos. Verifica tus datos e inténtalo nuevamente.» No se crea sesión. |
| CP-US01-04 | US01 | excepción | PC | 1. Iniciar sesión con un correo no registrado. | noexiste@kubo.edu.pe | El mismo mensaje de CP-US01-03: no indica cuál de los dos campos falló. |
| CP-US01-05 | US01 | excepción | PC | 1. Presionar «Iniciar sesión» con los campos vacíos o un correo mal escrito. | «admin@» | No se envía. Mensajes bajo los campos: «Ingresa tu correo», «Ingresa tu contraseña» o «Ingresa un correo válido». |
| CP-US01-06 | US01 | excepción | PC; 0 intentos fallidos | 1. Ingresar 5 veces una contraseña incorrecta. 2. Intentar de nuevo con la contraseña correcta. | 5 contraseñas incorrectas | Al 5.º fallo la cuenta se bloquea: 423 `CUENTA_BLOQUEADA`, alerta ámbar (AC-03) «Cuenta bloqueada temporalmente por seguridad» con «Intente nuevamente en 15 minutos.» y botón con cuenta regresiva. El intento con la contraseña correcta también se rechaza. |
| CP-US01-07 | US01 | alterno | Cuenta bloqueada por CP-US01-06 | 1. Esperar 15 minutos. 2. Iniciar sesión con la contraseña correcta. | — | Ingresa normalmente y el contador de intentos vuelve a 0. |
| CP-US01-08 | US01 | alterno | PC | 1. Fallar 3 veces. 2. Ingresar bien. 3. Fallar 4 veces más. | — | No se bloquea: un ingreso correcto reinicia el contador de intentos fallidos. |
| CP-US01-09 | US01 | excepción | Sin sesión iniciada | 1. Abrir `/admin`. 2. Llamar a la API sin token. | — | La pantalla redirige a `/login`. La API responde 401 `NO_AUTENTICADO`: «Tu sesión expiró. Vuelve a iniciar sesión.» |
| CP-US01-10 | US01 | excepción | Sesión con perfil Docente | 1. Abrir `/admin/usuarios`. 2. Llamar a una API del administrador. | — | Redirige a «Acceso denegado» (AC-07). La API responde 403 `ACCESO_DENEGADO`. |
| CP-US01-11 | US01 | alterno | Sesión iniciada hace más de 15 min | 1. Navegar a otra pantalla del administrador. | — | La sesión se renueva sola con el token de refresco y la pantalla carga sin pedir login otra vez. |
| CP-US01-12 | US01 | básico | Sesión iniciada | 1. «Cerrar sesión» en la barra lateral. 2. Volver atrás con el navegador. | — | La sesión queda revocada y vuelve a `/login`; al ir atrás no se muestran datos. |

## US02 · Recuperación de contraseña

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US02-01 | US02 | básico | PC | 1. En `/login`, «¿Olvidaste tu contraseña?». 2. Ingresar el correo. 3. «Enviar enlace de recuperación». | admin@kubo.edu.pe | Alerta «Solicitud enviada»: «Si el correo existe, recibirás un enlace de recuperación. El enlace vence en 30 minutos.» Llega el correo «Kubo · Recupera tu contraseña» con un enlace único. |
| CP-US02-02 | US02 | excepción | PC | 1. Solicitar el enlace con un correo no registrado. | noexiste@kubo.edu.pe | Mismo mensaje que CP-US02-01; no se envía correo. No se confirma ni se niega la existencia del correo. |
| CP-US02-03 | US02 | excepción | PC | 1. Solicitar el enlace con un correo mal escrito. | «admin@kubo» | No se envía. Mensaje: «Ingresa un correo válido». |
| CP-US02-04 | US02 | básico | Enlace recibido hace menos de 30 min | 1. Abrir el enlace. | — | Pantalla AC-06 con «Enlace válido · vence en N min» y los requisitos de contraseña en vivo. |
| CP-US02-05 | US02 | básico | CP-US02-04 | 1. Ingresar y confirmar una contraseña válida. 2. «Guardar nueva contraseña». 3. Iniciar sesión con la nueva. | «NuevaClave2026» | Se restablece y se puede ingresar con la nueva contraseña. Si la cuenta estaba bloqueada por intentos, se desbloquea. |
| CP-US02-06 | US02 | excepción | Enlace generado hace más de 30 min | 1. Abrir el enlace. | — | 410 `ENLACE_EXPIRADO`: «El enlace ha expirado. Solicita uno nuevo.» |
| CP-US02-07 | US02 | excepción | Enlace ya usado en CP-US02-05 | 1. Abrir el mismo enlace otra vez. | — | «El enlace ha expirado. Solicita uno nuevo.»: cada enlace sirve una sola vez. |
| CP-US02-08 | US02 | excepción | CP-US02-04 | 1. Ingresar una contraseña sin mayúscula ni número. | «clavesegura» | No se restablece. «La nueva contraseña no cumple los requisitos.», con «Al menos una mayúscula» y «Al menos un número» marcados en la lista. |
| CP-US02-09 | US02 | excepción | CP-US02-04 | 1. Escribir una confirmación distinta. | «NuevaClave2026» / «NuevaClave2027» | No se restablece. Mensaje: «Las contraseñas no coinciden». |
| CP-US02-10 | US02 | excepción | Usuario suspendido con un enlace vigente | 1. Abrir el enlace. | — | «El enlace ha expirado. Solicita uno nuevo.»: un usuario suspendido no puede restablecer su acceso. |

## US53 · Selección de perfil de ingreso

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US53-01 | US53 | básico | Persona con perfiles Administrador y Docente activos | 1. Iniciar sesión. | Credenciales correctas | Antes del panel aparece la elección de perfil (AC-08) con los dos perfiles. |
| CP-US53-02 | US53 | básico | CP-US53-01 | 1. Elegir «Administrador». | — | Ingresa a `/admin` con el rol Administrador. |
| CP-US53-03 | US53 | alterno | CP-US53-01 | 1. Elegir «Docente». | — | Ingresa al inicio del Docente (`/inicio`). |
| CP-US53-04 | US53 | alterno | Persona con un único perfil | 1. Iniciar sesión. | Credenciales correctas | No se muestra la elección: entra directo al panel de su perfil. |
| CP-US53-05 | US53 | excepción | Ingresó con el perfil Docente | 1. Abrir `/admin` o llamar a una API del administrador. | — | Acceso denegado (AC-07) y 403 `ACCESO_DENEGADO`, aunque la persona también sea administradora. |
| CP-US53-06 | US53 | básico | Ingresó como Administrador; también es Docente | 1. En la barra lateral, «Ingresar como Docente». | — | Cambia de perfil sin cerrar sesión y abre el inicio del Docente. |
| CP-US53-07 | US53 | excepción | Sesión con un solo perfil | 1. Pedir por la API un perfil que no tiene. | `{ "rol": "APODERADO" }` | 403 `PERFIL_NO_DISPONIBLE`: «No tienes ese perfil en tu cuenta.» |
| CP-US53-08 | US53 | excepción | CP-US53-01, sin elegir | 1. Esperar a que venza el token de selección. 2. Elegir un perfil. | — | 401 `SELECCION_EXPIRADA`: «Pasó demasiado tiempo. Vuelve a iniciar sesión.» |
| CP-US53-09 | US53 | excepción | Cuenta sin ningún perfil activo | 1. Iniciar sesión. | Credenciales correctas | 403 `SIN_PERFIL`: «Tu cuenta no tiene un perfil activo. Comunícate con la administración del colegio.» |

## US54 · Cambio de contraseña

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US54-01 | US54 | básico | Cuenta creada por el administrador, con contraseña temporal | 1. Iniciar sesión con la contraseña temporal. | Contraseña temporal del correo de bienvenida | Redirige a `/cambiar-password` («Crea tu contraseña personal») antes de cualquier módulo. |
| CP-US54-02 | US54 | excepción | CP-US54-01, sin cambiar la contraseña | 1. Abrir `/admin` o llamar a otra API. | — | Vuelve a `/cambiar-password`. API: 403 `CAMBIO_PASSWORD_REQUERIDO` «Debes cambiar tu contraseña antes de continuar.» |
| CP-US54-03 | US54 | básico | CP-US54-01 | 1. Ingresar la temporal y una nueva válida. 2. «Guardar nueva contraseña». | «Docente2026» | Se guarda, la cuenta pasa de «Pendiente» a «Activo» y abre su panel. |
| CP-US54-04 | US54 | básico | Sesión abierta en dos navegadores | 1. En el navegador A, «Cambiar contraseña» en la barra lateral. 2. Guardar una nueva válida. 3. Usar el navegador B. | «OtraClave2026» | A sigue con la sesión iniciada; en B: «Tu sesión ya no es válida. Vuelve a iniciar sesión.» (se cierran las demás sesiones). |
| CP-US54-05 | US54 | excepción | Sesión iniciada | 1. Ingresar mal la contraseña actual. | Actual «Clave999» | No se cambia. 400 `PASSWORD_ACTUAL_INCORRECTA`: «La contraseña actual no es correcta.» |
| CP-US54-06 | US54 | excepción | Sesión iniciada | 1. Ingresar una nueva que no cumple la política. | «abc123» | No se cambia. «La nueva contraseña no cumple los requisitos.», con «Mínimo 8 caracteres» y «Al menos una mayúscula» sin cumplir. |
| CP-US54-07 | US54 | excepción | Sesión iniciada | 1. Ingresar como nueva la misma contraseña actual. | La actual | No se cambia. «La nueva contraseña debe ser distinta de la actual.» |
| CP-US54-08 | US54 | excepción | Sesión iniciada | 1. Escribir una confirmación distinta. | «Clave2026A» / «Clave2026B» | No se envía. Mensaje: «Las contraseñas no coinciden». |

## US16 · Suspensión de accesos

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US16-01 | US16 | básico | PC; usuario de prueba activo | 1. En «Usuarios», ícono de suspender del usuario. 2. Elegir el motivo y escribir el detalle. 3. «Suspender acceso». | Motivo «Docente o personal que dejó la institución» | Estado «Suspendido» en la tabla y en los KPI. Auditoría `SUSPENDER_USUARIO` con el motivo. |
| CP-US16-02 | US16 | básico | CP-US16-01 | 1. El usuario suspendido inicia sesión con sus credenciales correctas. | — | 403 `CUENTA_SUSPENDIDA`: «Tu acceso está suspendido. Comunícate con la administración del colegio.» |
| CP-US16-03 | US16 | alterno | El usuario tenía una sesión abierta al ser suspendido | 1. Desde esa sesión, abrir otra pantalla. | — | La sesión se cerró al suspenderlo: «Tu sesión ya no es válida. Vuelve a iniciar sesión.» |
| CP-US16-04 | US16 | alterno | PC | 1. Suspender marcando «Notificar al usuario por correo electrónico». | — | Además, el usuario recibe «Kubo · Tu acceso fue suspendido» con el motivo. |
| CP-US16-05 | US16 | excepción | PC | 1. Suspender sin indicar motivo. | Motivo vacío | No se suspende. Mensaje: «Indica el motivo». |
| CP-US16-06 | US16 | excepción | PC | 1. Suspender la propia cuenta (API). | id del administrador en sesión | 422 `OPERACION_NO_PERMITIDA`: «No puedes suspender tu propia cuenta.» |
| CP-US16-07 | US16 | excepción | Usuario ya suspendido | 1. Suspenderlo otra vez (API). | — | 409 `USUARIO_YA_SUSPENDIDO`: «El usuario ya tiene el acceso suspendido.» |
| CP-US16-08 | US16 | básico | Usuario suspendido | 1. Ícono de reactivar. 2. «Reactivar acceso». 3. El usuario inicia sesión con su contraseña original. | — | Estado «Activo» y puede ingresar normalmente. Auditoría `REACTIVAR_USUARIO`. |
| CP-US16-09 | US16 | excepción | Usuario activo | 1. Reactivarlo (API). | — | 409 `USUARIO_NO_SUSPENDIDO`: «El usuario no está suspendido.» |
| CP-US16-10 | US16 | excepción | Sesión de un perfil que no es Administrador | 1. Llamar a suspender o reactivar. | — | 403 `ACCESO_DENEGADO`; el estado no cambia. |
