# API · Identidad y administración de usuarios (Fase 1)

Base: `/api/v1` · Formato: JSON · Éxito `{ "data": … }` · Error `{ "error": { "code", "message", "details" } }`
El `message` de los errores ya está redactado para mostrarse al usuario (RNF09).

## Cómo funciona la sesión

- El login deja dos **cookies httpOnly**: `kubo_at` (token de acceso, 15 min) y `kubo_rt` (refresh token, 12 h; 7 días con «Recordarme»). El frontend **no** guarda tokens: el navegador envía las cookies solo.
- Cada solicitud protegida se valida contra la base de datos: si el usuario fue suspendido o cambió su contraseña, la sesión deja de servir **de inmediato** (RF05, RF43).
- Con `fetch` en el mismo dominio no hace falta configurar nada. Para Postman o REST Client también se acepta `Authorization: Bearer <token>`.

### Qué debe hacer el frontend ante cada respuesta

| Respuesta | Acción |
|---|---|
| `401 NO_AUTENTICADO` | Llamar una vez a `POST /identidad/refresh` y repetir la solicitud. Si refresh también da 401 → ir a `/login`. |
| `401 SESION_INVALIDA` | Ir a `/login` (la sesión fue cerrada, suspendida o la contraseña cambió). |
| `403 CAMBIO_PASSWORD_REQUERIDO` | Ir a la pantalla de cambio obligatorio de contraseña (AC-09). |
| `403 ACCESO_DENEGADO` | Mostrar la pantalla de acceso denegado (AC-07). |
| Login con `tipo: "SELECCION"` | Mostrar la elección de perfil (AC-08) y llamar a `POST /identidad/login/perfil`. |

## Endpoints

### Sesión

| Método y ruta | Quién | Cuerpo | Respuesta `data` |
|---|---|---|---|
| `POST /identidad/login` | Público | `{ email, password, recordar? }` | Un perfil: `{ tipo: "SESION", sesion }` + cookies. Varios: `{ tipo: "SELECCION", tokenSeleccion, perfiles, nombres }` |
| `POST /identidad/login/perfil` | Público (con `tokenSeleccion`, vence en 5 min) | `{ tokenSeleccion, rol }` | `{ tipo: "SESION", sesion }` + cookies |
| `GET /identidad/sesion` | Con sesión (también si debe cambiar contraseña) | — | `sesion` |
| `PUT /identidad/sesion/perfil` | Con sesión | `{ rol }` | `{ sesion }` (cambia de perfil sin cerrar sesión) |
| `POST /identidad/refresh` | Cookie `kubo_rt` | — | `{ renovado: true }` + cookies nuevas |
| `POST /identidad/logout` | Cualquiera | — | `{ sesionCerrada: true }` y borra cookies |

Objeto `sesion`:

```json
{
  "usuario": { "id": "…", "email": "rosa.huaman@kubo.edu.pe", "nombres": "Rosa", "apellidos": "Huamán Torres",
               "nombreCompleto": "Rosa Huamán Torres", "iniciales": "RH" },
  "rolActivo": "ADMINISTRADOR",
  "perfiles": ["ADMINISTRADOR", "DOCENTE"],
  "debeCambiarPassword": false
}
```

### Contraseñas

| Método y ruta | Quién | Cuerpo | Respuesta `data` |
|---|---|---|---|
| `PUT /identidad/password` | Con sesión | `{ actual, nueva, confirmacion }` | `{ mensaje }` (cierra las demás sesiones) |
| `POST /identidad/password/recuperar` | Público | `{ email }` | `{ mensaje }` (siempre igual, exista o no el correo) |
| `GET /identidad/password/restablecer?token=…` | Público | — | `{ email, expiraEn, minutosRestantes }` o `410 ENLACE_EXPIRADO` |
| `POST /identidad/password/restablecer` | Público | `{ token, nueva, confirmacion }` | `{ mensaje }` (cierra todas las sesiones) |

Política: mínimo 8 caracteres, al menos una mayúscula y un número. Si no se cumple → `400 PASSWORD_DEBIL` con `details.requisitos` (lista de lo que falta).
El enlace del correo apunta a `{APP_URL}/restablecer?token=…`: esa página debe llamar al `GET` para mostrar «vence en N min» o «El enlace ha expirado».

### Administración de usuarios · solo `ADMINISTRADOR`

| Método y ruta | Cuerpo / consulta | Respuesta `data` |
|---|---|---|
| `GET /comunidad/usuarios` | `?q=&rol=&estado=&pagina=1&tamano=20` | `{ items: UsuarioListado[], paginacion: { pagina, tamano, total, paginas } }` |
| `GET /comunidad/usuarios/resumen` | — | `{ todos, administradores, docentes, apoderados, alumnos, suspendidos }` |
| `POST /comunidad/administradores` | `{ dni, nombres, apellidos, email, telefono?, cargo? }` | `201 { personaId, usuarioId, nombreCompleto, email, personaExistia, cuentaCreada, correoEnviado, passwordTemporal }` |
| `POST /identidad/usuarios/{usuarioId}/suspender` | `{ motivo, detalle?, notificar? }` | `{ usuarioId, estado: "SUSPENDIDO" }` |
| `POST /identidad/usuarios/{usuarioId}/reactivar` | `{ motivo? }` | `{ usuarioId, estado }` |

- `q` busca por nombre, apellido, DNI (desde el inicio) o correo; varias palabras se combinan.
- `rol`: `ADMINISTRADOR` · `DOCENTE` · `APODERADO` · `ALUMNO`. `estado`: `ACTIVO` · `PENDIENTE_ACTIVACION` · `SUSPENDIDO` · `SIN_CUENTA`.
- `UsuarioListado`: `{ personaId, usuarioId, nombreCompleto, iniciales, email, dni, roles, detalle, estado, ultimoAccesoEn }`.
- `passwordTemporal` solo se devuelve en esa respuesta (para entregarla si el correo no llega). No se guarda en ningún lugar.
- Si el DNI ya existe, se reutiliza la persona (RF46) y solo se agrega el perfil.

## Códigos de error

| Código | HTTP | Cuándo |
|---|---|---|
| `DATOS_INVALIDOS` | 400 | Falta un campo o tiene formato incorrecto (`details` = mensaje por campo) |
| `PASSWORD_DEBIL` · `PASSWORD_ACTUAL_INCORRECTA` · `PASSWORD_REPETIDA` | 400 | Cambio o restablecimiento de contraseña |
| `CREDENCIALES_INVALIDAS` | 401 | Correo o contraseña incorrectos (AC-02) |
| `NO_AUTENTICADO` · `SESION_INVALIDA` · `SELECCION_EXPIRADA` | 401 | Ver tabla de acciones del frontend |
| `CUENTA_SUSPENDIDA` · `SIN_PERFIL` · `PERFIL_NO_DISPONIBLE` | 403 | Login o cambio de perfil |
| `CAMBIO_PASSWORD_REQUERIDO` | 403 | Primer ingreso de una cuenta creada por el administrador |
| `ACCESO_DENEGADO` | 403 | El rol activo no tiene permiso (AC-07) |
| `NO_ENCONTRADO` | 404 | El usuario no existe |
| `USUARIO_YA_SUSPENDIDO` · `USUARIO_NO_SUSPENDIDO` · `YA_ES_ADMINISTRADOR` · `EMAIL_EN_USO` | 409 | Conflictos de estado o datos duplicados |
| `ENLACE_EXPIRADO` | 410 | Enlace de recuperación vencido, usado o inválido (AC-06) |
| `OPERACION_NO_PERMITIDA` | 422 | Por ejemplo, suspender tu propia cuenta |
| `CUENTA_BLOQUEADA` | 423 | Superó los intentos (AC-03). `details: { minutosRestantes, bloqueadoHasta }` para el contador |
| `ERROR_INTERNO` | 500 | Error no controlado; `details.requestId` sirve para buscarlo en el log |

## Auditoría (RF03)

Se registran en `registro_auditoria`: `SUSPENDER_USUARIO`, `REACTIVAR_USUARIO`, `REGISTRAR_ADMINISTRADOR` y `REACTIVAR_PERFIL_ADMINISTRADOR`, con el administrador responsable, valor anterior y nuevo, motivo, IP y requestId.
