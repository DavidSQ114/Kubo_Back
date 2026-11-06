# API · Comunidad: usuarios, administradores, docentes y personas por DNI (Fase 1, US13, D-07)

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
- Es reutilizable: el registro de apoderados y estudiantes (bloque 2) usará `buscarPersonaPorDni(dni)` y, dentro de su transacción, `personaParaPerfil(tx, { dni, nombres, apellidos })`, que devuelve la persona existente (verificando los nombres) o `null` para crearla.
- **Asignar cursos al docente (US14):** es de académico, porque `asignacion_docente` es suya. Ver [academico.md](academico.md#asignación-de-cursos-a-docentes-us14).

## Códigos de error

| Código | HTTP | Cuándo |
|---|---|---|
| `DATOS_INVALIDOS` | 400 | Falta un campo o tiene formato incorrecto (`details` = mensaje por campo) |
| `NO_AUTENTICADO` · `SESION_INVALIDA` | 401 | Sin sesión o sesión vencida (ver [identidad.md](identidad.md)) |
| `CAMBIO_PASSWORD_REQUERIDO` · `ACCESO_DENEGADO` | 403 | Debe cambiar su contraseña, o el rol activo no es `ADMINISTRADOR` |
| `YA_ES_ADMINISTRADOR` · `EMAIL_EN_USO` | 409 | La persona ya tiene el perfil, o el correo pertenece a otra cuenta |
| `DOCENTE_EXISTENTE` | 409 | «Ya existe un usuario registrado con este DNI»: el DNI ya tiene perfil Docente activo |
| `PERSONA_NO_COINCIDE` | 409 | «El DNI ya pertenece a otra persona (Nombre Apellido). Verifica el DNI.» |
| `ERROR_INTERNO` | 500 | Error no controlado; `details.requestId` sirve para buscarlo en el log |

## Auditoría (RF03)

Se registran en `registro_auditoria`: `REGISTRAR_ADMINISTRADOR`, `REACTIVAR_PERFIL_ADMINISTRADOR`, `REGISTRAR_DOCENTE` y `REACTIVAR_PERFIL_DOCENTE`, con el administrador responsable, valor anterior y nuevo, IP y requestId.
