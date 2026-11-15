# Casos de prueba · Sprint 3, bloque 2: edición de datos de personas con auditoría (US69)

Pantalla AD-06 «Usuarios» (`/admin/usuarios`): acciones «Ver detalle» y «Editar» de cada fila, que abren el modal de la persona (detalle con historial, edición en dos pasos y baja). API: [comunidad.md](../api/comunidad.md#edición-y-baja-de-personas-us69-rf03-pantalla-ad-06); ejemplos en [comunidad.http](../api/comunidad.http) (bloques 28 a 39). Pantalla: [frontend-acceso-y-usuarios.md](../frontend-acceso-y-usuarios.md#ad-06--detalle-edición-y-baja-de-personas-us69).
Las reglas puras se prueban además con Vitest (`tests/comunidad/edicion.test.ts`). El cambio de correo con sesiones, la auditoría y la baja se prueban en `tests/comunidad/edicionPersonas.integracion.test.ts`, que corre en el CI con PostgreSQL.

**Precondición común (PC):** sesión iniciada como Administrador (`admin@kubo.edu.pe`) con la contraseña ya cambiada. Seed cargado. Solo datos ficticios (RNF14):
- **Rosa Elvira Huamán Peña**, DNI 42345678, apoderada con cuenta y el correo mal escrito `rosa.huaman@corre.pe`. Ya ingresó al sistema y está vinculada a su hijo **Diego Quispe Rojas** (estudiante, con matrícula).
- **Carmen Julia Rojas Medina**, DNI 40125578, docente con cuenta, con un curso asignado.
- **Pedro Demo Sinuso**, DNI 43210987, apoderado recién registrado: nunca ingresó y no tiene vínculos.

Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y muestra el mensaje).

## US69 · Edición de datos de personas

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US69-01 | US69 | básico | PC | 1. En AD-06 buscar «Huamán». 2. Clic en «Ver detalle» (ojo). | — | Modal «Detalle de la persona» con sus datos (correo, teléfono, dirección, fecha de nacimiento, ocupación, DNI, nombres y apellidos), sus perfiles, el estado de la cuenta y «Historial de cambios». Sin cambios previos: «Aún no se registran cambios en los datos de esta persona…». |
| CP-US69-02 | US69 | básico | CP-US69-01 | 1. «Editar». 2. Corregir el correo. 3. «Revisar cambios». | `rosa.huaman@correo.pe` | El paso «Confirmar cambios» muestra **solo** «Correo» con el valor anterior tachado y el nuevo. Aparece el aviso «Cambia el correo con el que ingresa a Kubo». No pide motivo. |
| CP-US69-03 | US69 | básico | CP-US69-02; Rosa con una sesión abierta en otro navegador | 1. «Guardar cambios». 2. En el otro navegador, recargar. | — | Aviso «Se actualizaron los datos de Rosa Elvira Huamán Peña. Se cerraron sus sesiones y se avisó al correo nuevo y al anterior.». La tabla muestra el correo nuevo. La sesión de Rosa vuelve al login. Ingresa con el correo nuevo y la misma contraseña; con el anterior, «Correo o contraseña incorrectos…». Llegan dos correos: al nuevo, con el correo completo; al anterior, con el nuevo enmascarado (`r***@correo.pe`). |
| CP-US69-04 | US69 | básico | CP-US69-03 | 1. «Ver detalle» de Rosa. | — | El historial muestra la fecha y hora (Lima), el administrador y «Correo: ~~rosa.huaman@corre.pe~~ → rosa.huaman@correo.pe». En `registro_auditoria`: `EDITAR_PERSONA`, `valor_anterior = {"email": …}`, `valor_nuevo = {"email": …}`, con IP y requestId. |
| CP-US69-05 | US69 | excepción | PC | 1. Editar el correo de Rosa con el de Carmen. 2. «Revisar cambios» → «Guardar cambios». | Correo de Carmen | `409 EMAIL_EN_USO` «Ese correo ya está registrado en otra cuenta.». No cambia nada: Rosa conserva su correo y sus sesiones. |
| CP-US69-06 | US69 | alterno | PC, sin `SMTP_HOST` en producción (o el servidor de correo caído) | 1. Cambiar el correo de Rosa. | — | El cambio se guarda igual. Aviso «… Se cerraron sus sesiones y no se pudo enviar alguno de los avisos por correo: comunícaselo a la persona.». `avisos` trae `false` en el que falló. |
| CP-US69-07 | US69 | básico | PC | 1. Editar teléfono, dirección, fecha de nacimiento y ocupación de Rosa. 2. Guardar. | 912 345 678 · Av. Brasil 100 · 16/08/1979 · Médica | «Confirmar cambios» lista los cuatro campos. No se cierran sus sesiones (`sesionesCerradas: false`) ni se envían correos. Una sola fila `EDITAR_PERSONA` con los cuatro campos. |
| CP-US69-08 | US69 | básico | PC | 1. Editar a Carmen. 2. Cambiar «Especialidad (docente)». | Comunicación | El formulario de Carmen muestra «Especialidad (docente)» y no «Ocupación». Se guarda y la columna «Detalle» de AD-06 muestra la especialidad nueva. |
| CP-US69-09 | US69 | básico | PC | 1. Editar a Diego. 2. Cambiar «Sexo» y «Colegio de procedencia». | Masculino · I.E. San Martín de Porres | El formulario de Diego muestra los dos campos del estudiante. Se guardan y la ficha de matrícula (US20) los muestra. |
| CP-US69-10 | US69 | excepción | PC | 1. `PATCH /comunidad/personas/{id de Carmen}` con `{ "ocupacion": "Abogada" }`. | — | `422 PERFIL_NO_APLICA` `«Ocupación» solo se edita en una persona con perfil de Apoderado.` |
| CP-US69-11 | US69 | básico | PC | 1. Editar a Rosa. 2. Cambiar el DNI. 3. «Revisar cambios». 4. Escribir el motivo. 5. Guardar. | DNI 42345679 · «El DNI se digitó mal en el registro» | El paso de confirmación pide «Motivo del cambio de identidad». Se guarda. En la auditoría el DNI queda enmascarado (`"dni": "******78"` → `"******79"`) con el motivo. El historial lo muestra igual, enmascarado. |
| CP-US69-12 | US69 | excepción | PC | 1. Cambiar los apellidos de Rosa. 2. «Guardar cambios» sin motivo. | — | La pantalla no envía: «Describe el motivo del cambio (mínimo 5 caracteres).». Por la API sin `motivo`: `422 MOTIVO_REQUERIDO` «Indica el motivo para cambiar el DNI, los nombres o los apellidos.» |
| CP-US69-13 | US69 | excepción | PC | 1. Cambiar el DNI de Rosa por el de Carmen, con motivo. | DNI 40125578 | `409 DNI_YA_REGISTRADO` «Ya existe otra persona registrada con ese DNI.». No cambia nada. |
| CP-US69-14 | US69 | excepción | PC | 1. Editar a Rosa con un DNI de 7 dígitos, un teléfono de 8 y un correo sin dominio. | 4234567 · 98765432 · `rosa@` | `400 DATOS_INVALIDOS`. La pantalla vuelve al formulario y muestra bajo cada campo: «El DNI debe tener 8 dígitos», «El número de teléfono debe tener 9 dígitos», «Formato de correo electrónico inválido». |
| CP-US69-15 | US69 | excepción | PC | 1. Borrar el correo de Rosa y guardar. 2. Borrar su teléfono y guardar. | — | `422 CORREO_REQUERIDO` «La persona tiene una cuenta: su correo no puede quedar vacío.» · `422 DATO_OBLIGATORIO` `«Teléfono» es obligatorio para el perfil de Apoderado.` |
| CP-US69-16 | US69 | alterno | PC | 1. Abrir «Editar» y no cambiar nada. | — | «Revisar cambios» está deshabilitado. Por la API con los mismos valores: `200` con `cambios: []` y no se escribe en la auditoría. |
| CP-US69-17 | US69 | alterno | PC | 1. Editar tu propia persona y cambiar tu correo. 2. Guardar. | — | El aviso de confirmación dice «Es tu propia cuenta: tendrás que volver a iniciar sesión.». Al guardar vas al login e ingresas con el correo nuevo. |
| CP-US69-18 | US69 | excepción | PC | 1. Intentar modificar o borrar una fila de `registro_auditoria` de `EDITAR_PERSONA` (SQL). | `UPDATE … SET motivo = 'x'` | La base lo rechaza: `REGISTRO_AUDITORIA_INMUTABLE`. La API no tiene ruta para editar ni borrar la bitácora. |
| CP-US69-19 | US69 | excepción | Sesión de Docente o Apoderado | 1. `GET`, `PATCH` o `DELETE /comunidad/personas/{id}` y `GET …/historial`. | — | `403 ACCESO_DENEGADO`. Sin sesión: `401 NO_AUTENTICADO`. |
| CP-US69-20 | US69 | excepción | PC | 1. `PATCH /comunidad/personas/{uuid inexistente}`. | — | `404 NO_ENCONTRADO` «La persona no existe.» |

## US69 · Eliminar o desactivar

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US69-21 | US69 | básico | PC | 1. «Ver detalle» de Pedro. 2. «Eliminar». 3. Confirmar. | — | Aviso «Se eliminó a Pedro Demo Sinuso.». Ya no aparece en AD-06. Se borran la persona, su perfil y su cuenta sin usar. Auditoría `ELIMINAR_PERSONA` con el DNI enmascarado, nombres, perfiles y `cuentaEliminada: true`. |
| CP-US69-22 | US69 | alterno | PC | 1. «Eliminar» a Rosa. | — | No se elimina: «Rosa Elvira Huamán Peña no se eliminó porque ya ingresó al sistema con su cuenta, tiene 1 vínculo entre estudiante y apoderado. Se desactivó su perfil: Apoderado.». Sus sesiones se cierran. Auditoría `DESACTIVAR_PERFIL`. El historial muestra «Se desactivó el perfil Apoderado». |
| CP-US69-23 | US69 | alterno | PC | 1. «Eliminar» a Diego. | — | No se elimina (tiene vínculo, matrícula y, si pagó, pagos): se desactiva su perfil de estudiante. La matrícula y los pagos no cambian. |
| CP-US69-24 | US69 | alterno | PC | 1. «Eliminar» a Carmen. | — | No se elimina (tiene asignaciones de cursos): se desactiva su perfil Docente. Ya no aparece para elegir como tutor ni para asignar cursos. |
| CP-US69-25 | US69 | alterno | Carmen también es apoderada (dos perfiles activos) | 1. «Eliminar». 2. En «Perfil a retirar», «Solo Docente». 3. Confirmar. | — | Solo se desactiva el perfil Docente; conserva el de Apoderado y puede volver a ingresar con él. Sin registros asociados tampoco se elimina a la persona, porque conserva otro perfil. |
| CP-US69-26 | US69 | excepción | PC | 1. `DELETE /comunidad/personas/{tu propia persona}`. | — | `422 OPERACION_NO_PERMITIDA` «No puedes eliminar tu propio registro.». En tu propio detalle no aparece «Eliminar». |
| CP-US69-27 | US69 | excepción | CP-US69-22 | 1. `DELETE` otra vez sobre Rosa. | — | `409 PERFILES_YA_INACTIVOS` «La persona tiene registros asociados y sus perfiles ya están desactivados: no se puede eliminar.» |
| CP-US69-28 | US69 | excepción | PC | 1. `DELETE /comunidad/personas/{id de Rosa}?perfil=DOCENTE`. | — | `422 PERFIL_NO_ACTIVO` «La persona no tiene activo el perfil de Docente.» |
| CP-US69-29 | US69 | alterno | CP-US69-22 | 1. Registrar otra vez a Rosa como apoderada (AD-08) con el mismo DNI. | — | Se reactiva su perfil Apoderado (US15) sin duplicar la persona y puede volver a ingresar. |

## Casos unitarios (Vitest)

| Archivo | Qué cubre |
|---|---|
| `tests/comunidad/edicion.test.ts` | Campos que cambian (solo los enviados y distintos); motivo obligatorio para DNI, nombres y apellidos; datos de un perfil que la persona no tiene; correo y datos obligatorios que no pueden quedar vacíos; DNI enmascarado y valores de la auditoría; lectura del historial; plan de baja (eliminar o desactivar, un solo perfil, baja propia); esquema Zod del `PATCH` y del `DELETE`. |
| `tests/identidad/reglas.test.ts` | Correo enmascarado para el aviso a la dirección anterior. |
| `tests/comunidad/edicionPersonas.integracion.test.ts` | Con base de datos: el cambio de correo actualiza la cuenta, aumenta `version_sesion`, revoca las sesiones (el token de acceso y el de refresco dejan de valer) y permite ingresar solo con el correo nuevo; auditoría `EDITAR_PERSONA` e historial; bitácora inmutable; `EMAIL_EN_USO`; DNI con motivo, repetido y enmascarado; edición sin cambios; baja que desactiva (cuenta usada) y baja que elimina (sin registros); baja propia. |
