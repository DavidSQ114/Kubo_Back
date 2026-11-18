# Frontend · Notificaciones (M-11 a M-14) y recordatorios de pago (AD-12, M-24)

Sprint 3, bloque 9 (US55, US59). Frames de la página **«1 · Prototipo escritorio»** del Figma «Kubo – Prototipo», con capturas en `docs/figma/`: `M-11-notificaciones-administrador.png` (frame `167:2`), `M-13-notificaciones-apoderado.png` (panel `167:184`), `AD-12-panel-morosidad-recordatorios.png` (`18:816`, botón «Enviar recordatorios», alerta del resultado y columna «Último recordatorio») y `M-24-enviar-recordatorios-de-pago.png` (`386:366`). M-12 (docente, `167:66`) y M-14 (alumno, `167:185`) usan el mismo panel. API: [notificaciones.md](api/notificaciones.md) y [matricula.md](api/matricula.md#recordatorios-de-pago-a-apoderados-morosos-us59-ad-12-m-24). Casos de prueba: [pruebas/casos-sprint3-notificaciones.md](pruebas/casos-sprint3-notificaciones.md). Decisión: [arquitectura/AD-17](arquitectura/AD-17-notificaciones-y-bandeja-de-salida.md).

## Archivos

```
src/components/portal/notificaciones.tsx    Campana con el indicador y panel M-11 a M-14 (los cuatro portales)
src/components/admin/PortalAdmin.tsx        Barra superior del administrador: la campana reemplaza al botón fijo
src/components/portal/index.tsx             Barra superior del docente y del alumno: ídem
src/components/apoderado/PortalApoderado.tsx Barra superior del apoderado: campana nueva (antes no tenía)
src/components/admin/recordatorios.tsx      M-24 (modal) y la alerta con el resultado del envío
src/app/(portal)/admin/morosidad/page.tsx   AD-12: selección, «Enviar recordatorios», «Último recordatorio»
src/lib/formato.ts                          haceCuanto(): «Hace 10 min», «Hace 2 h», «Ayer, 09:58», «30/08/2026»
public/figma/notif-*.svg, icon-send-azul.svg Campana, alerta, billetera y enviar (trazos de Lucide, como el Figma)
```

## Campana (US55, criterio 1)

- Botón de 40 × 40 con la campana y, si hay no leídas, un indicador rojo con el número (hasta «99+»). `aria-label` «Notificaciones: 3 sin leer».
- El número se pide a `GET /notificaciones/no-leidas` al cargar la pantalla y cada 60 segundos. Un error no se muestra: la campana es informativa y se vuelve a intentar en la siguiente consulta.

## Panel M-11 a M-14 (US55, criterio 2)

Se abre bajo la campana, alineado a la derecha, con 400 px de ancho (en el celular, el ancho de la pantalla menos 32 px). Se cierra con un clic fuera o con Escape (el foco vuelve a la campana).

1. Encabezado «Notificaciones» con la insignia «4 nuevas» y **«Marcar como leídas»** a la derecha (deshabilitado si no hay no leídas). Marca todas, actualiza el panel y el indicador.
2. Pestañas **«Todas»** y **«No leídas (4)»**.
3. Cada notificación: ícono por tipo en un círculo de color (notas: insignia azul; horario: cuadrícula azul; pago: billetera verde; rectificación: comentario celeste; asistencia: alerta ámbar; recordatorio de pago: alerta roja), título, mensaje y cuándo llegó. Las no leídas tienen fondo gris y un punto azul. Al hacer clic se marca como leída y se abre su pantalla (`enlace`).
4. Pie «Se muestran los avisos de los últimos 30 días».
5. Estados: «Cargando…» con `Spinner`; error con `Alerta` y «Reintentar»; vacío «No tienes notificaciones» (o «Estás al día · No tienes notificaciones sin leer.» en la pestaña «No leídas»).

## AD-12 · Panel de morosidad (US59)

1. Columna de casillas con «Seleccionar a todos» en el encabezado. La selección vale para las filas del listado consultado; al filtrar de nuevo, las que ya no aparecen dejan de contar.
2. Botón primario **«Enviar recordatorios»** junto a «Exportar CSV»; muestra cuántos hay elegidos («Enviar recordatorios (3)») y está deshabilitado sin selección.
3. En cada fila, además del ojo (pensiones y pagos), un botón «Enviar recordatorio» (ícono de enviar) que abre M-24 solo para ese estudiante.
4. Columna **«Último recordatorio»** con la fecha (hora de Lima; la hora completa en el `title`) o «—».
5. Al terminar: alerta verde **«Se enviaron N recordatorios»** con «Los apoderados responsables recibieron una notificación interna y un correo con el detalle de la deuda.» y, si hubo omitidos, «No se envió a 2 estudiantes que ya regularizaron.» o «1 estudiante no tiene un apoderado responsable con cuenta o correo.». Si no se envió ninguno, alerta ámbar «No se envió ningún recordatorio». El listado se vuelve a consultar.

## M-24 · Enviar recordatorios de pago

Modal con la campana azul, «Enviar recordatorios de pago» y «N estudiantes seleccionados en el panel de morosidad». Recuadro «Qué se enviará»: notificación interna al apoderado responsable del pago, correo con el detalle de las cuotas vencidas, sus montos y los días de atraso, y «No se envía a quienes ya no tengan cuotas vencidas al momento del envío». Alerta azul «Se registrará la fecha del último recordatorio». Botones «Cancelar» y **«Enviar N recordatorios»** (con `cargando`). Un error de la API se muestra dentro del modal.

## Diferencias con el Figma

| Figma | Implementado | Motivo |
|---|---|---|
| La campana tiene un punto rojo fijo | Indicador rojo con el número de no leídas, solo si hay | US55 pide ver la cantidad de no leídas |
| El portal del apoderado (página «Propuesta», ya construido) no tenía campana | Campana igual a la de los demás portales | US55: la campana está en todos los portales |
| M-24 dice «No se envía a 2 estudiantes que ya no tienen cuotas vencidas» antes de enviar | «No se envía a quienes ya no tengan cuotas vencidas al momento del envío»; el número exacto llega en la alerta del resultado | Quién sigue debiendo se decide en el servidor, con las matrículas bloqueadas, al momento del envío |
| AD-12 con KPI «Libretas restringidas», «Recuperado en setiembre» y columna «Libreta» | Sin cambios respecto del bloque de morosidad (resumen de tres cifras) | Fuera del alcance de US59 |
| Notificación del administrador «Recordatorios de pago enviados» y avisos de sistema (error 500, docentes sin ingreso) en M-11 | No se generan | No están entre los eventos pedidos para este bloque; los tipos `SISTEMA` y otros quedan reservados |
| Iconos `icon/bell`, `icon/alert`, `icon/wallet`, `icon/send` del Figma | SVG nuevos en `public/figma` con los mismos trazos y los colores del tema | Faltaban esas variantes de color |

El portal del administrador sigue sin ser responsivo (a 390 px la página se desplaza a lo ancho, como antes); el panel de notificaciones sí se ajusta al ancho de la pantalla en los cuatro portales.
