# Frontend · Año académico y bimestres (AD-02)

Pantalla `/admin/anio`, conectada a la API de [academico.md](api/academico.md). Casos de prueba en [pruebas/casos-academico.md](pruebas/casos-academico.md).

## Archivos

```
src/app/(portal)/admin/anio/page.tsx   AD-02: lista de años, detalle con la línea de estados y bimestres
src/components/admin/anio.tsx          Tipos, badges de estado, línea de estados, formulario de bimestres,
                                       modales «Crear año académico» y de cambio de estado
public/figma/icon-calendar.svg         Ícono de calendario del menú lateral en azul (para fondos claros)
```

El ítem «Año y bimestres» del menú lateral y una tarjeta en el inicio del administrador (AD-01) llevan a esta pantalla.

## Qué muestra

- **Lista de años** con fechas, cuántos bimestres tiene registrados y su estado. Al entrar se elige el primer año que no esté cerrado.
- **Detalle del año:** estado actual, línea de estados (Planificado → En matrícula → En curso → En cierre → Cerrado) y el botón de la única transición posible: «Abrir matrícula», «Iniciar clases», «Iniciar cierre» o «Cerrar año». Cada uno pide confirmación en un modal; «Cerrar año» usa el estilo de peligro.
- **Bimestres:** los 4 se editan y guardan juntos. Un bimestre finalizado y todo un año cerrado se muestran sin edición.
- **Estados de la pantalla:** cargando (spinner), error con «Reintentar», vacío («Aún no hay años académicos») y con datos. Los errores del backend se muestran tal cual.

## Diferencias con el Figma (y por qué)

| Tema | Decisión | Motivo |
|---|---|---|
| Diseño de AD-02 | Se construyó con el estilo de AD-06 y `components/ui` | En esta sesión no se tuvo acceso al archivo «Kubo – Prototipo» (no hay enlace al archivo en el repositorio). Hay que compararla con el frame AD-02 y ajustar |
| Editar número o fechas del año | Solo por la API (`PATCH`) | No estaba en el alcance pedido para la pantalla |
| Estado de cada bimestre (Activo, En cierre, Finalizado) | Solo se muestra | Lo cambiarán los cierres de calificación (módulo evaluación) |
