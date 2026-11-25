# Revisión final de Kubo (bloque M5)

> 25/11/2026 · rama `fix/revision-final` · guiada por el plan de pruebas del profesor
> (`docs/pruebas/Plan_de_Pruebas_26-2.xlsx`). Resultado fila por fila en `docs/pruebas/plan-profesor.md` y en la copia
> `docs/pruebas/Plan_de_Pruebas_26-2_kubo.xlsx`. Avance por fases en `docs/progreso/M5.md`.

## Cómo se revisó

- **Base temporal** con las migraciones, `prisma/seed.sql` y `scripts/demoRevision.ts`, que arma un colegio ficticio
  completo llamando a la API real con cada rol y prueba, en cada paso, un caso inválido (datos vacíos, duplicados,
  cruces, sin permiso). Nunca `kubo_dev` ni Neon. Las pruebas de integración corrieron en otra base temporal limpia.
- **Aplicación en modo producción** (`next build` + `next start`), con el almacén de archivos en disco, para ver lo
  mismo que verá el profesor en el servidor.
- **Navegador**: las 66 filas con el rol del Excel, la funcionalidad completa y un caso inválido.
- **Accesos**: 56 pedidos cruzados por la API y las rutas de los cinco portales por URL con cada rol.
- **Revisión transversal**: hora de Lima, dinero, doble envío, estados de pantalla, PDF y CSV descargados y leídos,
  logs y `log_error`, cabeceras de descarga, `npm audit`.

## Resultado

| Estado | Filas |
|---|---|
| OK | 52 |
| Corregido | 11 |
| No implementado (COULD) | 3: login con Gmail, forma de evaluación vigesimal y su reporte |

## Lo corregido

### Pantallas y flujos del plan

| Fila | Problema | Corrección |
|---|---|---|
| Notas por alumno (coordinador y tutor) | Abría siempre en el Bimestre I aunque las notas estuvieran en el IV: parecía que no había notas | Abre en el último bimestre con notas o conducta (`src/lib/bimestres.ts`, prueba `tests/evaluacion/bimestrePorDefecto.test.ts`) |
| Conducta (tutor) y competencias del curso (docente) | Tras guardar, el formulario volvía a montarse con los datos anteriores y mostraba «1 cambio sin guardar» con el valor viejo | Se vuelve a montar cuando llegan los datos guardados |
| Matricular hijo (apoderado) | Con un archivo no permitido el botón quedaba deshabilitado pero el aviso decía «Completa el grado y el responsable» | Aviso «Reemplaza los archivos marcados…» |
| Verificar documentos (coordinador) | Tras observar un documento, el formulario de observación quedaba abierto | Se cierra y se limpia |
| Estado de cuenta, matrícula y cuotas extraordinarias | El buscador de estudiantes mostraba el botón «Vincular» (texto del registro de apoderados) | «Ver estado de cuenta» o «Elegir» |
| Registrar usuario | El aviso de éxito decía «X ya es docente» (parecía un error) | «Se registró a X como docente» |
| Desactivar espacio | El aula en uso pedía al administrador «quitarla de esas secciones», algo que solo hace la coordinación | «Pide a la coordinación académica que la quite…» |
| Cambiar contraseña | Saltaba al inicio sin confirmar el cambio | Mensaje de éxito con «Ir al inicio» |
| Login | La lista de perfiles no nombraba al coordinador y el aviso tenía fijos «5 intentos / 15 minutos», que ahora son parámetros | Lista completa y aviso genérico |
| Mensajes de error | «Comunícate con el Administrador» (regla de consolidación, curso sin competencias) y «la administración» en publicación, rectificación y asistencia, aunque desde M1 lo resuelve la coordinación | Remiten a la coordinación académica |
| Validación | Un campo sin mensaje propio respondía en inglés en `details` («Invalid input: expected string…») | Zod en español (`z.config(z.locales.es())` en `platform/http`, con prueba) |

### Pendientes de la revisión transversal

- **M-07 (evidencia):** si el servidor rechaza el archivo, queda marcado como rechazado (sin «Listo») y «Guardar
  evidencia» no lo reenvía; lo mismo en el material del aula virtual (`src/lib/archivos.ts`, con prueba).
- **Archivos huérfanos:** al quitar una nota por el recálculo de ítems, sus evidencias se borraban en cascada pero los
  archivos quedaban en el almacén. Ahora `aplicarRecalculo` devuelve sus claves y `guardarItems`, `guardarNotas` y la
  importación CSV los borran con `eliminarArchivo` después de confirmar la transacción (caso nuevo en
  `tests/evaluacion/items.integracion.test.ts`).
- **Tiempo de espera en frío:** `GET /comunidad/usuarios` y otros cuatro listados paginados abrían una transacción de
  solo lectura; ahora usan `Promise.all`. Las transacciones interactivas tienen 10 s de espera por conexión y 20 s de
  duración (antes 2 s y 5 s), para que el primer ingreso en AWS no responda 500. Ninguna transacción interactiva es
  de solo lectura.
- **Hora de Lima:** la fecha de nacimiento «futura» se comparaba con el día en UTC (después de las 19:00 ya era mañana);
  el PDF de asistencia mostraba fechas ISO. PDF, CSV, pantallas y tareas programadas quedaron en hora de Lima.
- **Textos:** plurales («1 cuotas», «1 estudiantes», «1 registradas»), «Alumnos con sin nota» y la columna «Nota» del
  CSV de asistencia (era la observación).

### Seguridad y dependencias

- `npm audit`: de 17 avisos quedan 4. Se subieron, sin cambiar de versión mayor, `zod` 4.6.7, Prisma 7.10.1,
  `nodemailer` 10.6 y las transitivas de desarrollo.
- Cabeceras: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` y `Permissions-Policy` en
  todas las respuestas; PDF y CSV con `Cache-Control: private, no-store`.
- Límites: el cuerpo JSON se corta en 1 MB (413 `CUERPO_DEMASIADO_GRANDE`); los archivos siguen en 5 MB y se valida su
  tipo real (un ejecutable renombrado a .jpg se rechaza).
- Logs: sin DNI, contraseñas ni tokens en el log ni en `log_error` después del recorrido.

## Lo que quedó pendiente

1. **Vulnerabilidad crítica de `next`** (16.0.0–16.4.4: RCE en el optimizador de imágenes con SVG y otras de Server
   Actions, `use cache` y Edge). No hay parche en la 16.3 (16.3.8 es la última y es la que usa Kubo); se arregla en
   16.4.6, otra versión menor, que el encargo no permitía. Kubo no usa `next/image`, Server Actions, `use cache` ni
   rutas Edge, y se apagó el optimizador (`images.unoptimized`). **Recomendación:** subir a `next@16.4.6` en un PR
   aparte, con `npm run check` y una vuelta por las pantallas.
2. **Tres avisos altos** de las herramientas del CLI de Prisma (`@prisma/config` → `effect`, `deepmerge-ts`): solo de
   desarrollo, sin arreglo dentro de Prisma 7.
3. **Configuración del servidor del profesor.** En producción, sin configuración, Kubo apaga a propósito tres cosas:
   el almacén de archivos (subir documentos, evidencias y materiales responde «El almacenamiento de archivos no está
   disponible»), el pago en línea (no aparece «Pagar») y el correo (la recuperación de contraseña no llega). En AWS
   deben estar `ARCHIVOS_DRIVER=s3` con su bucket, `PASARELA=mercadopago` con sus credenciales de prueba y SMTP
   (`docs/DESPLIEGUE-AWS.md`). En Vercel no hay almacén de archivos: el profesor debe usar el despliegue de AWS.
4. **Datos de demostración** en el servidor del profesor: `scripts/demoRevision.ts` los crea, pero se ejecuta solo con
   la decisión del equipo y nunca contra la base del colegio.
5. **Pago en línea con la pasarela falsa** solo se puede recorrer con `next dev` (en producción la pasarela falsa se
   desactiva); se probó así y con las pruebas de integración de la pasarela.
