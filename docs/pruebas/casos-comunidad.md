# Casos de prueba · Registro de docentes (US13) y asignación de cursos a docentes (US14)

Pantallas AD-06 «Usuarios» (`/admin/usuarios`), AD-07 «Registrar docente» (`/admin/usuarios/registrar-docente`) y el inicio del docente (`/inicio`). API en [comunidad.md](../api/comunidad.md) y [academico.md](../api/academico.md).
Las reglas puras se prueban además en `tests/comunidad/docentes.test.ts` y `tests/academico/asignaciones.test.ts`.

**Precondición común (PC):**
- Sesión iniciada como Administrador (`admin@kubo.edu.pe`) con la contraseña ya cambiada.
- Seed cargado y año 2026 «En matrícula» o «En curso».
- Secciones 1° A y 3° B activas.
- Matemática y Comunicación con plan en 1° (6 h y 5 h).
- Todos los datos son ficticios.

Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y muestra el mensaje).

## US13 · Registro de docentes

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US13-01 | US13 | básico | PC; DNI no registrado | 1. En «Usuarios», «Registrar docente». 2. Llenar «Datos personales». 3. «Registrar docente». | Juan Carlos Pérez Salazar, DNI 45872136, juan.perez@kubo.edu.pe, Matemática, 987 654 321 | Aviso «Juan Carlos Pérez Salazar ya es docente» con «Enviamos sus credenciales a juan.perez@kubo.edu.pe.». Se muestra la contraseña temporal una sola vez. Cuenta «Pendiente». Auditoría `REGISTRAR_DOCENTE`. |
| CP-US13-02 | US13 | básico | CP-US13-01 | 1. Iniciar sesión como el docente con la contraseña temporal. | Contraseña del correo | Pide cambiar la contraseña antes de entrar (US54). Antes de cambiarla, la API responde 403 «Debes cambiar tu contraseña antes de continuar.» |
| CP-US13-03 | US13 | excepción | CP-US13-01 | 1. Registrar otro docente con el mismo DNI. | DNI 45872136 | No se registra. Mensaje bajo el DNI: «Ya existe un usuario registrado con este DNI». |
| CP-US13-04 | US13 | alterno | Persona con perfil Apoderado (o Administrador), DNI 71000001 | 1. Registrar un docente con ese DNI. | DNI 71000001, correo nuevo, Comunicación | Aviso «Se agregó el perfil Docente a una persona ya registrada.». Conserva sus nombres y datos, tiene los dos perfiles y una sola cuenta (si ya tenía cuenta, no se crea otra ni se muestra contraseña). |
| CP-US13-05 | US13 | excepción | PC | 1. Registrar con un correo mal escrito. | juan.perez@ | No se registra. Mensaje bajo el correo: «Formato de correo electrónico inválido». |
| CP-US13-06 | US13 | excepción | PC | 1. Registrar con el correo de otra cuenta. | admin@kubo.edu.pe | No se registra. Mensaje bajo el correo: «Ese correo ya está registrado en otra cuenta.» |
| CP-US13-07 | US13 | excepción | PC | 1. Registrar con un DNI de 7 dígitos. | 4587213 | No se registra. Mensaje: «El DNI debe tener 8 dígitos». |
| CP-US13-08 | US13 | excepción | PC | 1. Registrar con un teléfono de 8 dígitos. | 98765432 | No se registra. Mensaje: «El teléfono debe tener 9 dígitos». |
| CP-US13-09 | US13 | excepción | PC | 1. Registrar sin especialidad. | — | No se registra. Mensaje: «Elige la especialidad». |
| CP-US13-10 | US13 | alterno | PC | 1. Desmarcar «Enviar correo de bienvenida con credenciales». 2. Registrar. | — | Se registra sin enviar el correo: «No se envió el correo a …: entrégale la contraseña temporal.» |
| CP-US13-11 | US13 | básico | CP-US13-01 | 1. Ir a «Grados, secciones y aulas» y abrir el selector «Tutor». | — | El docente nuevo aparece en la lista. |

## US14 · Asignación de cursos a docentes

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US14-01 | US14 | básico | CP-US13-01 | 1. En «Carga académica», elegir año 2026, sección y curso. 2. «Asignar». | 1° A, Matemática | Aviso «Se asignó Matemática en 1° A.». La tabla muestra Matemática, 1° A, 6 h, «Sin horario» y «1 sección · 6 h/sem». Auditoría `ASIGNAR_CURSO_DOCENTE`. |
| CP-US14-02 | US14 | alterno | PC | 1. Elegir un docente ya registrado en «Docente». 2. Asignarle un curso. | Docente existente, 1° A, Comunicación | Se asigna igual que en CP-US14-01. |
| CP-US14-03 | US14 | excepción | CP-US14-01 | 1. Asignar otra vez Matemática en 1° A al mismo docente. | — | No se asigna. Alerta: «Este docente ya tiene asignado este curso en esta sección». |
| CP-US14-04 | US14 | excepción | CP-US14-01 | 1. Asignar Matemática en 1° A a otro docente. | Otro docente | No se asigna. Alerta: «Este curso ya tiene otro docente asignado en esta sección». |
| CP-US14-05 | US14 | excepción | Matemática sin plan en 3° | 1. Asignar Matemática en 3° B (API; en pantalla el curso no aparece para esa sección). | 3° B, Matemática | 422. Mensaje: «El curso no corresponde al grado de la sección». |
| CP-US14-06 | US14 | excepción | Sección 1° C inactiva | 1. Asignar un curso en 1° C (API; en pantalla no aparece). | 1° C | 422. Mensaje: «La sección está inactiva. Actívala antes de asignarle cursos.» |
| CP-US14-07 | US14 | excepción | Arte y Cultura inactivo | 1. Asignar Arte y Cultura (API; en pantalla no aparece). | — | 422. Mensaje: «El curso está inactivo. Actívalo en «Cursos y competencias» para asignarlo.» |
| CP-US14-08 | US14 | excepción | Docente inactivo | 1. Asignarle un curso (API). | — | 422. Mensaje: «El docente está inactivo y no puede recibir cursos.» |
| CP-US14-09 | US14 | excepción | Año 2025 «Cerrado» con sección y plan | 1. Asignar un curso en una sección de 2025 (API). | — | 422. Mensaje: «El año académico está cerrado y ya no se puede modificar.» |
| CP-US14-10 | US14 | básico | Asignación sin notas ni horario | 1. Ícono de papelera de la fila. | — | Aviso «Se quitó Matemática de 1° A.». La asignación se elimina. Auditoría `QUITAR_ASIGNACION_DOCENTE` (`ELIMINADA`). |
| CP-US14-11 | US14 | alterno | Asignación con notas registradas u horario | 1. Ícono de papelera de la fila. | — | Aviso «Se desactivó (tiene notas u horarios) …». La fila queda con `activo = false` y conserva su historia. Auditoría `QUITAR_ASIGNACION_DOCENTE` (`DESACTIVADA`). |
| CP-US14-12 | US14 | alterno | CP-US14-11 | 1. Volver a asignar el mismo curso y sección al mismo docente. | — | Se reactiva la asignación anterior (no se crea otra fila). |
| CP-US14-13 | US14 | básico | Docente con asignaciones activas y contraseña ya cambiada | 1. Iniciar sesión como el docente. | — | En el inicio aparece «Mis cursos» con cada curso, grado y sección, y año (por ejemplo «Comunicación · 1° A · 2026»). |
| CP-US14-14 | US14 | alterno | Docente sin asignaciones | 1. Iniciar sesión como el docente. | — | «Mis cursos» muestra «Aún no tienes cursos asignados. Consulta con el administrador.» |
| CP-US14-15 | US14 | excepción | Sesión con perfil Docente | 1. Llamar a `GET /academico/asignaciones` (API). | — | 403 `ACCESO_DENEGADO`: la carga académica de otros solo la ve el administrador. |
