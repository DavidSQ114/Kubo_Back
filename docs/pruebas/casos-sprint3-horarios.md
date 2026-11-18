# Casos de prueba · Sprint 3, bloque 3: horarios (US27, US28, US29, US30, US31)

Pantalla AD-13 «Matriz de horarios» (`/admin/horarios`) y modal M-06 «Asignar clase». API: [horarios.md](../api/horarios.md); ejemplos en [horarios.http](../api/horarios.http). Pantalla: [frontend-horarios.md](../frontend-horarios.md).
Las reglas puras se prueban además con Vitest (`tests/horarios/reglas.test.ts` y `tests/horarios/publicacion.test.ts`; los textos del rechazo, en `tests/horarios/mensajesPublicacion.test.ts`). Los cruces con dos administradores a la vez, el rechazo en la base, la publicación por versiones, la auditoría y el correo se prueban en `tests/horarios/horarios.integracion.test.ts`, que corre en el CI con PostgreSQL. Las restricciones de la base, en `prisma/sql/pruebas.sql` (sección 5).

**Precondición común (PC):** sesión iniciada como Administrador (`admin@kubo.edu.pe`) con la contraseña ya cambiada. Seed cargado (incluye la jornada por defecto `BLOQUES_HORARIO`). Solo datos ficticios (RNF14):
- Año **2026** «En curso» y año **2025** «Cerrado», cada uno con la sección **5° A**; en 2026, además, **5° B**.
- Aulas activas **Aula 305** (habitual de 5° A), **Aula 306** (habitual de 5° B) y **Lab. Ciencias**.
- Plan de estudios de 5° en 2026 con 35 horas semanales: Matemática 6, Comunicación 5, Ciencia y Tecnología 4, Ciencias Sociales 4, Inglés 3, Arte y Cultura 3, Educación Física 3, DPCC 3, Educación para el Trabajo 2 y Educación Religiosa 2.
- Cada curso tiene el mismo docente en 5° A y 5° B (AD-07): **Elena Castro Ruiz** dicta Matemática; **Mónica Torres Aguilar**, Comunicación; **Carlos Díaz Pinto**, Arte y Cultura. Todos con correo.

Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y muestra el mensaje).

## US27 · Visualización de cuadrícula por sección

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US27-01 | US27 | básico | PC; 5° A sin horario | 1. Menú «Horarios». 2. Elegir año 2026, grado 5° y sección 5° A. | — | Cuadrícula con «Hora» y los 5 días (Lunes a Viernes) en columnas y los bloques en filas: 07:45, 08:30, 09:15, la franja «RECREO · 10:00 – 10:20», 10:20, 11:05, 11:50 y 12:35. Todas las celdas de clase muestran «+ Asignar». Insignia «Sin horario» y «0 / 35 bloques». |
| CP-US27-02 | US27 | básico | 5° A con clases asignadas | 1. Abrir la cuadrícula de 5° A. | — | Cada bloque ocupado muestra curso, docente («E. Castro») y aula. Al hacer clic se abre «Editar clase» con sus datos. El panel «Cursos de 5° A» muestra los bloques de cada curso frente a sus horas. |
| CP-US27-03 | US27 | excepción | PC | 1. Elegir el año 2025 y su sección 5° A. | — | Aviso «Esta sección no pertenece al periodo académico activo». La cuadrícula se muestra solo para consulta: las celdas no responden al clic y no aparecen «Publicar» ni «Editar horario». |
| CP-US27-04 | US27 | excepción | PC | 1. `PUT /horarios/secciones/{5° A de 2025}/clases/LUNES/{bloque}` con una clase completa. | — | `422 SECCION_FUERA_DE_ANIO_ACTIVO` «Esta sección no pertenece al periodo académico activo». No se crea ningún horario. |
| CP-US27-05 | US27 | alterno | PC; el año 2026 sin catálogo de bloques | 1. Abrir por primera vez una cuadrícula de 2026. 2. Abrir otra sección del mismo año. | — | El catálogo del año se crea una sola vez con la jornada por defecto (7 bloques de clase y 1 recreo). La segunda sección usa los mismos bloques. |
| CP-US27-06 | US27 | excepción | PC; el recreo del año | 1. `PUT …/clases/LUNES/{bloque del recreo}` con una clase completa. | — | `422 BLOQUE_DE_RECREO` «El recreo no admite clases.». En la pantalla el recreo no tiene celdas. |
| CP-US27-07 | US27 | excepción | Sesión de Docente o Apoderado | 1. `GET /horarios/secciones/{id}`. | — | `403 ACCESO_DENEGADO`. Sin sesión: `401 NO_AUTENTICADO`. |

## US28 · Asignación manual de clase

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US28-01 | US28 | básico | PC; 5° A sin horario | 1. Clic en «+ Asignar» del lunes 07:45. 2. Elegir el curso. 3. «Guardar bloque». | Matemática | Al elegir el curso se selecciona sola «Elena Castro Ruiz»; el aula viene con «Aula 305». Aviso «Clase asignada.». El bloque muestra «Matemática · E. Castro · Aula 305». Insignia «Borrador · versión 1» y «1 / 35 bloques». |
| CP-US28-02 | US28 | excepción | PC | 1. Abrir un bloque libre. 2. «Guardar bloque» sin elegir curso ni docente. | — | Alerta «Debe completar curso, docente y aula antes de guardar». No se guarda nada. Por la API con un campo en `null`: `400 CLASE_INCOMPLETA` con el mismo mensaje. |
| CP-US28-03 | US28 | excepción | PC | 1. Abrir un bloque libre. 2. Elegir «Matemática». 3. Cambiar el docente por otro. 4. «Guardar bloque». | Mónica Torres Aguilar | En rojo, bajo «Docente»: «Este docente no tiene asignado el curso seleccionado». No se guarda (`422 DOCENTE_SIN_CURSO`). |
| CP-US28-04 | US28 | excepción | PC; un curso del plan sin docente asignado en la sección | 1. Abrir un bloque libre y elegir ese curso. | — | El modal avisa «Este curso aún no tiene un docente asignado en la sección…» y «Docente» queda vacío. Al guardar: «Debe completar curso, docente y aula antes de guardar». |
| CP-US28-05 | US28 | básico | CP-US28-01 | 1. Clic en la clase del lunes 07:45. 2. Cambiar el aula. 3. «Guardar bloque». | Lab. Ciencias | Aviso «Bloque actualizado.». El bloque muestra el aula nueva. Auditoría `ASIGNAR_CLASE` con el aula anterior y la nueva. |
| CP-US28-06 | US28 | básico | CP-US28-01 | 1. Clic en la clase. 2. «Vaciar bloque». | — | Aviso «Bloque vaciado.». La celda vuelve a «+ Asignar» y el avance baja en 1. Auditoría `QUITAR_CLASE` con los datos de la clase que había. |
| CP-US28-07 | US28 | excepción | PC | 1. `DELETE …/clases/VIERNES/{bloque sin clase}`. | — | `404 NO_ENCONTRADO` «La clase no existe.» |
| CP-US28-08 | US28 | excepción | PC; un aula inactiva | 1. `PUT …/clases/…` con esa aula. | — | `422 AULA_INACTIVA` «El aula seleccionada está inactiva.». En el modal no aparece entre las opciones. |
| CP-US28-09 | US28 | básico | CP-US28-01 | 1. Revisar `registro_auditoria`. | — | Fila `ASIGNAR_CLASE` (entidad `detalle_horario`): `valor_anterior = null`, `valor_nuevo = { seccionId, horarioId, version: 1, dia: "LUNES", bloque: "07:45 – 08:30", curso: "MAT", docenteId, aulaId }`, con el usuario, la IP y el requestId. |

## US29 · Prevención de cruce de docente

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US29-01 | US29 | excepción | 5° A tiene Matemática con Elena Castro el lunes 07:45 (borrador) | 1. En 5° B, abrir el lunes 07:45. 2. Elegir «Matemática». 3. «Guardar bloque». | Aula 306 | El modal muestra «Ocupado · 5° A» junto a la docente. Al guardar, en rojo bajo «Docente»: «Error: Cruce de Docente · ya tiene clase en 5° A (lunes 07:45 – 08:30)». No se guarda (`409 CRUCE_DOCENTE`, `details.estadoHorario: "BORRADOR"`). |
| CP-US29-02 | US29 | básico | CP-US29-01 | 1. En 5° B, asignar «Matemática» el lunes 08:30. | Aula 306 | Se guarda sin alertas: mismo docente, bloque distinto. |
| CP-US29-03 | US29 | excepción | 5° A con horario **publicado** y un borrador donde Comunicación pasó del lunes 08:30 al jueves 09:15 | 1. En 5° B, asignar «Comunicación» el lunes 08:30. 2. Asignarla el jueves 09:15. | — | Ambos se rechazan con «Error: Cruce de Docente · ya tiene clase en 5° A (…)»: el primero choca con la versión publicada (`estadoHorario: "PUBLICADO"`) y el segundo con el borrador en edición (`"BORRADOR"`). |
| CP-US29-04 | US29 | alterno | 5° A publica su versión 2 (la 1 queda archivada) | 1. En 5° B, asignar «Comunicación» el lunes 08:30. | — | Se guarda: las clases de una versión archivada ya no ocupan al docente. |
| CP-US29-05 | US29 | excepción | PC; prueba de integración «con dos administradores a la vez…» | 1. Lanzar a la vez `PUT` de Matemática con Elena Castro el martes 07:45 en 5° A y en 5° B (aulas distintas). | — | Solo una solicitud responde `200`; la otra, `409 CRUCE_DOCENTE` con la sección de la primera. En la base queda una sola clase de esa docente en ese día y bloque. |
| CP-US29-06 | US29 | excepción | CP-US29-01 | 1. Insertar por SQL en `detalle_horario` la clase que cruza al docente (saltando la aplicación). | — | La base lo rechaza: `uq_detalle_cruce_docente`. |

## US30 · Prevención de cruce de aula

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US30-01 | US30 | excepción | 5° A usa el Aula 305 el lunes 07:45 | 1. En 5° B, abrir el lunes 07:45. 2. Elegir «Comunicación». 3. Elegir el aula. 4. «Guardar bloque». | Aula 305 | Bajo «Aula», antes de guardar: «Ocupada por 5° A en este bloque.». Al guardar, en rojo: «Error: Aula Ocupada · Aula 305 está asignada a 5° A (lunes 07:45 – 08:30)». No se guarda (`409 AULA_OCUPADA`). |
| CP-US30-02 | US30 | básico | CP-US30-01 | 1. En 5° B, asignar «Comunicación» el lunes 08:30 en el Aula 305 (5° A no la usa en ese bloque). | Aula 305 | Se guarda sin alertas: misma aula, bloque distinto. |
| CP-US30-03 | US30 | alterno | CP-US30-01 | 1. En el mismo modal, cambiar el aula. 2. «Guardar bloque». | Aula 306 | Bajo «Aula»: «Aula disponible en este bloque.». Se guarda. |
| CP-US30-04 | US30 | excepción | PC; prueba de integración «…solo uno ocupa el aula…» | 1. Lanzar a la vez dos `PUT` en el mismo día y bloque, en 5° A y 5° B, con docentes distintos y la misma aula. | Aula 305 | Solo una responde `200`; la otra, `409 AULA_OCUPADA`. En la base queda una sola clase en esa aula, día y bloque. |
| CP-US30-05 | US30 | excepción | CP-US30-01 | 1. Insertar por SQL la clase que cruza el aula. | — | La base lo rechaza: `uq_detalle_cruce_aula`. |
| CP-US30-06 | US30 | excepción | El docente y el aula chocan a la vez con 5° A | 1. En 5° B, asignar Matemática con Elena Castro en el Aula 305 el lunes 07:45. | — | Se informa primero el cruce de docente: «Error: Cruce de Docente · …». |

## US31 · Publicación del horario

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US31-01 | US31 | excepción | 5° A en borrador con 33 de 35 bloques (faltan 2 de Matemática) | 1. «Publicar». 2. Confirmar. | — | Alerta roja «No se puede publicar: existen bloques horarios sin asignar», con «Matemática: 4 de 6 bloques (faltan 2)» y «Bloques libres: Jueves 12:35 – 13:20 · Viernes 12:35 – 13:20». Sigue en «Borrador» (`422 HORARIO_INCOMPLETO`). |
| CP-US31-02 | US31 | básico | 5° A en borrador con los 35 bloques (cada curso con sus horas) | 1. «Publicar». 2. Confirmar. | — | Aviso «Horario publicado (versión 1). Se avisó por correo a 10 de 10 docentes.». Insignia «Publicado · versión 1». Aparece «Editar horario» y el aviso «Este horario está publicado». Cada docente recibe «Kubo · Horario de 5° A publicado». |
| CP-US31-03 | US31 | básico | CP-US31-02 | 1. Revisar `registro_auditoria`. | — | Fila `PUBLICAR_HORARIO` (entidad `horario`): anterior `{ version: 1, estado: "BORRADOR", publicada: null }`, nuevo `{ version: 1, estado: "PUBLICADO", clases: 35, archivada: null }`. |
| CP-US31-04 | US31 | básico | CP-US31-02 | 1. «Editar horario». | — | Aviso «Se abrió el borrador (versión 2) a partir del horario publicado.». La cuadrícula muestra las mismas 35 clases, ahora editables. `GET …/publicado` sigue devolviendo la versión 1. |
| CP-US31-05 | US31 | básico | CP-US31-04 | 1. Mover una clase (vaciar un bloque y asignarla en otro). 2. En el selector «Versión», elegir «Versión 1 · Publicado». | — | La versión 1 se ve sin el cambio y con el aviso «Esta es la versión publicada. Hay un borrador en edición.». «Ir al borrador» vuelve a la versión 2. |
| CP-US31-06 | US31 | básico | CP-US31-05, borrador completo | 1. «Publicar nueva versión». 2. Confirmar. | — | El modal avisa «La versión 1 pasará a «Archivado»…». Aviso «Horario publicado (versión 2)…». Insignia «Publicado · versión 2». El selector «Versión» lista «Versión 2 · Publicado» y «Versión 1 · Archivado». Los docentes reciben «Kubo · Horario de 5° A actualizado». Auditoría `PUBLICAR_HORARIO` con `archivada: { version: 1, estado: "ARCHIVADO" }`. |
| CP-US31-07 | US31 | alterno | CP-US31-06 | 1. Elegir «Versión 1 · Archivado». | — | Se muestra con el aviso «Versión 1 archivada: solo lectura». Las celdas no responden al clic. |
| CP-US31-08 | US31 | alterno | Borrador completo; sin `SMTP_HOST` en producción o con el servidor de correo caído | 1. Publicar. | — | El horario se publica igual. El aviso indica cuántos correos salieron («Se avisó por correo a 0 de 10 docentes.»). En el log queda el fallo, sin datos personales. |
| CP-US31-09 | US31 | excepción | 5° A publicado y sin borrador | 1. `POST /horarios/secciones/{id}/publicar`. | — | `409 SIN_CAMBIOS_POR_PUBLICAR` «No hay un borrador con cambios por publicar en esta sección.» |
| CP-US31-10 | US31 | excepción | Borrador con un curso con más bloques que horas (por ejemplo, 7 de Matemática y 4 de Comunicación) | 1. Publicar. | — | Primero se informa lo que falta (`HORARIO_INCOMPLETO`, Comunicación). Con todos los cursos cubiertos y uno excedido: `422 HORARIO_CON_EXCESO` «No se puede publicar: hay cursos con más bloques que sus horas semanales». |
| CP-US31-11 | US31 | excepción | Borrador completo; después se quita en AD-07 la asignación de un docente con clases en el horario | 1. Abrir la cuadrícula. 2. Publicar. | — | Las clases afectadas se ven en rojo «Docente sin el curso» y el panel lo advierte. Al publicar: `422 CLASES_SIN_DOCENTE_VIGENTE`. Tras volver a asignarlas con el docente nuevo, se publica. |
| CP-US31-12 | US31 | básico | 5° A publicado (versión 2) y 5° B solo con borrador | 1. `GET /horarios/secciones/{5° A}/publicado`. 2. `GET /horarios/secciones/{5° B}/publicado`. 3. `GET /horarios/docentes/{Mónica Torres}/publicado`. | — | 1: las clases de la versión 2. 2: `horario: null` y `clases: []`. 3: solo las clases de la docente en horarios publicados (las del borrador de 5° B no aparecen), cada una con su sección y aula. |
| CP-US31-13 | US31 | básico | Sesión de un docente con clases publicadas | 1. `GET /horarios/mi-horario`. | — | `200` con sus clases del año en curso. Con sesión de administrador: `403 ACCESO_DENEGADO`. |
| CP-US31-14 | US31 | excepción | 1° A en borrador con todos los cursos cubiertos y dos excedidos: Comunicación 19 de 5 y Matemática 16 de 6 (defecto D-10) | 1. «Publicar». 2. Confirmar. | — | Alerta roja «No se puede publicar: hay cursos con más bloques que sus horas semanales» con «Comunicación: 19 de 5 bloques (sobran 14) · Matemática: 16 de 6 bloques (sobran 10)». Nunca aparece «undefined». Sigue en «Borrador» (`422 HORARIO_CON_EXCESO`). |
| CP-US31-15 | US31 | alterno | CP-US31-14 | 1. Revisar el panel «Validaciones». | — | «Cursos con bloques de más» muestra el mismo texto que la alerta: «Comunicación: 19 de 5 bloques (sobran 14) · Matemática: 16 de 6 bloques (sobran 10)». |
| CP-US31-16 | US31 | alterno | CP-US31-01 | 1. Revisar el panel «Validaciones». | — | «2 bloques sin asignar» con el detalle «Matemática: 4 de 6 bloques (faltan 2). Complétalos antes de publicar.», igual que la alerta. |
| CP-US31-17 | US31 | excepción | CP-US31-11 (una clase del lunes 07:45 – 08:30 con un docente que ya no tiene el curso) | 1. «Publicar». 2. Revisar el panel «Validaciones». | — | Alerta «No se puede publicar: hay clases cuyo docente ya no tiene asignado el curso. Vuelve a asignarlas.» con «Clases por reasignar: Lunes 07:45 – 08:30». El panel dice «1 clase con un docente que ya no tiene el curso» con «Vuelve a asignarlas antes de publicar: Lunes 07:45 – 08:30.». |
