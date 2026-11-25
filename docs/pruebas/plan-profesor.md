# Plan de pruebas del profesor · resultado de la revisión final (bloque M5)

> Recorrido del 25/11/2026 sobre una base temporal con `prisma/seed.sql` y `scripts/demoRevision.ts` (solo datos
> ficticios, RNF14), con la aplicación compilada en modo producción. Cada fila se hizo con el rol del Excel
> `docs/pruebas/Plan_de_Pruebas_26-2.xlsx`, completa en el navegador y con al menos un caso inválido. La copia con las
> columnas Estado y Observación llenas es `docs/pruebas/Plan_de_Pruebas_26-2_kubo.xlsx`; el detalle de lo corregido
> está en `docs/REVISION-FINAL.md`.

**Estados:** **OK** (funciona sin cambios), **Corregido** (falló algo en el recorrido y se corrigió con su prueba),
**No implementado (COULD)** (opcional del Excel que no se construyó).

**Resumen:** 63 filas funcionan (52 OK y 11 Corregido) y 3 son COULD no implementadas (login con Gmail y las dos de
evaluación vigesimal). Las demás COULD (modificar perfil, parámetros, bimestres, reglas, cotutor, matrícula manual,
importar CSV, asistencia docente y justificar falta) sí están implementadas y quedaron OK.

## Datos de prueba

### Cuentas ficticias por rol

Todas usan la misma contraseña inicial del administrador del seed; no se escribe aquí (la tiene el equipo). En otro
ambiente, las cuentas se crean con `scripts/demoRevision.ts` (ver al final).

| Correo | Rol | Para qué sirve |
|---|---|---|
| `admin@kubo.edu.pe` | Administrador | Usuarios, espacios, parámetros, asistencia docente, auditoría |
| `coordinacion@kubo.edu.pe` | Coordinador académico | Año, secciones, cursos, horarios, matrícula, pagos, notas |
| `docente.mat@demo.kubo.test` | Docente · **tutora de 1.° A** | Matemática en 1.° A, 1.° B y 2.° A; «Mi tutoría» de 1.° A |
| `docente.com@demo.kubo.test` | Docente · **cotutor de 1.° A** | Comunicación en 1.° A, 1.° B y 2.° A |
| `docente.cyt@demo.kubo.test` | Docente · **tutora de 1.° B** | Ciencia y Tecnología en 1.° A y 1.° B |
| `docente.ing@demo.kubo.test` | Docente (sin tutoría) | Inglés en 1.° A y 1.° B |
| `apoderado.quispe@demo.kubo.test` | Padre o apoderado | Padre de Valeria (1.° A) y Mateo (1.° B) |
| `apoderado.rojas@demo.kubo.test` | Padre o apoderado | Madre de Valeria (1.° A) y de Lucía (sin matrícula: matrícula en línea) |
| `apoderado.flores@demo.kubo.test` | Padre o apoderado | Madre de Camila (1.° A) y Diego (2.° A): sirve para pedir datos de hijos ajenos |
| `alumna.valeria@demo.kubo.test` | Alumno | Portal del alumno de Valeria |

### Datos académicos

- Año 2026 «En curso» (02/03 al 18/12), bimestres I a IV (el IV, del 19/10 al 18/12, es el activo), regla «Promedio
  ponderado». Montos: matrícula S/ 350.00, pensión S/ 450.00, ingreso S/ 200.00 y mora S/ 20.00.
- Aulas: Aula 101, Aula 102, Aula 201 y Laboratorio de Ciencias. Secciones: 1.° A (Aula 101), 1.° B (Aula 102) y 2.° A
  (Aula 201). Cursos MAT, COM, CYT e ING en 1.° y 2.°, con 3 competencias y 5 h semanales.
- Horarios publicados de 1.° A y 1.° B (lunes a viernes, cuatro primeras horas).
- Estudiantes (DNI ficticios): Valeria 78400001 (1.° A), Mateo 78400002 (1.° B), Camila 78400003 (1.° A),
  Diego 78400004 (2.° A), Lucía 78400005 (sin matrícula). Docentes 70100001–70100004; apoderados 41200001–41200003.
- Valeria tiene pagadas la matrícula y la cuota de ingreso (operación OP-0001). Matemática 1.° A del IV bimestre está
  calificada con ítems (Práctica 40 % y Examen 60 %), cerrada y publicada; Comunicación 1.° A tiene notas parciales.

## Resultado por fila

| # | Rol | Funcionalidad | COULD | Estado | Pantalla | Pasos y caso inválido | Datos |
|---|---|---|---|---|---|---|---|
| 1 | General | Login con usuario propio | | OK | `/login` (AC-01) | Ingresar con correo y contraseña → portal del rol. Inválido: contraseña errada → «Correo o contraseña incorrectos»; 5 fallos → cuenta bloqueada (423) | Cualquier cuenta de la tabla |
| 2 | General | Login con Gmail | x | No implementado (COULD) | — | Kubo usa cuentas propias del colegio | — |
| 3 | General | Ver datos de perfil | | OK | `/perfil` | Menú «Mi perfil»: nombres, DNI enmascarado, correo y último ingreso | Cualquier cuenta |
| 4 | General | Modificar datos de perfil | x | OK | `/perfil` | Cambiar teléfono y dirección → «Tus datos de contacto se guardaron». Inválido: teléfono de 5 dígitos | Teléfono 987654321 |
| 5 | General | Recordar contraseña | | OK | `/recuperar` → `/restablecer` | «¿Olvidaste tu contraseña?» → correo con enlace (30 min, un solo uso) → nueva contraseña. Responde igual exista o no el correo; correo mal escrito → error; contraseña débil; enlace ya usado → 410 «ENLACE_EXPIRADO». Necesita SMTP en el servidor | `docente.cyt@demo.kubo.test` |
| 6 | General | Cambiar contraseña | | Corregido | `/cambiar-password` (AC-09) | Contraseña actual + nueva dos veces → mensaje de éxito. Inválido: actual errada → «La contraseña actual no es correcta»; nueva débil → botón deshabilitado | Nueva: 8+ caracteres, mayúscula y número |
| 7 | Administrador | Verificar accesos de administrador | | OK | Menú del administrador | Ve Usuarios, Espacios, Parámetros, Asistencia docente y Auditoría. Por URL a `/coordinador/*`, `/docente/*` o `/apoderado/*` vuelve a `/admin`; la API de esos portales responde 403 | `admin@kubo.edu.pe` |
| 8 | Administrador | Listar usuarios | | OK | `/admin/usuarios` (AD-06) | Pestañas por rol, búsqueda por nombre, correo o DNI, filtro por estado y paginación | Buscar «Quispe» |
| 9 | Administrador | Registrar usuario | | Corregido | `/admin/usuarios/registrar-*` | Registrar docente, apoderado, estudiante, coordinador o administrador → contraseña temporal. Inválido: vacíos, DNI de 7 dígitos, DNI repetido «Ya existe un usuario registrado con este DNI» | DNI nuevo 70100005 |
| 10 | Administrador | Modificar usuario | | OK | `/admin/usuarios` → Editar | Cambiar teléfono o dirección → revisar cambios → guardar (queda en el historial). Inválido: teléfono de 8 dígitos | Luis Paredes |
| 11 | Administrador | Bloquear usuario | | OK | `/admin/usuarios` → Suspender acceso | Motivo obligatorio → «Se suspendió el acceso». Ese usuario ve «Tu acceso está suspendido…». Inválido: sin motivo, el botón no se habilita | Jorge Castro |
| 12 | Administrador | Desbloquear usuario | | OK | `/admin/usuarios` → Desbloquear | Tras 5 intentos fallidos aparece «Bloqueada por intentos» → Desbloquear → vuelve a ingresar | `docente.ing@demo.kubo.test` |
| 13 | Administrador | Actualizar parámetros del sistema | x | OK | `/admin/parametros` | Cambiar un valor → «Se actualizó…» con fecha y hora de Lima. Inválido: intentos = 2 → «Ingresa un número entero entre 3 y 10» | MAX_INTENTOS_LOGIN = 6 |
| 14 | Administrador | Listar espacios | | OK | `/admin/espacios` (AD-03) | Aulas con ubicación, aforo, sección asignada y ocupación del año | — |
| 15 | Administrador | Agregar espacio | | OK | `/admin/espacios` → Registrar aula | Nombre, ubicación y aforo. Inválido: nombre repetido «Ya existe un aula con ese nombre»; aforo 0 | Aula 305, aforo 28 |
| 16 | Administrador | Modificar espacio | | OK | `/admin/espacios` → Editar | Cambiar el aforo. Inválido: menor que el aforo de su sección → «El aforo del aula no puede ser menor…» | Aula 101 → 32 |
| 17 | Administrador | Desactivar espacio | | Corregido | `/admin/espacios` → Desactivar | Aula sin sección → «quedó desactivada» (se puede activar). Inválido: Aula 101 (la usa 1.° A) → no se desactiva y pide a la coordinación quitarla | Aula 305 / Aula 101 |
| 18 | Coordinador académico | Verificar accesos del coordinador | | OK | Menú del coordinador | Año, grados y secciones, cursos, reglas, asignaciones, matrícula, pagos, horarios, asistencia y notas. Por URL a `/admin/*` vuelve a `/coordinador`; usuarios, parámetros y auditoría responden 403 | `coordinacion@kubo.edu.pe` |
| 19 | Coordinador académico | Configurar secciones por grado | | OK | `/coordinador/grados` (AD-03) | Crear sección con aforo, aula y tutor. Inválido: «1° a» repetida → «Ya existe una sección con ese nombre en este grado»; aforo mayor que el aula | 2.° A |
| 20 | Coordinador académico | Configurar periodos (bimestres) | x | OK | `/coordinador/anio` | Cuatro bimestres con fechas. Inválido: bimestres solapados → «Los periodos de evaluación no pueden solaparse» | Año 2026 |
| 21 | Coordinador académico | Reglas de consolidación por competencia | x | OK | `/coordinador/reglas` | Elegir método (moda o ponderado) y desde qué bimestre rige; simular. Inválido: sin bimestre → «Elige el bimestre desde el que regirá…» | Promedio ponderado |
| 22 | Coordinador académico | Asignar tutor | | OK | `/coordinador/grados` → Editar sección | Elegir tutor. Inválido: un docente que ya es tutor o cotutor → «… Un docente tiene una sola tutoría por año» | Rosa Huamán en 1.° A |
| 23 | Coordinador académico | Asignar cotutor | x | OK | `/coordinador/grados` → Editar sección | Elegir cotutor; ve «Mi tutoría» igual que el tutor | Luis Paredes en 1.° A |
| 24 | Coordinador académico | Configurar proceso de matrícula | | OK | `/coordinador/proceso-matricula` | Fechas de inicio y fin y documentos requeridos (obligatorio u opcional). Inválido: sin fechas → «Elige la fecha de inicio»; documento sin nombre | 20/11 al 15/12/2026 |
| 25 | Coordinador académico | Asignar alumnos por sección | | OK | `/coordinador/matricula` y `/coordinador/solicitudes-matricula` | Matricular en una sección con vacantes (o asignar la sección a una solicitud aprobada). Inválido: sin sección → «Elige la sección»; alumno ya matriculado → «Este estudiante ya está matriculado…» | Lucía → 1.° A |
| 26 | Coordinador académico | Visualizar notas por alumno | | Corregido | `/coordinador/notas-alumno` | Buscar al alumno → libreta completa del año con lo no publicado marcado; abre en el último bimestre con notas | Valeria, Bimestre IV |
| 27 | Coordinador académico | Visualizar estado de cuenta por alumno | | Corregido | `/coordinador/pagos` | Buscar alumno → «Ver estado de cuenta»: cronograma, pagado, pendiente, vencido, operaciones y log | Mateo |
| 28 | Coordinador académico | Registrar pago de cuota | | OK | `/coordinador/pagos` → Registrar pago | Elegir cuotas en orden, monto, fecha, N.° de operación y medio → recibo PDF. Inválido: sin N.° de operación; monto que no coincide → «El monto ingresado no coincide…» | Mateo: matrícula + ingreso = S/ 550.00 |
| 29 | Coordinador académico | Registrar montos de cuotas ordinarias | | OK | `/coordinador/matricula` → Editar montos | Matrícula, pensión, ingreso y mora del año. Inválido: monto con letras o tres decimales | 350 / 450 / 200 / 20 |
| 30 | Coordinador académico | Cuotas extraordinarias por grupo o individual | | Corregido | `/coordinador/cuotas-extraordinarias` | Concepto, monto, vencimiento y destino (alumno, sección, grado o año) → vista previa → generar. Inválido: vacíos → «Escribe el concepto», «Ingresa el monto» | Paseo S/ 35.50 a 1.° A |
| 31 | Coordinador académico | Verificar documentos de matrícula | | Corregido | `/coordinador/solicitudes-matricula` → Revisar | Abrir cada documento, aprobar u observar con motivo; con todo aprobado, asignar sección. Inválido: observar sin motivo; el apoderado reemplaza con un archivo que no es PDF/JPG real → rechazado | Solicitud de Lucía |
| 32 | Coordinador académico | Matrícula manual | x | OK | `/coordinador/matricula` | Buscar estudiante → sección, responsable y modalidad → confirmar (genera cronograma) | Estudiante registrado sin matrícula |
| 33 | Coordinador académico | Registrar nuevo alumno | | OK | `/coordinador/matricula/registrar-estudiante` | Datos, grado de ingreso y al menos un apoderado. Inválido: sin apoderado → «Debe asociar al menos un apoderado…»; DNI repetido | DNI nuevo 78400009 |
| 34 | Coordinador académico | Modificar datos del alumno | | OK | `/coordinador/alumnos-apoderados` → Ver detalle → Editar | Cambiar teléfono y dirección → confirmar → historial de cambios. Inválido: teléfono de 8 dígitos | Diego |
| 35 | Coordinador académico | Registrar retiro del alumno | | OK | `/coordinador/matricula` → matrícula → Registrar retiro | Fecha y motivo → «Retirado»; se anulan las pensiones posteriores. Inválido: sin motivo → «Seleccione el motivo del retiro» | Diego, traslado |
| 36 | Coordinador académico | Configurar cursos por grado | | OK | `/coordinador/cursos` | Grados y horas semanales de cada curso del año. Inválido: 0 horas | MAT en 1.° y 2.°, 5 h |
| 37 | Coordinador académico | Configurar mapa de competencias | | OK | `/coordinador/cursos` → Competencias | Competencias del área por grado (con peso opcional). Inválido: ninguna → «Debes seleccionar al menos una competencia»; competencia de otra área | MAT 1.°: C1–C3 |
| 38 | Coordinador académico | Registrar cursos por grado | | OK | `/coordinador/cursos` → Nuevo curso | Código, nombre, área y grados. Inválido: sin área; código repetido | — |
| 39 | Coordinador académico | Curso por sección (profesor responsable) | | OK | `/coordinador/asignaciones` | Docente por curso y sección. Inválido: el curso ya tiene docente en la sección → «Este curso ya tiene otro docente asignado…» | Matemática → Rosa Huamán |
| 40 | Coordinador académico | Horario por sección con cruces | | OK | `/coordinador/horarios` (AD-13) | Asignar curso, docente y aula por bloque y publicar. Inválido: recreo; cruce de docente; aula ocupada; publicar con horas faltantes | 1.° A y 1.° B |
| 41 | Coordinador académico | Forma de evaluación (competencias o vigesimal) | x | No implementado (COULD) | — | Kubo evalúa solo por competencias (AD, A, B, C) | — |
| 42 | Coordinador académico | Reporte de logro de competencias | | OK | `/coordinador/reporte-competencias` | Filtros de año, bimestre, grado, sección y curso; descarga CSV y PDF | 2026 · Bimestre IV |
| 43 | Coordinador académico | Reporte de logro con notas vigesimales | x | No implementado (COULD) | — | Depende de la evaluación vigesimal | — |
| 44 | Docente | Verificar accesos del docente | | OK | Menú del docente | Ve horario, asistencia, notas y aula virtual; «Mi tutoría» solo si es tutor o cotutor. El registro de otra sección y los portales ajenos responden 403 | `docente.ing@demo.kubo.test` |
| 45 | Docente | Asignar competencias al curso | | Corregido | `/docente/notas` → Competencias de mi curso | Marcar las competencias mientras el curso no tenga notas en el año. Inválido: con notas → «…pídelo a la coordinación académica»; competencia de otra área | Matemática 2.° A |
| 46 | Docente | Registrar ítems de evaluación y pesos | | OK | `/docente/notas` → Ítems | Ítems con pesos que suman 100. Inválido: peso 0; si dejan de sumar 100 pide confirmación | Práctica 40 %, Examen 60 % |
| 47 | Docente | Registrar calificación manual | | OK | `/docente/notas` (DO-04) | AD, A, B o C por alumno y competencia → guardar. Inválido: «15» → «Solo se permiten los valores AD, A, B o C» | Matemática 1.° B |
| 48 | Docente | Importar calificaciones de un ítem | x | OK | `/docente/notas` → Ítem → Importar CSV | `dni,calificativo` → vista previa con rechazadas → guardar las válidas. Inválido: DNI que no es de la sección; «15» | `78400002,AD` |
| 49 | Docente | Visualizar notas consolidadas por curso | | OK | `/docente/notas` | Columna «Consolidado» por alumno con la regla vigente; avance del registro | Matemática 1.° A |
| 50 | Docente | Modificar calificación registrada | | OK | `/docente/notas` | Cambiar una nota con el registro abierto (queda el anterior). Inválido: registro cerrado → «Este registro está cerrado…» y «Solicitar rectificación» | Matemática 1.° B |
| 51 | Docente | Registrar asistencia docente | x | OK | `/admin/asistencia-docente` (AD-14) | La registra el administrador: «Marcar Asistió» (Puntual o Tardanza en hora de Lima); a la hora límite, falta automática | Rosa Huamán |
| 52 | Tutor | Verificar accesos del tutor | | OK | `/docente/tutoria` | Menú «Mi tutoría» solo para tutor o cotutor; la tutoría de otra sección responde 403 `NO_ES_TUTOR` | `docente.mat@demo.kubo.test` |
| 53 | Tutor | Registrar asistencia de los alumnos | | OK | `/docente/tutoria/asistencia` | Elegir clase del día → estado de cada alumno → guardar. Inválido: alumnos sin marcar → «Existen alumnos sin estado de asistencia registrado» | 1.° A, Matemática |
| 54 | Tutor | Modificar asistencia | | OK | `/docente/tutoria/asistencia` | Cambiar un estado con motivo (queda «Corregido… antes: Presente»). Inválido: sin motivo, el botón no se habilita | Camila → Tardanza |
| 55 | Tutor | Falta o tardanza justificada | | OK | `/docente/tutoria/asistencia` → Justificar falta | Motivo → «Justificado». También revisa las justificaciones de los apoderados en «Justificaciones». Inválido: sin motivo | Valeria |
| 56 | Tutor | Reporte de faltas y tardanzas por bimestre | | OK | `/docente/tutoria/reporte` | Tabla por alumno con totales; descarga CSV y PDF | 1.° A · Bimestre IV |
| 57 | Tutor | Registrar nota de conducta | | Corregido | `/docente/tutoria/conducta` | AD, A, B o C y comentario por alumno → guardar; aparece en la libreta cuando el bimestre se publica. Un bimestre finalizado queda en solo lectura | Camila → B |
| 58 | Tutor | Visualizar notas por alumno | | Corregido | `/docente/tutoria/notas` | Libreta completa del alumno (también lo no publicado); abre en el último bimestre con notas | Valeria |
| 59 | Tutor | Consolidado de notas de la sección | | OK | `/docente/tutoria/consolidado` | Matriz alumno × curso con conducta y resumen AD/A/B/C; CSV | 1.° A · Bimestre IV |
| 60 | Padre o apoderado | Verificar accesos del apoderado | | OK | Menú del apoderado | Solo sus hijos: libreta, PDF, pagos, comprobantes, asistencia, horario y documentos de otro alumno responden 403 o 404; por URL vuelve a `/apoderado` | `apoderado.flores@demo.kubo.test` |
| 61 | Padre o apoderado | Matricular hijo | | Corregido | `/apoderado/matricula` | Confirmar datos, grado, responsable y subir documentos (PDF o JPG ≤ 5 MB) → «Documentos en revisión». Inválido: archivo .txt → «Reemplaza los archivos marcados…»; faltan obligatorios | Lucía (apoderada Rojas) |
| 62 | Padre o apoderado | Pagar cuotas pendientes por hijo | | OK | `/apoderado/pagos` → Pagar | Elegir cuotas en orden → «Ir a pagar» → pasarela (Mercado Pago de prueba) → «Pago aprobado» con recibo. Inválido: quitar la matrícula quita lo que depende de ella y deshabilita el pago. Solo aparece si el servidor tiene la pasarela configurada | Mateo: matrícula + ingreso = S/ 550.00 |
| 63 | Padre o apoderado | Historial de pagos por hijo | | OK | `/apoderado/pagos` | Cronograma con estado, fecha de pago y comprobante PDF de cada cuota pagada | Valeria |
| 64 | Padre o apoderado | Justificar falta o tardanza | x | OK | `/apoderado/asistencia` → Justificar | Motivo y constancia opcional → «Pendiente de revisión»; el tutor la aprueba o rechaza. Inválido: sin motivo, no se envía | Mateo, 25/11 |
| 65 | Padre o apoderado | Notas consolidadas por hijo | | OK | `/apoderado/notas` (AP-04) | Libreta por bimestre con logro del curso; descarga PDF. Lo no publicado sale «Pendiente de publicación» | Valeria, Bimestre IV |
| 66 | Padre o apoderado | Detalle de notas (ítems de evaluación) | | OK | `/apoderado/notas` | Cada competencia con ítems muestra el calificativo y el peso de cada ítem | Práctica 40 % A, Examen 60 % B |

## Cómo preparar los datos en otro ambiente

1. Una base nueva con las migraciones y el seed (`npm run db:deploy` y `npm run db:seed:remoto` con su `DATABASE_URL`).
2. La aplicación levantada con esa base y, para las filas de archivos, pagos y correos, `ARCHIVOS_DRIVER`, la pasarela y
   SMTP configurados (`docs/DESPLIEGUE-AWS.md`).
3. `KUBO_URL=<url de la aplicación> KUBO_CLAVE_DEMO=<contraseña inicial del seed> npx tsx --env-file=.env scripts/demoRevision.ts`.

Nunca contra `kubo_dev` ni contra la base que usa el colegio: el script crea el año 2026 en curso y datos ficticios.
