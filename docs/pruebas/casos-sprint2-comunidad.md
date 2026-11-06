# Casos de prueba · Sprint 2, bloque 2: registro de apoderados (US15) y de estudiantes (US17)

Pantallas AD-08 «Registrar apoderado» (`/admin/usuarios/registrar-apoderado`) y AD-09 «Registrar estudiante» (`/admin/usuarios/registrar-estudiante`), a las que se llega desde AD-06 «Usuarios». API: [comunidad.md](../api/comunidad.md) y ejemplos en [comunidad.http](../api/comunidad.http) (bloques 14 a 27).
Las reglas puras se prueban además con Vitest (sección «Casos unitarios»).

**Precondición común (PC):** sesión iniciada como Administrador (`admin@kubo.edu.pe`) con la contraseña ya cambiada. Seed cargado (grados 1° a 5° de secundaria). Año 2026 «En curso» y año 2027 «En matrícula». Existe la docente ficticia Carmen Julia Rojas Medina, DNI 40125578, con cuenta y sin perfil Apoderado. Solo datos ficticios (RNF14).
Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y muestra el mensaje).

## US15 · Registro de apoderados

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US15-01 | US15 | básico | PC | 1. En AD-06, «Registrar apoderado». 2. Escribir el DNI y «Validar DNI». 3. Llenar los datos. 4. «Guardar apoderado». | DNI 42345678, Rosa Elvira Huamán Peña, 15/08/1979, Enfermera, rosa.huaman@correo.pe, 987 654 320, Jr. Ayacucho 456, Breña | Aviso «Rosa Elvira Huamán Peña ya es apoderado» con «Enviamos sus credenciales a …». «Acceso al portal» muestra el rol Apoderado y la contraseña temporal una sola vez. Se crea la cuenta `PENDIENTE_ACTIVACION` con cambio de contraseña obligatorio. Auditoría `REGISTRAR_APODERADO`. |
| CP-US15-02 | US15 | excepción | PC | 1. Llenar todo con un teléfono de 8 dígitos. 2. «Guardar apoderado». | Teléfono 98765432 | No se guarda. Bajo «Teléfono celular»: «El número de teléfono debe tener 9 dígitos» (API: `400 DATOS_INVALIDOS`, `details.telefono` con el mismo mensaje). |
| CP-US15-03 | US15 | excepción | CP-US15-01 | 1. Abrir otra vez AD-08. 2. Escribir el mismo DNI y «Validar DNI». | 42345678 | Alerta ámbar «Ya existe un apoderado registrado con este DNI» con «Rosa Elvira Huamán Peña · 0 estudiante(s) vinculado(s)…». Los datos quedan bloqueados y el botón dice «Vincular estudiantes». No se puede crear un duplicado. |
| CP-US15-04 | US15 | excepción | CP-US15-01 | 1. Registrar por la API con el mismo DNI. | `POST /comunidad/apoderados` con DNI 42345678 | `409 APODERADO_EXISTENTE` «Ya existe un apoderado registrado con este DNI» con `details.apoderadoId`. Si la pantalla recibe este error al guardar, pasa sola al modo «Vincular estudiantes». |
| CP-US15-05 | US15 | básico | CP-US15-03; existe el estudiante Diego Quispe Rojas | 1. En «Paso 2», buscar «Diego». 2. «Vincular». 3. Parentesco «Madre». 4. «Vincular estudiantes». | — | Aviso «Vínculos guardados» con «… quedó vinculado a 1 estudiante(s) más.». El estudiante muestra «Vinculado». Auditoría `VINCULAR_APODERADO`. |
| CP-US15-06 | US15 | alterno | PC | 1. Escribir el DNI de la docente y «Validar DNI». 2. Completar los datos. 3. «Agregar perfil Apoderado». | DNI 40125578 | Antes de guardar: «Esta persona ya está registrada como Docente» y nombres y apellidos precargados y bloqueados. Al guardar: «Se agregó el perfil Apoderado a una persona ya registrada. Ya tenía una cuenta…»; no se muestra contraseña temporal. Sus datos personales no se reemplazan; solo se completan teléfono, dirección y fecha de nacimiento si faltaban. |
| CP-US15-07 | US15 | excepción | PC | 1. Registrar por la API con el DNI de la docente y otros nombres. | DNI 40125578, Pedro Gómez | `409 PERSONA_NO_COINCIDE` «El DNI ya pertenece a otra persona (Carmen Julia Rojas Medina). Verifica el DNI.». No se agrega ningún perfil. |
| CP-US15-08 | US15 | excepción | PC | 1. Dejar vacíos dirección y ocupación. 2. Guardar. | — | Bajo cada campo: «Ingresa la dirección» y «Ingresa la ocupación». |
| CP-US15-09 | US15 | excepción | PC | 1. Correo con formato inválido. 2. Guardar. | carmen@ | «Formato de correo electrónico inválido». |
| CP-US15-10 | US15 | excepción | Otra cuenta usa el correo | 1. Registrar con ese correo. | admin@kubo.edu.pe | Bajo el correo: «Ese correo ya está registrado en otra cuenta.» (`409 EMAIL_EN_USO`). |
| CP-US15-11 | US15 | básico | Existe la estudiante Valeria Quispe Rojas con su padre como principal | 1. Registrar un apoderado nuevo. 2. En «Paso 2», vincular a Valeria con parentesco «Tía» y sin marcar «Apoderado principal». 3. Guardar. | — | La fila decía «Principal actual: …». Se guarda con `estudiantesVinculados: 1`; el padre sigue como principal. |
| CP-US15-12 | US15 | alterno | CP-US15-11 | 1. Vincular por la API a otro apoderado de Valeria como principal. | `POST /comunidad/vinculos` con `esPrincipal: true` | `201 { esPrincipal: true, cambioPrincipal: true }`. El anterior deja de ser principal: siempre hay uno solo. La auditoría `VINCULAR_APODERADO` guarda el vínculo anterior. |
| CP-US15-13 | US15 | excepción | CP-US15-12 | 1. Repetir el mismo vínculo por la API. | — | `409 VINCULO_EXISTENTE` «Este apoderado ya está vinculado al estudiante.». |
| CP-US15-14 | US15 | excepción | PC | 1. Vincular un estudiante sin elegir el parentesco. 2. Guardar. | — | Bajo la fila: «Elige el parentesco». |
| CP-US15-15 | US15 | básico | Varios apoderados registrados | 1. Buscar por apellido y por inicio del DNI en AD-09 o con la API. | `GET /comunidad/apoderados?q=quispe` · `?q=4123` | `200 { items, paginacion }` con DNI, nombre, teléfono, ocupación y número de estudiantes. |
| CP-US15-16 | US15 | excepción | Sesión de un perfil que no es Administrador | 1. Llamar a `POST /comunidad/apoderados` o `GET /comunidad/apoderados`. | — | `403 ACCESO_DENEGADO`. |

## US17 · Registro de datos del estudiante

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US17-01 | US17 | básico | PC; apoderado Jorge Luis Quispe Huamán | 1. En AD-06, «Registrar estudiante». 2. Llenar los datos. 3. Buscar al apoderado y «Vincular». 4. Parentesco «Padre». 5. «Guardar». | Valeria Sofía Quispe Rojas, DNI 78451236, 22/04/2012, Femenino, 1° de secundaria, I.E. San Martín de Porres | Aviso «Se registró a Valeria Sofía Quispe Rojas» con «Quedó vinculado a 1 apoderado(s). Podrás matricularlo en una sección con vacantes.». Validaciones en verde. No se crea matrícula ni cuenta de usuario. Auditoría `REGISTRAR_ESTUDIANTE` y `VINCULAR_APODERADO`. |
| CP-US17-02 | US17 | excepción | PC | 1. Llenar los datos sin vincular apoderados. 2. «Guardar». | — | No se guarda. Alerta «Debe asociar al menos un apoderado antes de continuar». API: `400 DATOS_INVALIDOS` con `details.apoderados` y el mismo mensaje. |
| CP-US17-03 | US17 | excepción | CP-US17-01 | 1. Abrir AD-09. 2. Escribir el mismo DNI. | 78451236 | Bajo el DNI y en «Validaciones»: «Ya existe un estudiante registrado con este DNI». Al guardar no se envía nada. API: `409 ESTUDIANTE_EXISTENTE`. |
| CP-US17-04 | US17 | básico | PC; año 2027 «En matrícula» | 1. Llenar los datos y vincular a la apoderada. 2. «Guardar como borrador». | Luciana Huamán Peña, DNI 80123456, 12/09/2015, 1° de secundaria, Madre | Aviso «Su matrícula 2027 quedó «En proceso», sin sección ni cronograma de pagos.». En la base: matrícula `EN_PROCESO` sin sección ni responsable de pago y sin conceptos de cobro. Auditoría `REGISTRAR_ESTUDIANTE` con `matriculaEnProcesoId`. |
| CP-US17-05 | US17 | alterno | Solo 2026 «En curso» (sin año en matrícula) | 1. «Guardar como borrador». | — | La matrícula «En proceso» queda en 2026. |
| CP-US17-06 | US17 | excepción | Ningún año «En matrícula» ni «En curso» | 1. «Guardar como borrador». | — | No se guarda nada. Alerta «No hay un año académico en matrícula ni en curso…» (`422 SIN_ANIO_EN_MATRICULA`). «Guardar» sí funciona. |
| CP-US17-07 | US17 | básico | Dos apoderados registrados | 1. Vincular a ambos. 2. Marcar al segundo como «Apoderado principal». 3. Guardar. | — | Al marcar al segundo, el primero deja de ser principal (solo hay uno con la etiqueta «Principal»). Se guardan los dos vínculos. |
| CP-US17-08 | US17 | excepción | Dos apoderados | 1. Registrar por la API con ambos como principales. | `esPrincipal: true` en los dos | `422 PRINCIPAL_INVALIDO` «Marca exactamente un apoderado como principal.». |
| CP-US17-09 | US17 | alterno | Dos apoderados vinculados en pantalla, el primero principal | 1. Quitar al principal. | — | El que queda pasa a ser principal y se muestra «Apoderado principal (es el único)». |
| CP-US17-10 | US17 | excepción | PC | 1. Dejar sin grado de ingreso y sin fecha de nacimiento. 2. Guardar. | — | «Elige el grado de ingreso» e «Ingresa la fecha de nacimiento». |
| CP-US17-11 | US17 | excepción | PC | 1. Registrar por la API con una fecha inexistente o futura. | `2012-02-31` · `2999-01-01` | `400 DATOS_INVALIDOS`: «La fecha de nacimiento no es válida» · «La fecha de nacimiento no puede ser futura». |
| CP-US17-12 | US17 | alterno | Persona registrada solo como apoderado (por ejemplo, un hermano mayor) | 1. Escribir su DNI en AD-09. | — | Alerta «Este DNI ya está registrado: … (Apoderado)» y nombres precargados y bloqueados. Al guardar se agrega el perfil Estudiante con sus datos actuales. |
| CP-US17-13 | US17 | alterno | PC | 1. Dejar sexo, colegio de procedencia y dirección vacíos. 2. Guardar. | — | Se registra: los tres son opcionales. |
| CP-US17-14 | US17 | excepción | PC | 1. Registrar por la API con un grado inexistente. | `gradoIngresoId` aleatorio | `422 GRADO_INVALIDO` «El grado de ingreso no existe o no está activo.». |
| CP-US17-15 | US17 | alterno | PC | 1. En AD-09, «Registrar apoderado». | — | Abre AD-08; tras registrarlo, «Registrar un estudiante» vuelve a AD-09, donde se le busca por DNI o nombre. |
| CP-US17-16 | US17 | excepción | Sesión de un perfil que no es Administrador | 1. Llamar a `POST /comunidad/estudiantes`. | — | `403 ACCESO_DENEGADO`. |
| CP-US17-17 | US17 | básico | CP-US17-01 | 1. Revisar los logs de la aplicación tras los registros. | `logs/` | Ninguna línea contiene DNI: los logs solo guardan ruta, método, código y requestId. |

## Casos unitarios (Vitest)

Se ejecutan con `npm test`. No usan la base de datos y emplean datos y fechas fijas.

| ID | Archivo | Qué verifica | Resultado esperado |
|---|---|---|---|
| CU-US15-01 | `tests/comunidad/apoderados.test.ts` | Perfil Apoderado según el DNI | Sin perfil → CREAR; inactivo → REACTIVAR; activo → `APODERADO_EXISTENTE` 409 con `details.apoderadoId` |
| CU-US15-02 | ídem | Persona ya registrada | Solo se completan los datos vacíos; si tiene todos, no cambia nada |
| CU-US15-03 | ídem | Datos completos | Válido; teléfono «987 654 321» → «987654321»; sin estudiantes → `vinculos: []` |
| CU-US15-04 | ídem | Teléfono de 8 dígitos | «El número de teléfono debe tener 9 dígitos» |
| CU-US15-05 | ídem | DNI y correo | 7 dígitos → «El DNI debe tener 8 dígitos»; «carmen@» → «Formato de correo electrónico inválido» |
| CU-US15-06 | ídem | Dirección, ocupación y fecha futura | «Ingresa la dirección», «Ingresa la ocupación», «La fecha de nacimiento no puede ser futura» |
| CU-US15-07 | ídem | Vínculo pedido al registrar | Sin parentesco → «Elige el parentesco»; por defecto `esPrincipal: false`, `autorizado: true` |
| CU-US15-08 | ídem | Estudiantes repetidos | Distintos → válido; repetido → `ESTUDIANTE_REPETIDO` |
| CU-US15-09 | `tests/comunidad/estudiantes.test.ts` | Vincular un apoderado más | No principal → no cambia el principal; principal → quita al anterior (`quitarPrincipalA`); estudiante sin principal → el nuevo lo es; ya vinculado → `VINCULO_EXISTENTE` 409 |
| CU-US17-01 | ídem | Apoderados de un estudiante nuevo | Uno o más con un principal → válido |
| CU-US17-02 | ídem | Sin apoderados | `SIN_APODERADO` «Debe asociar al menos un apoderado antes de continuar» |
| CU-US17-03 | ídem | Principal | Ninguno o dos → `PRINCIPAL_INVALIDO` |
| CU-US17-04 | ídem | Apoderado repetido | `APODERADO_REPETIDO` |
| CU-US17-05 | ídem | Perfil Estudiante según el DNI | Activo → `ESTUDIANTE_EXISTENTE` «Ya existe un estudiante registrado con este DNI»; sin perfil → CREAR |
| CU-US17-06 | ídem | Datos del estudiante | Obligatorios → válido; colegio en blanco → `null`; `borrador` falso por defecto; sexo opcional |
| CU-US17-07 | ídem | Esquema sin apoderados | `[]` o sin el campo → «Debe asociar al menos un apoderado antes de continuar» |
| CU-US17-08 | ídem | DNI y grado | 6 dígitos → «El DNI debe tener 8 dígitos»; sin grado → «Elige el grado de ingreso» |
| CU-US17-09 | ídem | Fechas de nacimiento | «2012-02-31» y «2012-13-01» → «La fecha de nacimiento no es válida»; «22/04/2012» → formato AAAA-MM-DD |
| CU-US17-10 | `tests/matricula/reglas.test.ts` | Año de la matrícula en borrador | En matrícula → ese año; si no hay, el en curso; ninguno → `SIN_ANIO_EN_MATRICULA` 422 |
