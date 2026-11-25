# Accesos por rol a la API

> Bloque M1 · Separación estricta entre el **Administrador** y el **Coordinador académico**, aplicada en el servidor
> (`requerirSesion` en cada `route.ts`). Esta tabla se generó a partir de las rutas; si cambia un `route.ts` o un
> `accesos.ts`, se actualiza en el mismo pull request.

## Reglas

- **Administrador**: usuarios de todos los roles (listar, registrar, modificar, suspender, reactivar, desbloquear),
  espacios (aulas), parámetros del sistema, asistencia docente (US32), auditoría y errores del sistema.
- **Coordinador académico**: año, bimestres y montos, reglas de evaluación, grados, secciones y tutor, cursos,
  competencias y planes, asignaciones docentes, horarios, matrícula (registrar y modificar alumnos y apoderados,
  vínculos, retiro, traslado, ficha), pagos, estado de cuenta, morosidad, recordatorios, notas, publicaciones,
  rectificaciones, bitácora de notas y asistencia de alumnos.
- **Lecturas compartidas** (solo lectura para los dos): años y bimestres, grados, áreas, aulas, docentes, personas,
  su historial y sus vínculos.
- El coordinador modifica los datos de una persona solo si todos sus perfiles son de alumno o apoderado
  (`PERSONA_FUERA_DE_ALCANCE`, 403). Dar de baja a una persona es del administrador.
- Un rol fuera de la lista recibe **403 `ACCESO_DENEGADO`**. En la interfaz, quien entra por URL a un portal ajeno
  vuelve al inicio de su propio portal.
- Los avisos académicos (registro de notas consolidado, solicitud de rectificación) van a los coordinadores.

Las constantes de cada grupo están en `src/modules/<modulo>/accesos.ts` (`ROLES_ACADEMICO`, `ROLES_COMUNIDAD`,
`ROLES_EVALUACION`, `ROLES_HORARIOS`, `ROLES_IDENTIDAD` y `ROLES_MATRICULA`).

## academico

| Método | Endpoint | Roles |
|---|---|---|
| GET | `/api/v1/academico/anios` | Coordinador, Administrador (`ROLES_ACADEMICO.CONSULTA`) |
| POST | `/api/v1/academico/anios` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| GET | `/api/v1/academico/anios/actual` | Cualquier sesión válida |
| GET | `/api/v1/academico/anios/{id}` | Coordinador, Administrador (`ROLES_ACADEMICO.CONSULTA`) |
| PATCH | `/api/v1/academico/anios/{id}` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| DELETE | `/api/v1/academico/anios/{id}` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| POST | `/api/v1/academico/anios/{id}/estado` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| GET | `/api/v1/academico/anios/{id}/montos` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| PUT | `/api/v1/academico/anios/{id}/montos` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| GET | `/api/v1/academico/anios/{id}/periodos` | Coordinador, Administrador (`ROLES_ACADEMICO.CONSULTA`) |
| PUT | `/api/v1/academico/anios/{id}/periodos` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| GET | `/api/v1/academico/anios/{id}/reglas` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| POST | `/api/v1/academico/anios/{id}/reglas` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| GET | `/api/v1/academico/areas` | Coordinador, Administrador (`ROLES_ACADEMICO.CONSULTA`) |
| GET | `/api/v1/academico/asignaciones` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| POST | `/api/v1/academico/asignaciones` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| DELETE | `/api/v1/academico/asignaciones/{id}` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| GET | `/api/v1/academico/aulas` | Coordinador, Administrador (`ROLES_ACADEMICO.CONSULTA`) |
| POST | `/api/v1/academico/aulas` | Administrador (`ROLES_ACADEMICO.ESPACIOS`) |
| PATCH | `/api/v1/academico/aulas/{id}` | Administrador (`ROLES_ACADEMICO.ESPACIOS`) |
| POST | `/api/v1/academico/aulas/{id}/estado` | Administrador (`ROLES_ACADEMICO.ESPACIOS`) |
| GET | `/api/v1/academico/competencias` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| POST | `/api/v1/academico/competencias` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| PATCH | `/api/v1/academico/competencias/{id}` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| DELETE | `/api/v1/academico/competencias/{id}` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| GET | `/api/v1/academico/cursos` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| POST | `/api/v1/academico/cursos` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| PATCH | `/api/v1/academico/cursos/{id}` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| DELETE | `/api/v1/academico/cursos/{id}` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| POST | `/api/v1/academico/cursos/{id}/estado` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| GET | `/api/v1/academico/cursos/{id}/planes` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| PUT | `/api/v1/academico/cursos/{id}/planes` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| GET | `/api/v1/academico/grados` | Coordinador, Administrador (`ROLES_ACADEMICO.CONSULTA`) |
| GET | `/api/v1/academico/mis-cursos` | Docente |
| GET | `/api/v1/academico/parametros` | Administrador (`ROLES_ACADEMICO.PARAMETROS_SISTEMA`) |
| PUT | `/api/v1/academico/parametros/{clave}` | Administrador (`ROLES_ACADEMICO.PARAMETROS_SISTEMA`) |
| GET | `/api/v1/academico/planes/{id}/competencias` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| PUT | `/api/v1/academico/planes/{id}/competencias` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| POST | `/api/v1/academico/reglas/simular` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| GET | `/api/v1/academico/secciones` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| POST | `/api/v1/academico/secciones` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| PATCH | `/api/v1/academico/secciones/{id}` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| DELETE | `/api/v1/academico/secciones/{id}` | Coordinador (`ROLES_ACADEMICO.GESTION`) |
| POST | `/api/v1/academico/secciones/{id}/estado` | Coordinador (`ROLES_ACADEMICO.GESTION`) |

## aula-virtual

| Método | Endpoint | Roles |
|---|---|---|
| GET | `/api/v1/aula-virtual/alumno/cursos/{cursoId}` | Alumno |
| GET | `/api/v1/aula-virtual/asignaciones/{asignacionId}` | Docente |
| POST | `/api/v1/aula-virtual/asignaciones/{asignacionId}/enlaces` | Docente |
| POST | `/api/v1/aula-virtual/asignaciones/{asignacionId}/materiales` | Docente |
| POST | `/api/v1/aula-virtual/asignaciones/{asignacionId}/unidades` | Docente |
| GET | `/api/v1/aula-virtual/docente/cursos` | Docente |
| PUT | `/api/v1/aula-virtual/enlaces/{id}` | Docente |
| DELETE | `/api/v1/aula-virtual/enlaces/{id}` | Docente |
| POST | `/api/v1/aula-virtual/enlaces/{id}/ocultar` | Docente |
| POST | `/api/v1/aula-virtual/enlaces/{id}/publicar` | Docente |
| DELETE | `/api/v1/aula-virtual/materiales/{id}` | Docente |
| GET | `/api/v1/aula-virtual/materiales/{id}/archivo` | Docente, Alumno |
| POST | `/api/v1/aula-virtual/materiales/{id}/ocultar` | Docente |
| POST | `/api/v1/aula-virtual/materiales/{id}/publicar` | Docente |
| PATCH | `/api/v1/aula-virtual/unidades/{id}` | Docente |
| POST | `/api/v1/aula-virtual/unidades/{id}/mover` | Docente |

## comunidad

| Método | Endpoint | Roles |
|---|---|---|
| POST | `/api/v1/comunidad/administradores` | Administrador (`ROLES_COMUNIDAD.USUARIOS`) |
| GET | `/api/v1/comunidad/apoderados` | Administrador, Coordinador (`ROLES_COMUNIDAD.ALUMNOS_Y_APODERADOS`) |
| POST | `/api/v1/comunidad/apoderados` | Administrador, Coordinador (`ROLES_COMUNIDAD.ALUMNOS_Y_APODERADOS`) |
| POST | `/api/v1/comunidad/coordinadores` | Administrador (`ROLES_COMUNIDAD.USUARIOS`) |
| GET | `/api/v1/comunidad/docentes` | Administrador, Coordinador (`ROLES_COMUNIDAD.CONSULTA`) |
| POST | `/api/v1/comunidad/docentes` | Administrador (`ROLES_COMUNIDAD.USUARIOS`) |
| GET | `/api/v1/comunidad/estudiantes` | Administrador, Coordinador (`ROLES_COMUNIDAD.ALUMNOS_Y_APODERADOS`) |
| POST | `/api/v1/comunidad/estudiantes` | Administrador, Coordinador (`ROLES_COMUNIDAD.ALUMNOS_Y_APODERADOS`) |
| POST | `/api/v1/comunidad/estudiantes/{id}/acceso` | Administrador, Coordinador (`ROLES_COMUNIDAD.ALUMNOS_Y_APODERADOS`) |
| GET | `/api/v1/comunidad/personas` | Administrador, Coordinador (`ROLES_COMUNIDAD.CONSULTA`) |
| GET | `/api/v1/comunidad/personas/{id}` | Administrador, Coordinador (`ROLES_COMUNIDAD.CONSULTA`) |
| PATCH | `/api/v1/comunidad/personas/{id}` | Administrador, Coordinador (`ROLES_COMUNIDAD.ALUMNOS_Y_APODERADOS`) |
| DELETE | `/api/v1/comunidad/personas/{id}` | Administrador (`ROLES_COMUNIDAD.USUARIOS`) |
| GET | `/api/v1/comunidad/personas/{id}/historial` | Administrador, Coordinador (`ROLES_COMUNIDAD.CONSULTA`) |
| GET | `/api/v1/comunidad/personas/{id}/vinculos` | Administrador, Coordinador (`ROLES_COMUNIDAD.CONSULTA`) |
| GET | `/api/v1/comunidad/usuarios` | Administrador (`ROLES_COMUNIDAD.USUARIOS`) |
| GET | `/api/v1/comunidad/usuarios/resumen` | Administrador (`ROLES_COMUNIDAD.USUARIOS`) |
| POST | `/api/v1/comunidad/vinculos` | Administrador, Coordinador (`ROLES_COMUNIDAD.ALUMNOS_Y_APODERADOS`) |

## evaluacion

| Método | Endpoint | Roles |
|---|---|---|
| GET | `/api/v1/evaluacion/alumno/libreta` | Alumno |
| GET | `/api/v1/evaluacion/alumno/libreta/pdf` | Alumno |
| GET | `/api/v1/evaluacion/apoderado/hijos/{id}/libreta` | Apoderado |
| GET | `/api/v1/evaluacion/apoderado/hijos/{id}/libreta/pdf` | Apoderado |
| GET | `/api/v1/evaluacion/bitacora` | Coordinador (`ROLES_EVALUACION.GESTION`) |
| GET | `/api/v1/evaluacion/bitacora/docentes` | Coordinador (`ROLES_EVALUACION.GESTION`) |
| GET | `/api/v1/evaluacion/docente/rectificaciones` | Docente |
| GET | `/api/v1/evaluacion/evidencias/{id}/archivo` | Docente, Apoderado, Alumno |
| GET | `/api/v1/evaluacion/publicaciones` | Coordinador (`ROLES_EVALUACION.GESTION`) |
| POST | `/api/v1/evaluacion/publicaciones` | Coordinador (`ROLES_EVALUACION.GESTION`) |
| GET | `/api/v1/evaluacion/publicaciones/{cierreId}` | Coordinador (`ROLES_EVALUACION.GESTION`) |
| GET | `/api/v1/evaluacion/rectificaciones` | Coordinador (`ROLES_EVALUACION.GESTION`) |
| POST | `/api/v1/evaluacion/rectificaciones/{id}/aprobar` | Coordinador (`ROLES_EVALUACION.GESTION`) |
| POST | `/api/v1/evaluacion/rectificaciones/{id}/rechazar` | Coordinador (`ROLES_EVALUACION.GESTION`) |
| GET | `/api/v1/evaluacion/registros` | Docente |
| GET | `/api/v1/evaluacion/registros/{asignacionId}/bimestres/{periodoId}` | Docente |
| POST | `/api/v1/evaluacion/registros/{asignacionId}/bimestres/{periodoId}/cerrar` | Docente |
| POST | `/api/v1/evaluacion/registros/{asignacionId}/bimestres/{periodoId}/evidencias` | Docente |
| DELETE | `/api/v1/evaluacion/registros/{asignacionId}/bimestres/{periodoId}/evidencias/{evidenciaId}` | Docente |
| PUT | `/api/v1/evaluacion/registros/{asignacionId}/bimestres/{periodoId}/notas` | Docente |
| POST | `/api/v1/evaluacion/registros/{asignacionId}/bimestres/{periodoId}/rectificaciones` | Docente |

## horarios

| Método | Endpoint | Roles |
|---|---|---|
| GET | `/api/v1/horarios/alumno/asistencia` | Alumno |
| GET | `/api/v1/horarios/alumno/horario` | Alumno |
| GET | `/api/v1/horarios/apoderado/hijos/{id}/asistencia` | Apoderado |
| GET | `/api/v1/horarios/apoderado/hijos/{id}/horario` | Apoderado |
| GET | `/api/v1/horarios/apoderado/hijos/{id}/horario/pdf` | Apoderado |
| GET | `/api/v1/horarios/asistencia-docente` | Administrador (`ROLES_HORARIOS.ASISTENCIA_DOCENTE`) |
| POST | `/api/v1/horarios/asistencia-docente/ingreso` | Administrador (`ROLES_HORARIOS.ASISTENCIA_DOCENTE`) |
| POST | `/api/v1/horarios/asistencia-docente/salida` | Administrador (`ROLES_HORARIOS.ASISTENCIA_DOCENTE`) |
| POST | `/api/v1/horarios/asistencia-docente/{id}/justificar` | Administrador (`ROLES_HORARIOS.ASISTENCIA_DOCENTE`) |
| GET | `/api/v1/horarios/asistencia/clases-de-hoy` | Docente |
| POST | `/api/v1/horarios/asistencia/registros/{id}/corregir` | Coordinador (`ROLES_HORARIOS.GESTION`) |
| GET | `/api/v1/horarios/asistencia/sesiones` | Docente, Coordinador (`ROLES_HORARIOS.ASISTENCIA_ALUMNOS`) |
| POST | `/api/v1/horarios/asistencia/sesiones` | Docente |
| GET | `/api/v1/horarios/asistencia/sesiones/{id}` | Docente, Coordinador (`ROLES_HORARIOS.ASISTENCIA_ALUMNOS`) |
| PUT | `/api/v1/horarios/asistencia/sesiones/{id}/registros` | Docente |
| GET | `/api/v1/horarios/docentes/{id}/publicado` | Coordinador (`ROLES_HORARIOS.GESTION`) |
| GET | `/api/v1/horarios/mi-horario` | Docente |
| GET | `/api/v1/horarios/secciones/{id}` | Coordinador (`ROLES_HORARIOS.GESTION`) |
| POST | `/api/v1/horarios/secciones/{id}/borrador` | Coordinador (`ROLES_HORARIOS.GESTION`) |
| PUT | `/api/v1/horarios/secciones/{id}/clases/{dia}/{bloqueId}` | Coordinador (`ROLES_HORARIOS.GESTION`) |
| DELETE | `/api/v1/horarios/secciones/{id}/clases/{dia}/{bloqueId}` | Coordinador (`ROLES_HORARIOS.GESTION`) |
| GET | `/api/v1/horarios/secciones/{id}/ocupacion` | Coordinador (`ROLES_HORARIOS.GESTION`) |
| GET | `/api/v1/horarios/secciones/{id}/publicado` | Coordinador (`ROLES_HORARIOS.GESTION`) |
| POST | `/api/v1/horarios/secciones/{id}/publicar` | Coordinador (`ROLES_HORARIOS.GESTION`) |

## identidad

| Método | Endpoint | Roles |
|---|---|---|
| GET | `/api/v1/identidad/auditoria` | Administrador (`ROLES_IDENTIDAD.AUDITORIA`) |
| GET | `/api/v1/identidad/errores` | Administrador (`ROLES_IDENTIDAD.AUDITORIA`) |
| GET | `/api/v1/identidad/errores/{id}` | Administrador (`ROLES_IDENTIDAD.AUDITORIA`) |
| POST | `/api/v1/identidad/login` | Pública (sin sesión o con su propio token) |
| POST | `/api/v1/identidad/login/perfil` | Pública (sin sesión o con su propio token) |
| POST | `/api/v1/identidad/logout` | Pública (sin sesión o con su propio token) |
| PUT | `/api/v1/identidad/password` | Cualquier sesión válida |
| POST | `/api/v1/identidad/password/recuperar` | Pública (sin sesión o con su propio token) |
| GET | `/api/v1/identidad/password/restablecer` | Pública (sin sesión o con su propio token) |
| POST | `/api/v1/identidad/password/restablecer` | Pública (sin sesión o con su propio token) |
| POST | `/api/v1/identidad/refresh` | Pública (sin sesión o con su propio token) |
| GET | `/api/v1/identidad/sesion` | Cualquier sesión válida |
| PUT | `/api/v1/identidad/sesion/perfil` | Cualquier sesión válida |
| POST | `/api/v1/identidad/usuarios/{id}/desbloquear` | Administrador (`ROLES_IDENTIDAD.CUENTAS`) |
| POST | `/api/v1/identidad/usuarios/{id}/reactivar` | Administrador (`ROLES_IDENTIDAD.CUENTAS`) |
| POST | `/api/v1/identidad/usuarios/{id}/suspender` | Administrador (`ROLES_IDENTIDAD.CUENTAS`) |

## matricula

| Método | Endpoint | Roles |
|---|---|---|
| GET | `/api/v1/matricula/alumno/cursos` | Alumno |
| GET | `/api/v1/matricula/alumno/panel` | Alumno |
| PUT | `/api/v1/matricula/apoderado/hijo-elegido` | Apoderado |
| GET | `/api/v1/matricula/apoderado/hijos` | Apoderado |
| GET | `/api/v1/matricula/apoderado/hijos/{id}/cuotas/{cuotaId}/comprobante` | Apoderado |
| GET | `/api/v1/matricula/apoderado/hijos/{id}/pagos` | Apoderado |
| POST | `/api/v1/matricula/apoderado/pagos/intentos` | Apoderado |
| GET | `/api/v1/matricula/apoderado/pagos/intentos/{id}` | Apoderado |
| POST | `/api/v1/matricula/apoderado/pagos/intentos/{id}/simular` | Apoderado |
| GET | `/api/v1/matricula/estudiantes/{id}` | Coordinador (`ROLES_MATRICULA.GESTION`) |
| GET | `/api/v1/matricula/estudiantes/{id}/estado-cuenta` | Coordinador (`ROLES_MATRICULA.GESTION`) |
| GET | `/api/v1/matricula/matriculas` | Coordinador (`ROLES_MATRICULA.GESTION`) |
| POST | `/api/v1/matricula/matriculas` | Coordinador (`ROLES_MATRICULA.GESTION`) |
| GET | `/api/v1/matricula/matriculas/{id}` | Coordinador (`ROLES_MATRICULA.GESTION`) |
| POST | `/api/v1/matricula/matriculas/{id}/anular` | Coordinador (`ROLES_MATRICULA.GESTION`) |
| GET | `/api/v1/matricula/matriculas/{id}/ficha` | Coordinador (`ROLES_MATRICULA.GESTION`) |
| POST | `/api/v1/matricula/matriculas/{id}/pago-anual` | Coordinador (`ROLES_MATRICULA.GESTION`) |
| POST | `/api/v1/matricula/matriculas/{id}/retirar` | Coordinador (`ROLES_MATRICULA.GESTION`) |
| POST | `/api/v1/matricula/matriculas/{id}/trasladar` | Coordinador (`ROLES_MATRICULA.GESTION`) |
| GET | `/api/v1/matricula/morosidad` | Coordinador (`ROLES_MATRICULA.GESTION`) |
| POST | `/api/v1/matricula/morosidad/recordatorios` | Coordinador (`ROLES_MATRICULA.GESTION`) |
| POST | `/api/v1/matricula/pagos` | Coordinador (`ROLES_MATRICULA.GESTION`) |
| POST | `/api/v1/matricula/pagos/webhooks/pasarela` | Pública (sin sesión o con su propio token) |
| GET | `/api/v1/matricula/pagos/{id}` | Coordinador (`ROLES_MATRICULA.GESTION`) |
| POST | `/api/v1/matricula/pagos/{id}/anular` | Coordinador (`ROLES_MATRICULA.GESTION`) |
| GET | `/api/v1/matricula/pagos/{id}/comprobante` | Coordinador (`ROLES_MATRICULA.GESTION`) |
| POST | `/api/v1/matricula/pagos/{id}/confirmar` | Coordinador (`ROLES_MATRICULA.GESTION`) |
| POST | `/api/v1/matricula/pagos/{id}/descartar` | Coordinador (`ROLES_MATRICULA.GESTION`) |
| POST | `/api/v1/matricula/pagos/{id}/devolver` | Coordinador (`ROLES_MATRICULA.GESTION`) |

## notificaciones

| Método | Endpoint | Roles |
|---|---|---|
| GET | `/api/v1/notificaciones` | Cualquier sesión válida |
| POST | `/api/v1/notificaciones/marcar-leidas` | Cualquier sesión válida |
| GET | `/api/v1/notificaciones/no-leidas` | Cualquier sesión válida |

## salud

| Método | Endpoint | Roles |
|---|---|---|
| GET | `/api/v1/salud` | Pública (sin sesión o con su propio token) |
