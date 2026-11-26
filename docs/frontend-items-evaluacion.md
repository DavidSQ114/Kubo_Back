# Frontend · Ítems de evaluación con pesos, competencias del docente, libreta y reportes del coordinador (bloque M2)

Bloque M2 (sprint 4). API: [api/evaluacion.md](api/evaluacion.md#ítems-de-evaluación-con-pesos-bloque-m2),
[api/evaluacion.md · reportes](api/evaluacion.md#reportes-del-coordinador-bloque-m2) y
[api/academico.md](api/academico.md) («Competencias de mi curso»). Casos de prueba:
[pruebas/casos-sprint4-items.md](pruebas/casos-sprint4-items.md). Avance por fases: [progreso/M2.md](progreso/M2.md).

## Archivos

```
src/app/(portal)/docente/notas/page.tsx            DO-04: botón «Competencias de mi curso», modal «Ítems», importar CSV
src/components/docente/competencias.tsx           ModalCompetenciasDelCurso (reusa EditorCompetencias de AD-04)
src/components/docente/notas.tsx                  GrillaNotas con sub-columnas por ítem, nota calculada y total de pesos
src/components/docente/items.tsx                  ModalItems (agregar, editar, ordenar, eliminar, total) y ModalImportarCsv
src/components/portal/libreta.tsx                 AP-04 y AL-03: una fila por ítem bajo su competencia
src/app/(portal)/coordinador/notas-alumno/page.tsx          «Notas por alumno»
src/app/(portal)/coordinador/reporte-competencias/page.tsx  «Reporte de logro de competencias» con CSV y PDF
src/components/coordinador/PortalCoordinador.tsx  menú: «Notas por alumno» y «Logro de competencias»
```

## Pantallas

- **DO-04 · Registro de notas.** Cada competencia tiene en su encabezado el botón «Ítems» (solo con el registro
  abierto y en el bimestre activo) y, si tiene ítems, su total de pesos: «100 %» en verde u otro valor en rojo. Una
  competencia con ítems ocupa una sub-columna por ítem (nombre y peso) para calificarlo con AD, A, B o C, y una
  columna «Nota Cx calculada» en solo lectura; si falta la nota, muestra «—» con un ícono de aviso y el porqué al pasar
  el cursor (y para lectores de pantalla). Arriba de la tabla, un aviso lista las competencias cuyos pesos no suman
  100 %. El avance del registro, las evidencias (US38) y el consolidado siguen igual. Desde 1024 px la tabla se
  desplaza dentro de su tarjeta y la columna del estudiante queda fija; a 1366 px la página no se desborda. En el
  celular, cada competencia con ítems es un bloque con su nota, el porqué y sus ítems en una columna.
- **Modal «Ítems».** Lista editable (nombre y peso), subir y bajar, eliminar, «Agregar ítem», total en verde o rojo y
  un aviso si no suma 100 %. Si el servidor pide confirmación, explica qué se pierde (ítems con calificaciones,
  alumnos que quedan sin nota, evidencias) y el botón pasa a «Confirmar y guardar». No se abre con cambios sin
  guardar en la grilla. Cada ítem guardado ofrece «Importar calificaciones (CSV)».
- **Importar CSV.** Elige un archivo `dni;calificativo` (también con comas), muestra cada fila válida o rechazada con su motivo y
  «Importar N calificaciones» guarda solo las válidas.
- **Competencias de mi curso.** Modal con el editor de AD-04 apuntando al endpoint del docente; aviso de que el cambio
  aplica a todas las secciones del grado (las lista) y, con notas en el año, solo lectura con el motivo.
- **AP-04 / AL-03 y sus PDF.** Bajo cada competencia publicada, sus ítems con peso y calificativo.
- **Notas por alumno.** Año, búsqueda por DNI o nombre (usa la búsqueda de matrículas), lista de coincidencias y la
  libreta del año por bimestre: cada curso con su insignia («Publicado» en verde; «Sin publicar · …» en ámbar), sus
  competencias, ítems y consolidado.
- **Reporte de logro de competencias.** Aviso «Solo se incluyen registros cerrados por el docente o publicados»,
  filtros (año, bimestre, grado, sección, curso), «Descargar CSV» y «Descargar PDF», y por curso una tabla por
  competencia con cantidad y porcentaje de AD, A, B y C, una barra apilada (los números están en la tabla) y «Detalle
  por alumno» desplegable.

## Diferencias con el Figma

- El Figma «Kubo – Prototipo» no tiene frames para los ítems de evaluación, «Competencias de mi curso», la importación
  CSV ni los reportes del coordinador: se construyeron con las piezas de `components/ui` y el estilo de DO-04, AD-04,
  AD-15 y AP-04.
- El portal de gestión (administrador y coordinador) sigue sin ser responsivo, como antes del bloque: a 390 px la
  página se ensancha. Los portales del docente, apoderado y alumno sí se revisaron a 390 px.
