# API · Comunidad: usuarios, administradores, docentes, apoderados, estudiantes y personas por DNI (Fase 1, US13, US15, US17, D-07)

Base: `/api/v1` · Formato: JSON · Éxito `{ "data": … }` · Error `{ "error": { "code", "message", "details" } }`
El `message` de los errores ya está redactado para mostrarse al usuario (RNF09).

Todas las rutas de este módulo exigen sesión con el rol `ADMINISTRADOR`. La sesión, las cookies y qué hacer ante un `401` o un `403` están en [identidad.md](identidad.md). Suspender y reactivar una cuenta también son de identidad.

## Endpoints

### Administración de usuarios · solo `ADMINISTRADOR`

| Método y ruta | Cuerpo / consulta | Respuesta `data` |
|---|---|---|
| `GET /comunidad/usuarios` | `?q=&rol=&estado=&pagina=1&tamano=20` | `{ items: UsuarioListado[], paginacion: { pagina, tamano, total, paginas } }` |
| `GET /comunidad/usuarios/resumen` | — | `{ todos, administradores, docentes, apoderados, alumnos, suspendidos }` |
| `GET /comunidad/docentes` | — | `{ id, nombreCompleto, nombreCorto, activo }[]`: docentes activos, para elegir tutor de sección (US08) o asignar cursos (US14) |
| `POST /comunidad/docentes` | `{ dni, nombres, apellidos, email, especialidad, telefono?, fechaNacimiento?, enviarCorreo? }` | `201 { personaId, docenteId, usuarioId, nombreCompleto, email, especialidad, personaExistia, cuentaCreada, correoEnviado, passwordTemporal }` |
| `GET /comunidad/personas` | `?dni=` (8 dígitos) | `PersonaEncontrada` o `null` si el DNI no está registrado (D-07) |
| `POST /comunidad/administradores` | `{ dni, nombres, apellidos, email, telefono?, cargo? }` | `201 { personaId, usuarioId, nombreCompleto, email, personaExistia, cuentaCreada, correoEnviado, passwordTemporal }` |
| `GET /comunidad/apoderados` | `?q=&pagina=1&tamano=10` | `{ items: ApoderadoListado[], paginacion }`: apoderados activos por DNI o nombre (US15, AD-08 y AD-09) |
| `POST /comunidad/apoderados` | `{ dni, nombres, apellidos, fechaNacimiento, email, telefono, direccion, ocupacion, vinculos?, enviarCorreo? }` | `201 { personaId, apoderadoId, usuarioId, nombreCompleto, email, personaExistia, cuentaCreada, correoEnviado, estudiantesVinculados, passwordTemporal }` |
| `GET /comunidad/estudiantes` | `?q=&pagina=1&tamano=10` | `{ items: EstudianteListado[], paginacion }`: estudiantes activos por DNI o nombre (para vincular en AD-08) |
| `POST /comunidad/estudiantes` | `{ dni, nombres, apellidos, fechaNacimiento, gradoIngresoId, sexo?, colegioProcedencia?, direccion?, apoderados, borrador? }` | `201 { estudianteId, personaId, nombreCompleto, personaExistia, vinculos, matricula }` |
| `POST /comunidad/vinculos` | `{ estudianteId, apoderadoId, parentesco, esPrincipal?, autorizado? }` | `201 { vinculoId, esPrincipal, cambioPrincipal }` |

- `q` busca por nombre, apellido, DNI (desde el inicio) o correo; varias palabras se combinan.
- `rol`: `ADMINISTRADOR` · `DOCENTE` · `APODERADO` · `ALUMNO`. `estado`: `ACTIVO` · `PENDIENTE_ACTIVACION` · `SUSPENDIDO` · `SIN_CUENTA`.
- `UsuarioListado`: `{ personaId, usuarioId, nombreCompleto, iniciales, email, dni, roles, detalle, estado, ultimoAccesoEn }`.
- `passwordTemporal` solo se devuelve en esa respuesta (para entregarla si el correo no llega). No se guarda en ningún lugar.
- Si el DNI ya existe, se reutiliza la persona (RF46) y solo se agrega el perfil.

### Registro de docentes (US13, RF11, pantalla AD-07)

- `dni`: 8 dígitos. `email`: formato válido («Formato de correo electrónico inválido»). `especialidad`: obligatoria. `telefono`: opcional, 9 dígitos (se aceptan espacios o guiones y se guardan solo los dígitos). `fechaNacimiento`: opcional, `AAAA-MM-DD`. `enviarCorreo`: por defecto `true`.
- **Persona nueva:** crea la persona, el perfil Docente y la cuenta con contraseña temporal. La cuenta queda `PENDIENTE_ACTIVACION` y debe cambiar la contraseña en su primer ingreso (US54). Después de confirmar, envía el correo de bienvenida «Kubo · Tu cuenta fue creada».
- **DNI con perfil Docente activo:** `409 DOCENTE_EXISTENTE` «Ya existe un usuario registrado con este DNI».
- **DNI de una persona con otro perfil** (administrador, apoderado…): solo se le agrega el perfil Docente. Sus datos personales no cambian y, si ya tenía cuenta, no se crea otra (`personaExistia: true`, `cuentaCreada: false`). La pantalla avisa «Se agregó el perfil Docente a una persona ya registrada». Si tenía un perfil Docente inactivo, se reactiva.
- **Correo de otra cuenta:** `409 EMAIL_EN_USO` «Ese correo ya está registrado en otra cuenta.».
- **DNI registrado con otros nombres (D-07):** si los `nombres` o `apellidos` enviados no son los de la persona registrada (sin distinguir mayúsculas, tildes ni espacios de más), `409 PERSONA_NO_COINCIDE` «El DNI ya pertenece a otra persona (Nombre Apellido). Verifica el DNI.». Así un DNI mal escrito no le agrega el perfil a otra persona.

### Persona por DNI (defecto D-07)

- `PersonaEncontrada`: `{ personaId, dni, nombres, apellidos, nombreCompleto, email, perfiles, tieneCuenta }`. `perfiles` son los roles activos (`ADMINISTRADOR`, `DOCENTE`, `APODERADO`, `ALUMNO`). `email` es el de la persona o, si no tiene, el de su cuenta.
- AD-07 la consulta al completar los 8 dígitos del DNI:
  - si ya es docente activo, muestra bajo el DNI «Ya existe un usuario registrado con este DNI» y no registra;
  - si existe con otro perfil, avisa «Este DNI ya está registrado: Nombre Apellido (Perfiles). Se le agregará el perfil Docente con sus datos actuales.», llena y bloquea nombres, apellidos y correo, y el botón pasa a «Agregar perfil Docente».
- Es reutilizable: el registro de apoderados y estudiantes la usa con `buscarPersonaPorDni(dni)` y, dentro de su transacción, `personaParaPerfil(tx, { dni, nombres, apellidos })`, que devuelve la persona existente (verificando los nombres) o `null` para crearla.
- **Asignar cursos al docente (US14):** es de académico, porque `asignacion_docente` es suya. Ver [academico.md](academico.md#asignación-de-cursos-a-docentes-us14).

### Registro de apoderados (US15, RF12, pantalla AD-08)

- Todos los campos son obligatorios (los pide el Backlog): `dni` 8 dígitos; `nombres` y `apellidos`; `fechaNacimiento` `AAAA-MM-DD`, existente y no futura; `email` con formato válido; `telefono` de 9 dígitos («El número de teléfono debe tener 9 dígitos»; se aceptan espacios o guiones y se guardan solo los dígitos); `direccion` (5 a 200 caracteres); `ocupacion` (2 a 100). `enviarCorreo`: por defecto `true`.
- **Persona nueva:** crea la persona, el perfil Apoderado y la cuenta con rol Apoderado y contraseña temporal (`PENDIENTE_ACTIVACION`, debe cambiarla en su primer ingreso). El correo de bienvenida se envía después de confirmar; `passwordTemporal` solo viene en esta respuesta.
- **DNI de una persona con otro perfil** (por ejemplo, Docente): se le agrega el perfil Apoderado sin duplicar sus datos. Los nombres deben coincidir (`409 PERSONA_NO_COINCIDE`). Solo se **completan** los datos que la persona no tenía (teléfono, dirección, fecha de nacimiento, correo); nunca se reemplazan los registrados. Si ya tenía cuenta, no se crea otra (`cuentaCreada: false`).
- **DNI que ya es apoderado:** `409 APODERADO_EXISTENTE` «Ya existe un apoderado registrado con este DNI», con `details: { apoderadoId, nombreCompleto, estudiantes }` para que la pantalla ofrezca **vincularle un estudiante** (`POST /comunidad/vinculos`) en lugar de crear un duplicado.
- `vinculos` (opcional, hasta 10): `[{ estudianteId, parentesco, esPrincipal?, autorizado? }]` con estudiantes ya registrados; se crean en la misma transacción. El estudiante no se puede repetir (`422 ESTUDIANTE_REPETIDO`).
- `ApoderadoListado`: `{ apoderadoId, personaId, dni, nombreCompleto, telefono, email, ocupacion, estudiantes }` (`estudiantes` = vínculos).

### Registro de estudiantes (US17, RF13, pantalla AD-09)

- Obligatorios: `dni` (8 dígitos), `nombres`, `apellidos`, `fechaNacimiento` (existente y no futura), `gradoIngresoId` (un grado activo; si no, `422 GRADO_INVALIDO`). Opcionales: `sexo` (`FEMENINO` · `MASCULINO`), `colegioProcedencia` (hasta 150), `direccion` (hasta 200).
- `apoderados`: `[{ apoderadoId, parentesco, esPrincipal?, autorizado? }]`, de 1 a 6 apoderados **ya registrados**:
  - sin ninguno: `400 DATOS_INVALIDOS` con `details.apoderados` «Debe asociar al menos un apoderado antes de continuar» (el caso de uso repite la regla con `422 SIN_APODERADO`);
  - exactamente uno con `esPrincipal: true`: si no, `422 PRINCIPAL_INVALIDO` «Marca exactamente un apoderado como principal.»;
  - sin repetir (`422 APODERADO_REPETIDO`) y activos (`404 APODERADO_NO_ENCONTRADO`). `autorizado` es `true` por defecto.
- **DNI que ya es estudiante:** `409 ESTUDIANTE_EXISTENTE` «Ya existe un estudiante registrado con este DNI». Si el DNI es de una persona con otro perfil, se le agrega el perfil Estudiante con sus datos actuales (D-07).
- El estudiante **no** tiene cuenta de usuario todavía (llega con US49).
- **`borrador: true` («Guardar como borrador»):** además crea su matrícula `EN_PROCESO` en el año «En matrícula» (si no hay, en el año «En curso»), **sin sección, sin responsable de pago, sin validar vacantes y sin cronograma**. Sin año en matrícula ni en curso: `422 SIN_ANIO_EN_MATRICULA`. Si el estudiante (reactivado) ya tenía una matrícula activa en ese año: `409 MATRICULA_EXISTENTE`. Con `borrador: false` no se crea matrícula (`matricula: null`). Confirmar la matrícula es de US18 (bloque 3). La matrícula la crea el módulo `matricula` por el puerto `MatriculaBorradorProvider` de comunidad, dentro de la misma transacción.
- `EstudianteListado`: `{ estudianteId, personaId, dni, nombreCompleto, gradoIngreso, apoderados: [{ apoderadoId, nombreCompleto, parentesco, esPrincipal }] }` (el principal primero).

### Vínculos estudiante–apoderado (US15 «Vincular a un estudiante», US17)

- El parentesco, el apoderado principal y la autorización son del **vínculo**, no del apoderado. `parentesco`: `Madre` · `Padre` · `Abuela` · `Abuelo` · `Tía` · `Tío` · `Hermana` · `Hermano` · `Tutor legal` · `Otro`.
- Cada estudiante tiene **exactamente un** apoderado principal: si el nuevo vínculo es principal, el anterior deja de serlo (`cambioPrincipal: true`); si el estudiante no tenía principal, el nuevo lo es aunque no se haya marcado.
- Apoderado ya vinculado a ese estudiante: `409 VINCULO_EXISTENTE` «Este apoderado ya está vinculado al estudiante.». Estudiante o apoderado inexistente o inactivo: `404 ESTUDIANTE_NO_ENCONTRADO` / `404 APODERADO_NO_ENCONTRADO`.
- Se bloquea la fila del estudiante durante la operación para que dos vínculos simultáneos no queden ambos como principales.

## Códigos de error

| Código | HTTP | Cuándo |
|---|---|---|
| `DATOS_INVALIDOS` | 400 | Falta un campo o tiene formato incorrecto (`details` = mensaje por campo) |
| `NO_AUTENTICADO` · `SESION_INVALIDA` | 401 | Sin sesión o sesión vencida (ver [identidad.md](identidad.md)) |
| `CAMBIO_PASSWORD_REQUERIDO` · `ACCESO_DENEGADO` | 403 | Debe cambiar su contraseña, o el rol activo no es `ADMINISTRADOR` |
| `YA_ES_ADMINISTRADOR` · `EMAIL_EN_USO` | 409 | La persona ya tiene el perfil, o el correo pertenece a otra cuenta |
| `DOCENTE_EXISTENTE` | 409 | «Ya existe un usuario registrado con este DNI»: el DNI ya tiene perfil Docente activo |
| `PERSONA_NO_COINCIDE` | 409 | «El DNI ya pertenece a otra persona (Nombre Apellido). Verifica el DNI.» |
| `DNI_EN_USO` | 409 | Otra operación registró el mismo DNI al mismo tiempo; volver a validar el DNI |
| `APODERADO_EXISTENTE` | 409 | «Ya existe un apoderado registrado con este DNI» (`details.apoderadoId` para vincular) |
| `ESTUDIANTE_EXISTENTE` | 409 | «Ya existe un estudiante registrado con este DNI» |
| `VINCULO_EXISTENTE` · `MATRICULA_EXISTENTE` | 409 | El apoderado ya está vinculado al estudiante · el estudiante ya tiene matrícula activa en ese año |
| `APODERADO_NO_ENCONTRADO` · `ESTUDIANTE_NO_ENCONTRADO` | 404 | No existe o ya no está activo |
| `SIN_APODERADO` · `PRINCIPAL_INVALIDO` · `APODERADO_REPETIDO` · `ESTUDIANTE_REPETIDO` · `GRADO_INVALIDO` | 422 | Reglas de los vínculos y del grado de ingreso |
| `SIN_ANIO_EN_MATRICULA` | 422 | «Guardar como borrador» sin año en matrícula ni en curso |
| `ERROR_INTERNO` | 500 | Error no controlado; `details.requestId` sirve para buscarlo en el log |

## Auditoría (RF03)

Se registran en `registro_auditoria`: `REGISTRAR_ADMINISTRADOR`, `REACTIVAR_PERFIL_ADMINISTRADOR`, `REGISTRAR_DOCENTE`, `REACTIVAR_PERFIL_DOCENTE`, `REGISTRAR_APODERADO` (con `personaExistia` y `perfilReactivado`), `VINCULAR_APODERADO` (uno por vínculo; si cambia el principal, el valor anterior guarda el vínculo que dejó de serlo) y `REGISTRAR_ESTUDIANTE` (con `matriculaEnProcesoId` si se guardó como borrador), con el administrador responsable, valor anterior y nuevo, IP y requestId. El DNI no se escribe en la auditoría ni en los logs (el logger además oculta `dni`, `telefono`, `direccion` y `fechaNacimiento`).
