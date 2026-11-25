# Casos de prueba · Sprint 4, bloque M1: Coordinador académico, separación de accesos, administrador y «Mi perfil»

Portales del Administrador (`/admin`) y del Coordinador académico (`/coordinador`), AD-06 «Usuarios», «Espacios» (`/admin/espacios`), «Parámetros del sistema» (`/admin/parametros`), AD-16 «Auditoría y errores» y «Mi perfil» (`/perfil`). Accesos por endpoint: [ACCESOS.md](../ACCESOS.md). Pantallas: [frontend-coordinador.md](../frontend-coordinador.md). API: [comunidad.md](../api/comunidad.md), [identidad.md](../api/identidad.md) y [academico.md](../api/academico.md#parámetros-del-sistema-bloque-m1).

Pruebas automáticas:

- `tests/identidad/reglas.test.ts` (sin base): `ROLES` con el Coordinador académico; cuenta bloqueada mientras `bloqueadoHasta` sea posterior a ahora (también justo al vencer).
- `tests/comunidad/edicion.test.ts` (sin base): alcance de la edición: el administrador modifica a cualquiera; el coordinador, solo a quien tiene perfiles de alumno o apoderado.
- `tests/academico/parametros.test.ts` (sin base): validación por tipo (hora HH:MM, entero con límites, decimal entre 0 y 1, monto) y coherencia (inicio antes que la hora límite, aviso previo menor que la alerta).
- `tests/comunidad/perfil.test.ts` (sin base): qué cambia y qué se audita en «Mi perfil».
- `tests/identidad/accesos.integracion.test.ts` (PostgreSQL, en el CI): el administrador recibe 403 en una ruta de cada módulo del coordinador; el coordinador, en usuarios, cuentas, aulas, asistencia docente y errores; lecturas compartidas; `PERSONA_FUERA_DE_ALCANCE`.
- `tests/identidad/administracion.integracion.test.ts` (PostgreSQL, en el CI): desbloqueo con auditoría y 409, parámetros (403, 400 por tipo y auditoría con valor anterior y nuevo) y bitácora de operaciones auditadas.
- `tests/comunidad/miPerfil.integracion.test.ts` (PostgreSQL, en el CI): 401, DNI enmascarado, rechazo del correo, el DNI y un teléfono inválido, y auditoría `ACTUALIZAR_PERFIL` solo si algo cambia.
- Las pruebas de notas y rectificación comprueban que el aviso llega al coordinador del seed (`coordinacion@kubo.edu.pe`).

**Precondición común (PC):** seed cargado: administrador `admin@kubo.edu.pe` y coordinadora `coordinacion@kubo.edu.pe` (DNI 00000001), los dos con la contraseña inicial del seed ya cambiada. Año **2026** «En curso». Docente **Juan Pérez Salazar**; apoderada **Carmen Quispe** con su hijo **Diego Quispe Rojas** (1° A). Solo datos ficticios (RNF14).

Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y muestra el mensaje).

## Rol y perfil del Coordinador académico (fase 1)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M1-01 | básico | PC; sesión del administrador | 1. «Usuarios». 2. «Registrar coordinador». 3. Llenar el formulario. 4. «Registrar». | DNI 45879632, Lucía Ramos Vega, `lramos@colegio.test`, 987654321, «Coordinación de secundaria» | «Registro de coordinador académico completo» con la contraseña temporal (se muestra una sola vez) y «Enviamos sus credenciales a lramos@colegio.test». En la lista, pestaña «Coordinadores», aparece con la insignia «Coordinador académico» y estado «Pendiente». Auditoría `REGISTRAR_COORDINADOR`. |
| CP-M1-02 | alterno | Una persona ya registrada como apoderada | Registrar coordinador con su DNI. | DNI de Carmen Quispe | Se le agrega el perfil sin duplicar sus datos: «La persona ya estaba registrada…» y «Ya tenía una cuenta…». En el login, Carmen elige entre «Apoderado» y «Coordinador académico» (AC-08). |
| CP-M1-03 | excepción | CP-M1-01 | Registrar otra vez el mismo DNI como coordinador. | DNI 45879632 | `409 YA_ES_COORDINADOR` «Esta persona ya tiene el perfil de Coordinador académico.» |
| CP-M1-04 | excepción | PC | Registrar coordinador con un correo de otra cuenta. | `admin@kubo.edu.pe` | `409 EMAIL_EN_USO` «Ese correo ya está registrado en otra cuenta.» |
| CP-M1-05 | básico | CP-M1-01 | Iniciar sesión con la cuenta nueva y cambiar la contraseña temporal. | — | Tras AC-09 entra a `/coordinador`: inicio con «Hola, Lucía», la tarjeta del usuario dice «Coordinador académico» y el menú de coordinación. |

## Separación de accesos en el servidor (fase 2)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M1-06 | excepción | Sesión del administrador | Por la API: `GET /academico/cursos`, `GET /matricula/matriculas`, `GET /horarios/secciones/{id}`, `GET /evaluacion/rectificaciones`. | — | `403 ACCESO_DENEGADO` «No tiene permisos para acceder a este recurso.» en las cuatro. |
| CP-M1-07 | excepción | Sesión del coordinador | Por la API: `GET /comunidad/usuarios`, `POST /comunidad/coordinadores`, `POST /identidad/usuarios/{id}/suspender`, `POST /academico/aulas`, `GET /horarios/asistencia-docente`, `GET /identidad/errores`, `GET /identidad/auditoria`, `GET /academico/parametros`. | — | `403 ACCESO_DENEGADO` en todas. |
| CP-M1-08 | básico | Sesiones de los dos | `GET /academico/aulas`, `GET /comunidad/docentes`, `GET /academico/areas`, `GET /academico/anios`. | — | `200` para los dos (lecturas compartidas). |
| CP-M1-09 | excepción | Sesión del coordinador | Por la API, `PATCH /comunidad/personas/{id}` de Juan Pérez (docente). | `{ "telefono": "987654321" }` | `403 PERSONA_FUERA_DE_ALCANCE` «Solo el administrador puede modificar los datos de docentes, administradores y coordinadores.» Sin cambios en la persona. |
| CP-M1-10 | básico | Sesión del coordinador | «Alumnos y apoderados» → Carmen Quispe → «Ver detalle» → «Editar» → cambiar su teléfono → «Revisar cambios» → «Guardar cambios». | 912345678 | Se guarda; auditoría `EDITAR_PERSONA` con el valor anterior y el nuevo. El detalle de un docente no ofrece «Editar» ni «Eliminar». |
| CP-M1-11 | básico | Un docente cierra un bimestre (US39) o pide una rectificación (US41) | Revisar la campana y el correo. | — | El aviso llega a los coordinadores activos con enlace a `/coordinador/notas`; ya no a los administradores. El docente ve «Se avisó por correo a n de n coordinadores académicos». |

## Portales (fase 3)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M1-12 | básico | Sesión del administrador | Revisar el menú y el inicio. | — | Menú: Inicio, Usuarios, Espacios, Parámetros del sistema, Asistencia docente, Auditoría y errores. El inicio muestra una tarjeta por pantalla, sin «Próximamente». |
| CP-M1-13 | básico | Sesión del coordinador | Revisar el menú y el inicio. | — | Menú: Inicio; Año y bimestres, Grados y secciones, Cursos y competencias, Reglas de evaluación, Asignaciones docentes; Matrícula, Alumnos y apoderados, Pensiones y pagos, Morosidad; Horarios, Asistencia de alumnos, Notas y rectificaciones, Bitácora de notas. Inicio con sus tarjetas. |
| CP-M1-14 | alterno | Sesión del coordinador | Abrir `/admin/pagos?estudiante={id}&anio={id}` (un enlace guardado). | — | Redirige a `/coordinador/pagos?estudiante=…&anio=…` con el estudiante elegido. Igual con `/admin/anio`, `/admin/grados`, `/admin/matricula`, etc. |
| CP-M1-15 | excepción | Sesión del coordinador | Escribir `/admin/usuarios` en la barra de direcciones. | — | Vuelve a `/coordinador` (su inicio), sin mostrar la pantalla ajena. Lo mismo un administrador en `/coordinador/matricula` (vuelve a `/admin`) y un docente en `/apoderado` (vuelve a `/docente`). |
| CP-M1-16 | básico | Sesión del coordinador; docente Juan Pérez sin cursos | «Asignaciones docentes» → elegir a Juan Pérez → asignar «Matemática» en 1° A. | — | La carga académica muestra la asignación y las horas. En «Registrar docente» del administrador ya no aparece la carga académica: «El coordinador académico le asignará sus cursos». |
| CP-M1-17 | básico | Sesión del coordinador | «Alumnos y apoderados» → «Registrar estudiante» → completar → «Guardar y matricular». | Estudiante ficticio con su apoderada | Pasa a «Matrícula» con el estudiante elegido. Desde «Usuarios» del administrador, el mismo formulario dice «Guardar estudiante» y no ofrece «Matricular en sección». |
| CP-M1-18 | básico | Sesión del coordinador | «Bitácora de notas». | — | La bitácora de cambios de notas (US03) con sus filtros. En AD-16 del administrador ya no está la pestaña «Cambios de notas». |

## Administrador (fase 4)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M1-19 | básico | Sesión del administrador | «Espacios» → «Nueva aula» → llenar → «Guardar». | «Aula 201», 2.° piso, aforo 30 | Aparece en la tabla con «Sin sección». Editar el aforo y desactivarla también funciona; al coordinador la desactivada ya no se le ofrece al armar una sección. |
| CP-M1-20 | excepción | Sesión del coordinador | «Grados y secciones». | — | No hay botón «Nueva aula» ni tabla de aulas: solo se elige el aula al crear o editar una sección. Si no hay aulas activas: «El administrador registra las aulas en “Espacios”». |
| CP-M1-21 | básico | Una cuenta bloqueada: 5 contraseñas incorrectas seguidas (AC-03) | Sesión del administrador: «Usuarios» → buscar la cuenta. | — | Junto al estado aparece la insignia «Bloqueada por intentos» y la acción «Desbloquear» (llave). |
| CP-M1-22 | básico | CP-M1-21 | «Desbloquear» → motivo opcional → «Desbloquear». | «Verificó su identidad por teléfono» | «Se desbloqueó la cuenta de …»; la insignia desaparece y la persona entra de inmediato con su contraseña. En la base, `intentos_fallidos` = 0 y `bloqueado_hasta` = null; el estado no cambia. Auditoría `DESBLOQUEAR_USUARIO` con los valores anteriores. |
| CP-M1-23 | excepción | Cuenta sin bloqueo (o con el bloqueo ya vencido) | Por la API, `POST /identidad/usuarios/{id}/desbloquear`. | — | `409 USUARIO_NO_BLOQUEADO` «La cuenta no está bloqueada por intentos fallidos.» |
| CP-M1-24 | básico | Sesión del administrador | «Parámetros del sistema» → «Intentos fallidos antes del bloqueo» → 4 → «Guardar». | 4 | «Se actualizó…»; la fila muestra la fecha de actualización. A partir de ahora el bloqueo llega al cuarto intento. Auditoría `ACTUALIZAR_PARAMETRO` con `{ valor: 5 }` → `{ valor: 4 }`. |
| CP-M1-25 | excepción | Sesión del administrador | Guardar valores inválidos. | Intentos: 4.5 · Hora límite: 8 am · Umbral: 20 · Pensión sugerida: -5 | Mensajes bajo cada campo: «Ingresa un número entero entre 3 y 10.», «Ingresa una hora válida en formato HH:MM (por ejemplo, 07:30).», «Ingresa un decimal mayor que 0 y menor que 1 (por ejemplo, 0.15 para 15 %).», «Ingresa un monto mayor a 0…». Nada se guarda. |
| CP-M1-26 | excepción | Sesión del administrador | Poner la hora de inicio de la jornada en 08:30 (la límite es 08:00). | 08:30 | «La hora de inicio de la jornada debe ser anterior a la hora límite de asistencia.» |
| CP-M1-27 | básico | CP-M1-22 y CP-M1-24 | «Auditoría y errores» → «Operaciones auditadas» → filtrar «Desbloquear usuario». | — | La fila con fecha, el correo del administrador, la acción y el motivo; «Ver cambios» muestra el valor anterior y el nuevo. «Errores del sistema» sigue en su pestaña. |

## Mi perfil (fase 5, todos los roles)

| ID | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|
| CP-M1-28 | básico | Sesión de cualquier perfil | En la tarjeta del usuario del menú, «Mi perfil». | — | `/perfil` con nombres, apellidos, DNI enmascarado (`******01`), correo, roles (el que está en uso, resaltado) y último ingreso; «Cambiar contraseña» y «Volver a mi portal». |
| CP-M1-29 | básico | CP-M1-28 | Cambiar el teléfono y la dirección → «Guardar cambios». | 912345678 · «Jr. Ficticio 456, Lima» | «Tus datos de contacto se guardaron.» Auditoría `ACTUALIZAR_PERFIL` con el valor anterior y el nuevo de cada campo cambiado. Guardar sin cambios no audita. |
| CP-M1-30 | excepción | CP-M1-28 | Teléfono de 6 dígitos. Por la API, `PATCH /comunidad/mi-perfil` con `email` o `dni`. | 987654 | «El número de teléfono debe tener 9 dígitos» bajo el campo; por la API, `400 DATOS_INVALIDOS` «Revisa los datos ingresados.» con el detalle «Solo puedes cambiar tu teléfono y tu dirección. El correo y el DNI los cambia el administrador.» Sin sesión, `401`. |
