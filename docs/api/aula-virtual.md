# API · Aula virtual: unidades didácticas, materiales de estudio (US61), enlaces de clase virtual (US62) y acceso del alumno (US67)

Base: `/api/v1` · Formato: JSON · Éxito `{ "data": … }` · Error `{ "error": { "code", "message", "details" } }`
El `message` de los errores ya está redactado para mostrarse al usuario (RNF09). Pantallas: DO-05 «Aula virtual» del docente (`/docente/aula-virtual`) con M-16 «Subir material de estudio» y M-17 «Agregar enlace de clase virtual», y AL-05 «Mis cursos» del alumno (`/alumno/cursos/{cursoId}`) ([frontend-aula-virtual.md](../frontend-aula-virtual.md)). Casos de prueba en [pruebas/casos-sprint4-aula-virtual.md](../pruebas/casos-sprint4-aula-virtual.md); ejemplos en [aula-virtual.http](aula-virtual.http).

La sesión, las cookies y qué hacer ante un `401` o un `403` están en [identidad.md](identidad.md). Los archivos se guardan con `platform/archivos` (ver [DESPLIEGUE-AWS.md](../DESPLIEGUE-AWS.md#archivos-evidencias-y-aula-virtual)).

## Modelo

El módulo `aula-virtual` es dueño de `unidad_didactica`, `material_estudio` y `enlace_virtual`. Todo cuelga de una **asignación docente** (curso + sección del año, US14): el aula de Matemática de 1° A es la de su asignación activa.

- **Unidad didáctica** (`unidad_didactica`): número (su orden, único por asignación), título y `activo`. No se borra: se desactiva, y entonces ni ella ni sus materiales se muestran al alumno.
- **Material de estudio** (`material_estudio`): título, unidad, `tipo_formato` (`PDF`, `PPTX`, `DOCX`, `XLSX`, `IMAGEN` o `ENLACE`) y `estado_visibilidad` (`BORRADOR`, `PUBLICADO` u `OCULTO`). Un archivo guarda su clave interna del almacén (`archivo_clave = materiales/<uuid>`), su nombre original saneado, su tipo MIME y su tamaño; un `ENLACE` guarda solo su URL (`url_archivo`). `publicado_en` es la última vez que se publicó.
- **Enlace de clase virtual** (`enlace_virtual`): tipo (`CLASE_VIRTUAL`, `ASESORIA` o `TALLER`), título, URL (`url_meet`), inicio (`fecha_programada`), fin (`fecha_fin`) y `visible`. El estado no se guarda: se calcula en cada consulta.
- **Migración `aula_virtual`** (compatible: solo agrega): `material_estudio.archivo_clave`, `nombre_archivo` y `tamano_bytes`, `url_archivo` opcional, `enlace_virtual.fecha_fin` e índices por asignación y unidad. Restricciones (`NOT VALID`: rigen para toda fila nueva o modificada):
  - `ck_enlace_virtual_fechas`: el fin es posterior al inicio.
  - `ck_material_contenido`: un `ENLACE` tiene URL y ningún archivo; los demás, su archivo completo de 1 byte a 5 MB.
  - `ck_material_publicado`: un material `PUBLICADO` tiene `publicado_en`.

## Permisos

| Quién | Qué |
|---|---|
| Docente | Solo sus asignaciones **activas**. Escribe solo en las del año `EN_CURSO`; en otro año, el aula es de solo lectura (`422 ANIO_NO_EN_CURSO`). Una asignación ajena por su id: `403 ACCESO_DENEGADO`. Una unidad, un material o un enlace de otro docente por su id: `404 NO_ENCONTRADO` (no se revela que existe). |
| Alumno | Solo la sección de su **matrícula vigente** (persona → estudiante → matrícula, nunca un id de la URL). Sin matrícula vigente: `403 SIN_MATRICULA_VIGENTE`. Un curso que no está en el plan de su sección: `404`. Un material ajeno, en borrador, oculto o de una unidad desactivada: `404`. |
| Otros perfiles | `403 ACCESO_DENEGADO`. Sin sesión: `401 NO_AUTENTICADO`. |

## Endpoints del docente (DO-05)

| Método y ruta | Cuerpo | Respuesta `data` |
|---|---|---|
| `GET /aula-virtual/docente/cursos` | — | `CursosDelAula` |
| `GET /aula-virtual/asignaciones/{asignacionId}` | — | `AulaDelDocente` |
| `POST /aula-virtual/asignaciones/{asignacionId}/unidades` | `{ titulo }` | `UnidadVista` (201) |
| `PATCH /aula-virtual/unidades/{id}` | `{ titulo?, activo? }` | `UnidadVista` |
| `POST /aula-virtual/unidades/{id}/mover` | `{ direccion: "ARRIBA" \| "ABAJO" }` | `UnidadVista[]` en su nuevo orden |
| `POST /aula-virtual/asignaciones/{asignacionId}/materiales` | multipart (ver abajo) | `MaterialVista` (201) |
| `POST /aula-virtual/materiales/{id}/publicar` | — | `MaterialVista` |
| `POST /aula-virtual/materiales/{id}/ocultar` | — | `MaterialVista` |
| `DELETE /aula-virtual/materiales/{id}` | — | `{ id }` |
| `POST /aula-virtual/asignaciones/{asignacionId}/enlaces` | `DatosEnlace` | `EnlaceVista` (201) |
| `PUT /aula-virtual/enlaces/{id}` | `DatosEnlace` | `EnlaceVista` |
| `POST /aula-virtual/enlaces/{id}/publicar` | — | `EnlaceVista` (lo hace visible) |
| `POST /aula-virtual/enlaces/{id}/ocultar` | — | `EnlaceVista` |
| `DELETE /aula-virtual/enlaces/{id}` | — | `{ id }` |

- `CursosDelAula`: `{ anio: { id, anio } | null, cursos: [{ asignacionId, curso: { id, codigo, nombre }, seccion: { id, nombre }, etiqueta («1° A») }] }`. Solo el año `EN_CURSO`; sin él, `anio: null` y `cursos: []`.
- `AulaDelDocente`: `{ asignacionId, curso, seccion: { id, nombre, etiqueta }, anio: { id, anio }, editable, unidades: UnidadVista[], materiales: MaterialVista[], enlaces: EnlaceVista[] }`. `editable` es `false` fuera del año en curso. Trae todo, también borradores, ocultos y unidades desactivadas.
- `UnidadVista`: `{ id, numero, titulo, activo }`.
- `MaterialVista`: `{ id, titulo, tipo, unidadId, estado, publicadoEn, archivo: { nombre, mime, tamanoBytes } | null, url | null, creadoEn }`. La clave del almacén nunca sale.
- `DatosEnlace`: `{ tipo, titulo, url, inicio, fin, visible }`; `inicio` y `fin` en la **hora de Lima** con el formato de un campo `datetime-local` (`"2026-11-24T10:00"`).
- `EnlaceVista`: `{ id, tipo, titulo, url, inicio, fin (UTC, ISO 8601), visible, estado: "PROGRAMADO" | "ACTIVO" | "FINALIZADO" }`.

### Subir material (multipart/form-data, M-16)

| Campo | Valor |
|---|---|
| `unidadId` | Unidad **activa** de la misma asignación |
| `titulo` | 1 a 150 caracteres |
| `tipo` | `ARCHIVO` o `ENLACE` |
| `visible` | `true` (se publica) o `false` (queda en borrador) |
| `archivo` | Con `tipo=ARCHIVO`: PDF, PPTX, DOCX, XLSX, JPG o PNG de hasta 5 MB |
| `url` | Con `tipo=ENLACE`: URL `http` o `https` |

## Endpoints del alumno (AL-05)

| Método y ruta | Respuesta `data` |
|---|---|
| `GET /aula-virtual/alumno/cursos/{cursoId}` | `AulaDelCurso` |
| `GET /aula-virtual/materiales/{id}/archivo` (también docente) | El archivo (no JSON) |

- `AulaDelCurso`: `{ curso: { id, codigo, nombre }, seccionCorta, docente: { nombreCompleto } | null, unidades: [{ unidad: { id, numero, titulo }, materiales: MaterialDelAlumno[] }], enlaces: EnlaceDelAlumno[] }`. El `cursoId` es el de «Mis cursos» (`GET /matricula/alumno/cursos`, US49). Un curso del plan sin docente responde con `docente: null` y listas vacías.
- `MaterialDelAlumno`: `{ id, titulo, tipo, publicadoEn, archivo: { nombre, tamanoBytes } | null, url | null }`. Solo `PUBLICADO` en unidades activas, agrupados por unidad (en su orden) y del más reciente al más antiguo; las unidades sin materiales visibles no aparecen.
- `EnlaceDelAlumno`: `{ id, tipo, titulo, inicio, fin, estado, url }`. Solo los visibles, por inicio. `url` solo viaja con el enlace `ACTIVO` («Entrar a clase»); en los demás es `null`.
- Archivo: `Content-Disposition` `inline` para PDF y JPG y `attachment` para el resto, con el nombre original saneado; `Cache-Control: private, no-store` y `X-Content-Type-Options: nosniff`. El docente descarga los de sus cursos en cualquier estado.

## Reglas

**Materiales (US61)**

- El tipo real del archivo se decide por sus primeros bytes, nunca por la extensión ni por el `Content-Type` del navegador (`platform/archivos`). PNG y JPG se guardan como `IMAGEN`.
- Rechazos con el motivo: formato no permitido `400 ARCHIVO_NO_PERMITIDO` «Formato no permitido. Sube un PDF, PPTX, DOCX, XLSX o una imagen JPG o PNG.»; más de 5 MB `413 ARCHIVO_DEMASIADO_GRANDE` «El archivo supera el tamaño máximo de 5 MB. Elige un archivo más liviano.» (si el `Content-Length` ya lo supera, sin leer el cuerpo); archivo vacío `400 ARCHIVO_VACIO`; sin archivo `400 ARCHIVO_REQUERIDO`; URL que no es `http` ni `https` `400 ENLACE_INVALIDO` «Ingresa un enlace válido»; unidad desactivada `422 UNIDAD_INACTIVA`. Nada se guarda.
- Estados: «Visible para los alumnos» publica (`PUBLICADO`); si no, `BORRADOR`. Se publica un borrador o un oculto (`409 MATERIAL_YA_PUBLICADO` si ya lo está) y solo se oculta uno publicado (`409 MATERIAL_NO_PUBLICADO`). El alumno nunca ve ni descarga un borrador o un oculto.
- El archivo se guarda en el almacén antes de la transacción y se borra si esta falla; al eliminar el material, se borra después de confirmarla (si el almacén falla, la clave queda en el log como huérfana).

**Enlaces (US62)**

- URL `http` o `https` con dominio: si no, `400 ENLACE_INVALIDO` «Ingresa un enlace válido» y no se guarda. El fin debe ser posterior al inicio: `400 FECHAS_ENLACE_INVALIDAS`.
- Estado calculado en el servidor en cada consulta: `PROGRAMADO` antes del inicio, `ACTIVO` desde el inicio exacto hasta antes del fin, `FINALIZADO` desde el fin exacto. Las horas que escribe el docente se leen como hora de Lima (UTC−5, sin horario de verano).
- Mostrar un enlace que ya es visible: `409 ENLACE_YA_VISIBLE`; ocultar uno oculto: `409 ENLACE_YA_OCULTO`.

**Unidades**

- Una unidad nueva toma el número siguiente al mayor (las desactivadas también cuentan). Mover intercambia el número con la vecina; en un extremo no cambia nada. Crear y mover se serializan por asignación (candado de la transacción).

**Auditoría y avisos**

- `registro_auditoria` (en la misma transacción): `PUBLICAR_MATERIAL` (al subir visible o al publicar), `OCULTAR_MATERIAL`, `ELIMINAR_MATERIAL`, `PUBLICAR_ENLACE` (al guardar visible, al mostrarlo o al editarlo de oculto a visible), `OCULTAR_ENLACE` y `ELIMINAR_ENLACE`. Guarda el título, el tipo, el curso, la sección y la clave del archivo, nunca el nombre original. Crear o editar unidades y guardar borradores no se audita.
- Al publicar un material o hacer visible un enlace, notificación interna tipo `MATERIAL` (US55) a cada alumno **con cuenta** matriculado hoy en la sección, con enlace a `/alumno/cursos/{cursoId}`. Sin correo. Si la consulta de destinatarios falla, la operación sigue sin aviso.

## Errores

| Código | HTTP | Cuándo |
|---|---|---|
| `NO_AUTENTICADO` | 401 | Sin sesión |
| `ACCESO_DENEGADO` | 403 | Perfil sin permiso o asignación de otro docente |
| `SIN_MATRICULA_VIGENTE` | 403 | Alumno sin matrícula vigente |
| `NO_ENCONTRADO` | 404 | Curso, unidad, material o enlace que no existe o no le corresponde |
| `DATOS_INVALIDOS` | 400 | Cuerpo o formulario que no cumple el esquema |
| `ENLACE_INVALIDO` | 400 | URL que no es `http` ni `https` |
| `FECHAS_ENLACE_INVALIDAS` | 400 | Fin igual o anterior al inicio |
| `ARCHIVO_NO_PERMITIDO`, `ARCHIVO_VACIO`, `ARCHIVO_REQUERIDO` | 400 | Archivo del material |
| `ARCHIVO_DEMASIADO_GRANDE` | 413 | Más de 5 MB |
| `MATERIAL_YA_PUBLICADO`, `MATERIAL_NO_PUBLICADO`, `ENLACE_YA_VISIBLE`, `ENLACE_YA_OCULTO` | 409 | Cambio de estado que no corresponde |
| `UNIDAD_INACTIVA`, `ANIO_NO_EN_CURSO` | 422 | Unidad desactivada o año que no está en curso |
| `ALMACEN_NO_CONFIGURADO` | 503 | Ambiente sin almacén de archivos (Vercel sin `ARCHIVOS_DRIVER`) |
