# API · Comunidad: usuarios y administradores (Fase 1)

Base: `/api/v1` · Formato: JSON · Éxito `{ "data": … }` · Error `{ "error": { "code", "message", "details" } }`
El `message` de los errores ya está redactado para mostrarse al usuario (RNF09).

Todas las rutas de este módulo exigen sesión con el rol `ADMINISTRADOR`. La sesión, las cookies y qué hacer ante un `401` o un `403` están en [identidad.md](identidad.md). Suspender y reactivar una cuenta también son de identidad.

## Endpoints

### Administración de usuarios · solo `ADMINISTRADOR`

| Método y ruta | Cuerpo / consulta | Respuesta `data` |
|---|---|---|
| `GET /comunidad/usuarios` | `?q=&rol=&estado=&pagina=1&tamano=20` | `{ items: UsuarioListado[], paginacion: { pagina, tamano, total, paginas } }` |
| `GET /comunidad/usuarios/resumen` | — | `{ todos, administradores, docentes, apoderados, alumnos, suspendidos }` |
| `POST /comunidad/administradores` | `{ dni, nombres, apellidos, email, telefono?, cargo? }` | `201 { personaId, usuarioId, nombreCompleto, email, personaExistia, cuentaCreada, correoEnviado, passwordTemporal }` |

- `q` busca por nombre, apellido, DNI (desde el inicio) o correo; varias palabras se combinan.
- `rol`: `ADMINISTRADOR` · `DOCENTE` · `APODERADO` · `ALUMNO`. `estado`: `ACTIVO` · `PENDIENTE_ACTIVACION` · `SUSPENDIDO` · `SIN_CUENTA`.
- `UsuarioListado`: `{ personaId, usuarioId, nombreCompleto, iniciales, email, dni, roles, detalle, estado, ultimoAccesoEn }`.
- `passwordTemporal` solo se devuelve en esa respuesta (para entregarla si el correo no llega). No se guarda en ningún lugar.
- Si el DNI ya existe, se reutiliza la persona (RF46) y solo se agrega el perfil.

## Códigos de error

| Código | HTTP | Cuándo |
|---|---|---|
| `DATOS_INVALIDOS` | 400 | Falta un campo o tiene formato incorrecto (`details` = mensaje por campo) |
| `NO_AUTENTICADO` · `SESION_INVALIDA` | 401 | Sin sesión o sesión vencida (ver [identidad.md](identidad.md)) |
| `CAMBIO_PASSWORD_REQUERIDO` · `ACCESO_DENEGADO` | 403 | Debe cambiar su contraseña, o el rol activo no es `ADMINISTRADOR` |
| `YA_ES_ADMINISTRADOR` · `EMAIL_EN_USO` | 409 | La persona ya tiene el perfil, o el correo pertenece a otra cuenta |
| `ERROR_INTERNO` | 500 | Error no controlado; `details.requestId` sirve para buscarlo en el log |

## Auditoría (RF03)

Se registran en `registro_auditoria`: `REGISTRAR_ADMINISTRADOR` y `REACTIVAR_PERFIL_ADMINISTRADOR`, con el administrador responsable, valor anterior y nuevo, IP y requestId.
