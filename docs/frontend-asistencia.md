# Frontend · Asistencia de alumnos: docente (DO-03), administrador (M-20), apoderado (AP-03) y alumno (AL-04)

Sprint 3, bloque 5 (US35, US36, US45, US52). Frames de la página **«1 · Prototipo escritorio»** del Figma «Kubo – Prototipo», con capturas en `docs/figma/`: `DO-03-toma-asistencia.png`, `M-20-corregir-asistencia.png`, `AP-03-asistencia-apoderado.png`, `AL-04-mi-asistencia-alumno.png` y, como referencia del estilo del administrador, `AD-14-asistencia-docente.png`. API: [horarios.md](api/horarios.md#asistencia-de-alumnos-us35-us36-us45-us52). Casos de prueba: [pruebas/casos-sprint3-asistencia.md](pruebas/casos-sprint3-asistencia.md).

## Archivos

```
src/components/portal/asistencia.tsx            Estados y colores de asistencia, carga con sus cuatro estados, vacío
src/components/docente/asistencia.tsx           DO-03: lista editable, contadores, solo lectura y registros anteriores
src/app/(portal)/docente/asistencia/page.tsx    DO-03: clases de hoy, sesión elegida y registros anteriores (US35, US36)
src/components/admin/asistencia.tsx             Lista de una sesión para el administrador y modal M-20 (US36)
src/app/(portal)/admin/asistencia/page.tsx      «Asistencia de alumnos» del administrador (US36, criterio 3)
src/app/(portal)/apoderado/asistencia/page.tsx  AP-03: resumen mensual del hijo elegido (US45)
src/app/(portal)/alumno/asistencia/page.tsx     AL-04: «Mi asistencia» del alumno (US52)
src/lib/formato.ts                              mesLargo, nombreMes, sumarMeses, diaYHora y diaSemanaCorto
```

Menús: «Asistencia» del docente y del apoderado y «Mi asistencia» del alumno dejan de ser «Próximamente». El administrador tiene una opción nueva, «Asistencia de alumnos», en el grupo ACADÉMICO, sobre «Asistencia docente» (que sigue «Próximamente»). Los inicios DO-01, AP-01 y AL-01 tienen ahora una tarjeta de acceso a la asistencia.

## DO-03 · Toma de asistencia del docente (US35, US36)

`/docente/asistencia`.

1. **Clases de hoy** (`GET /horarios/asistencia/clases-de-hoy`): selector «Clase de hoy» con «Matemática · 3° A · 09:15» y, si ya se registró, «· registrada». Al lado, la fecha de hoy en un campo deshabilitado: solo se registra el día actual. Se elige por defecto la primera clase sin registro.
2. **Sesión elegida** (`POST /horarios/asistencia/sesiones`): «Asistencia · Matemática 3° A» y «lunes 16 de noviembre de 2026 · 09:15 – 10:00 · Aula 204 · 7 estudiantes». La sesión se crea al elegir la clase.
3. **Lista** (`ListaAsistencia`): botón verde «Marcar todos como presentes» (solo a los que aún no tienen estado), contadores «presentes · tardanzas · ausentes · justificados · sin marcar» que cambian al marcar, y una fila por alumno ordenada por apellido: N.º, «Apellidos, Nombres», lista desplegable «Presente / Tardanza / Ausente / Justificado» del color de su estado, faltas y tardanzas del bimestre en este curso (las faltas que llegan a `UMBRAL_FALTAS_MES` se resaltan en rojo) y «Agregar nota».
4. **Guardar asistencia** (`PUT …/registros`): si falta marcar a alguno, alerta roja «Existen alumnos sin estado de asistencia registrado» con «Falta marcar a: Lima Sánchez, Hugo y Mora Díaz, Renata.»; esas filas se resaltan en rojo y dejan de resaltarse al marcarlas. Al guardar: «Asistencia guardada.» y, si se envió un aviso por umbral, «Se envió el aviso por inasistencias al alumno y a su apoderado.».
5. **Plazo (US36):** al pie, «Puedes corregir este registro hasta el 17/11 a las 09:20» y el botón pasa a «Guardar cambios». Si una fila se corrigió, debajo del nombre se lee «Corregido el 16/11 a las 10:05 · antes: Ausente». Pasado el plazo, los campos quedan deshabilitados y aparece la alerta ámbar «El plazo para modificar esta asistencia ha expirado (24 horas)» con «Si necesitas corregirla, solicítalo a la administración; el cambio quedará en la bitácora de auditoría.».
6. **Registros anteriores** (`GET /horarios/asistencia/sesiones`): las sesiones del docente de los últimos 7 días, con la fecha, el bloque, el curso, «Registro guardado el …», los contadores (P · T · A · J), la insignia «Asistencia registrada» o «Solo lectura» y «Abrir» o «Ver».
7. **Sin clases:** tarjeta con el mensaje del servidor («Hoy no hay clases: es fin de semana.», «No tienes clases programadas para hoy en el horario publicado.», …) y «La asistencia se registra el mismo día de la clase, según el horario publicado por la institución.». Los registros anteriores se siguen mostrando.

**Celular:** cada alumno es una tarjeta: nombre, lista desplegable a todo el ancho, «Faltas: 2 · Tardanzas: 1» y el campo de nota. La tabla de seis columnas aparece desde 1024 px.

## Asistencia de alumnos del administrador y M-20 (US36, criterio 3)

`/admin/asistencia`. **No hay frame de esta lista en el Figma:** AD-14 solo trae la pestaña «Asistencia de alumnos» junto a «Asistencia docente», sin su contenido. Se armó con el estilo de AD-13 y AD-14 (migas «Académico / …», título de 32 px, tarjeta de filtros y tabla).

- **Filtros:** «Fecha» (por defecto hoy, no permite fechas futuras) y «Sección» (las de las sesiones de esa fecha).
- **Tabla de sesiones:** Hora, Curso, Sección, Docente, «Registro» («Asistencia registrada», «Solo lectura» o «Sin registrar») y P · T · A · J. «Ver lista» abre la sesión debajo.
- **Lista de la sesión:** «Matemática · 3° A», la fecha, la hora, el aula y el docente, cuándo se guardó y si el docente aún puede corregirla. Una fila por alumno con su DNI, el estado, la observación, la última corrección («16/11 a las 10:05 · J. Pérez · antes: Ausente» y el motivo) y «Corregir».
- **M-20 «Corregir asistencia fuera de plazo»** (`POST /horarios/asistencia/registros/{id}/corregir`): el alumno con sus iniciales, sección y DNI; «Sesión de clase» con curso, fecha, hora, estado actual, «Registrado por» y «Fecha del registro»; «Nuevo estado» con las otras tres opciones como pastillas; «Motivo del cambio» (obligatorio, mínimo 5 caracteres) y el aviso «Este cambio quedará registrado en la bitácora de auditoría». «Guardar corrección» se habilita con estado y motivo. Al guardar, la lista se actualiza y aparece «Corrección guardada: la asistencia de … quedó registrada en la bitácora.».
- **Vacío:** «No hay asistencia registrada en esta fecha» con qué hacer.

## AP-03 · Asistencia del hijo (US45)

`/apoderado/asistencia`, del hijo elegido en la barra superior.

- **Navegación por mes:** flechas «Mes anterior / siguiente» y selector «noviembre de 2026», entre el primer mes del año escolar y el actual.
- **Alerta del año:** si el hijo llega al umbral de aviso o de riesgo, alerta ámbar o roja con el porcentaje («En el año lleva 9 % de inasistencias injustificadas … El colegio avisa al llegar al 15 % y el límite institucional es 20 %.»).
- **Alerta del mes (US45, criterio 2):** «Atención: 3 inasistencias injustificadas este mes» con «Valeria faltó el 2, 4 y 9 de noviembre sin justificación. Si tienes una constancia, preséntala al tutor de la sección.».
- **Calendario:** lunes a viernes; cada día con su insignia «Presente», «Tardanza», «Ausente» (fondo rojo claro) o «Justificado», «Vacaciones» entre bimestres y en blanco los días aún sin registro. En el celular se reemplaza por la lista de días con estado.
- **Resumen del mes:** días Presente, Tardanza, Ausente y Justificado, «Días con clases registradas» y la insignia «81 % de asistencia».
- **Inasistencias y tardanzas:** de la más reciente a la más antigua: «Ausente todo el día · Sin justificación», o la clase («Inglés · 07:45 · Llegó 07:58 · L. Campos») con la **observación del docente** (US35, criterio 4).
- **Sin registros:** «No hay registros de asistencia disponibles para este periodo».

## AL-04 · Mi asistencia (US52)

`/alumno/asistencia`.

- **Cuatro indicadores:** faltas y tardanzas del bimestre («Bimestre IV») y del año («Desde el 02/03/2026»). Debajo, cuántos días justificados tiene (no cuentan para el límite).
- **Nivel de riesgo:** insignia «Sin riesgo», «En aviso» o «En riesgo»; «7,5 % de inasistencias en el año», «Umbral institucional: 20 %», una barra con la marca del umbral, «9 faltas de 120 días de clase del año» (o «1 falta de 28 días de clase desde tu matrícula» si se matriculó con el año empezado) y «Te quedan 14 faltas antes del umbral» («Te queda 1 falta…» en singular). Desde D-11 la base son los días de clase desde la matrícula y las faltas restantes son las que aún no llegan al umbral.
- **Alertas:** «Te acercas al límite de inasistencias» (aviso) o «Estás en riesgo por inasistencias» (riesgo) con «Acumulas el 21 % de inasistencias. Conversa con tu tutor para evitar consecuencias académicas.», y la alerta del mes «Atención: N inasistencias injustificadas este mes».
- **Detalle del bimestre:** Fecha, Clase («Día completo» o «Inglés · 07:45»), Tipo («Falta», «Tardanza», «Justificado») y Detalle.
- **Sin faltas ni tardanzas:** «¡Felicidades! No registras inasistencias este periodo» en lugar de los contadores en cero.

## Estados de cada pantalla

Todas resuelven cargando (indicador), error (`Alerta` con el mensaje del servidor y «Reintentar»), vacío (mensaje del backlog o qué hacer) y con datos. Los errores de sesión redirigen al login, al cambio de contraseña o a «Acceso denegado».

## Diferencias con el Figma

| En el Figma | En la pantalla | Motivo |
|---|---|---|
| DO-03: menú desplegable propio con puntos de color | `select` nativo coloreado según el estado | Es accesible con teclado y lectores de pantalla y funciona igual en el celular |
| DO-03: «Clase anterior · lunes 14/09 · 11:50» debajo de la lista | «Registros anteriores» con las sesiones de los últimos 7 días, abribles | Permite corregir cualquier clase dentro del plazo, no solo la anterior |
| DO-03: campo de fecha editable | Fecha deshabilitada con la de hoy | No se registra asistencia de días pasados ni futuros (US35) |
| DO-03: columnas «Faltas» y «Tardanzas» del bimestre | Igual, contadas en ese curso | El Figma lo dice así («acumuladas del bimestre III en este curso») |
| M-20: se abre desde «contactar al administrador» | Se abre desde «Corregir» en la lista de la sesión, en `/admin/asistencia` | La pantalla de la lista no existe en el Figma (ver arriba) |
| AP-03: aviso por umbral anual («el aviso por umbral anual se envía al 15 %…») siempre visible | Alerta del año solo al llegar al aviso o al riesgo | Evita un aviso permanente cuando no hay riesgo |
| AP-03: «Tutora de 3° B, Ana Vega» en la alerta | «el tutor de la sección» | El tutor de la sección no forma parte de la respuesta de asistencia |
| AP-03: «Llegó 07:58» para una tardanza | La observación que escribió el docente | El sistema no guarda la hora de llegada; el docente la anota en la observación |
| AL-04: tarjetas laterales «Si superas el umbral» y «Si no tienes faltas» | Se muestra la que corresponde, en el cuerpo de la página | En el Figma son ejemplos de estados, no contenido fijo |

## Accesibilidad

- Cada lista desplegable tiene `aria-label` «Estado de asistencia de …» y `aria-invalid` cuando falta marcarla; los contadores se anuncian con `aria-live`.
- El calendario y las tablas usan cabeceras; la barra de riesgo es un `role="meter"` con su valor.
- Las pastillas de M-20 usan `aria-pressed`; las flechas de mes, `aria-label`.

## Pendiente

- ~~Notificación dentro de la aplicación por los umbrales (US55)~~: hecho en el bloque 9 para los avisos del 15 % y del 20 % ([frontend-notificaciones.md](frontend-notificaciones.md)).
- Dibujar en el Figma la lista «Asistencia de alumnos» del administrador y las vistas del celular de DO-03 y AP-03.
- Feriados: los días de clase del año son los de lunes a viernes dentro de los bimestres; no hay calendario de feriados.
