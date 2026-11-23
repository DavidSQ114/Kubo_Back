# Casos de prueba · Sprint 4, bloque 1: defectos D-14 (orden de pago de las cuotas) y D-15 (borrado de notas en un registro cerrado)

Pantallas AD-11 «Pensiones y pagos» (modal M-01 «Registrar pago manual» y M-15 «Pago anual») y AP-02 «Pagos» (modal «Pagar en línea»). API: [matricula.md](../api/matricula.md#registrar-un-pago-manual-us22-m-01) y [evaluacion.md](../api/evaluacion.md); arquitectura de D-15 en [AD-16](../arquitectura/AD-16-bitacora-notas.md).
Pruebas automáticas: reglas puras en `tests/matricula/ordenPago.test.ts` y `tests/matricula/ordenCuotasPantalla.test.ts`; integración en `tests/matricula/ordenPago.integracion.test.ts` (409 por la API) y `tests/evaluacion/notas.integracion.test.ts` (DELETE directo), que corren en el CI con PostgreSQL.

**Precondición común (PC):** seed cargado. Año 2026 «En curso» con montos S/ 350.00 (matrícula) y S/ 450.00 (pensión). Solo datos ficticios (RNF14).
- **PC-M:** estudiante ficticio **Lucía Demo Orden** matriculada con la cuota «Matrícula 2026» Pendiente y las pensiones de setiembre a diciembre Pendiente (se preparan con `npm run demo:morosidad -- --dni <dni> --desde 2026-09-01`, que ahora también mueve el vencimiento de la matrícula al 01/09/2026).
- **PC-P:** como PC-M, pero con la matrícula ya pagada.
- **PC-N:** registro de notas del bimestre I de 1° A «Cerrado» (o «Publicado») con notas registradas.

Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y muestra el mensaje).

## D-14 · Orden de pago de las cuotas (US22, US58, US70)

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-D14-01 | US22 | básico | PC-M, Administrador | 1. AD-11, buscar a Lucía. 2. «Registrar pago». | — | M-01 lista la matrícula primero y luego las pensiones por vencimiento. «Matrícula 2026» viene marcada y no se puede desmarcar. Debajo de la lista: «Las cuotas se pagan en orden: primero la matrícula y luego las pensiones por fecha de vencimiento.» |
| CP-D14-02 | US22 | básico | CP-D14-01 | 1. Intentar marcar «Pensión de octubre» sin marcar setiembre. 2. Marcar setiembre y luego octubre. | — | Octubre está deshabilitada hasta marcar setiembre. Al marcar setiembre se habilita octubre. El total y el monto siguen a la selección. |
| CP-D14-03 | US22 | alterno | CP-D14-02 | 1. Con matrícula, setiembre y octubre marcadas, desmarcar setiembre. | — | Se desmarcan setiembre y octubre (las posteriores). La matrícula sigue marcada. |
| CP-D14-04 | US22 | básico | CP-D14-01 | 1. Marcar matrícula, setiembre y octubre. 2. Completar el pago y «Registrar pago». | Transferencia, `OP-D14-04`, S/ 1250.00 | Operación «Confirmado» con un recibo. Las tres cuotas quedan «Pagado». |
| CP-D14-05 | US22 | excepción | PC-M, sesión de Administrador | 1. `POST /matricula/pagos` con setiembre, octubre y noviembre (sin la matrícula). | S/ 1350.00 | `409 MATRICULA_PENDIENTE` «Primero debe pagarse la matrícula 2026. Inclúyela en este pago o regístrala antes.» No se crea la operación. |
| CP-D14-06 | US22 | excepción | PC-P, sesión de Administrador | 1. `POST /matricula/pagos` solo con noviembre. | S/ 450.00 | `409 CUOTAS_ANTERIORES_PENDIENTES` «Primero deben pagarse las cuotas anteriores: Pensión de setiembre 2026, Pensión de octubre 2026.» |
| CP-D14-07 | US22 | alterno | PC-P con la pensión de setiembre en estado Anulado (dato de prueba preparado en la base de desarrollo) | 1. `POST /matricula/pagos` solo con octubre. | S/ 450.00 | Se registra: las cuotas anuladas no cuentan para el orden. |
| CP-D14-08 | US22 | alterno | AD-11 con la cuota de noviembre en el cronograma | 1. «Registrar» en la fila de noviembre. | — | M-01 abre con la matrícula (si está pendiente), setiembre, octubre y noviembre marcadas. |
| CP-D14-09 | US58 | básico | PC-M | 1. AD-11, «Pago anual». 2. Registrar por el total pendiente. | S/ 2150.00 | Se confirma en una operación con la matrícula incluida. La matrícula pasa a modalidad Anual. |
| CP-D14-10 | US70 | básico | PC-M, PC-F de [casos-sprint3-pasarela](casos-sprint3-pasarela.md), apoderada de Lucía | 1. AP-02, «Pagar». | — | El modal trae la matrícula marcada y fija, y las pensiones vencidas marcadas en orden. Muestra la línea de ayuda del orden. «Ir a pagar» suma las elegidas. |
| CP-D14-11 | US70 | excepción | PC-M, sesión de la apoderada | 1. `POST /matricula/apoderado/pagos/intentos` solo con setiembre. | — | `409 MATRICULA_PENDIENTE`. No se crea el intento ni la order en la pasarela. |
| CP-D14-12 | US70 | excepción | PC-P, sesión de la apoderada | 1. `POST …/intentos` solo con octubre. | — | `409 CUOTAS_ANTERIORES_PENDIENTES` «Primero deben pagarse las cuotas anteriores: Pensión de setiembre 2026.» |
| CP-D14-13 | US70 | alterno | PC-P, PC-F | 1. «Pagar» con setiembre y octubre. 2. En AP-02P, «Aprobar pago». | — | Pago aprobado con comprobante. Las dos pensiones quedan «Pagado». |
| CP-D14-14 | — | básico | Base de desarrollo con un estudiante ficticio matriculado hoy | 1. `npm run demo:morosidad -- --dni <dni> --desde 2026-09-01`. 2. Volver a ejecutarlo. | — | La fecha de matrícula y el vencimiento de «Matrícula 2026» pasan al 01/09/2026 y se agregan las pensiones faltantes. La segunda ejecución informa «Sin cambios». `DATOS_DEMO` guarda el vencimiento anterior y el nuevo. |
| CP-D14-15 | US70 | alterno | PC-P, PC-F, la pensión de setiembre con un pago en línea Observado (en revisión) | 1. AP-02, «Pagar». 2. Repetirlo con la cuota de matrícula Pendiente y en revisión. | — | Encima de la lista, `Alerta` info «La pensión de setiembre 2026 tiene un pago en revisión. Las cuotas siguientes se podrán pagar cuando se confirme.»; setiembre no aparece y octubre en adelante quedan deshabilitadas. Con la matrícula en revisión el aviso dice «La matrícula 2026 …», no queda ninguna cuota elegible e «Ir a pagar» está deshabilitado. |

## D-15 · Borrado de notas en un registro cerrado

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-D15-01 | US40 | excepción | PC-N, acceso a la base de desarrollo | 1. `DELETE FROM nota WHERE id = '<id de una nota del registro cerrado>';` | — | Error `REGISTRO_CERRADO: el registro de notas está cerrado y no puede modificarse directamente`. La nota sigue en la base. |
| CP-D15-02 | US40 | excepción | PC-N con el registro «Publicado» | 1. `DELETE FROM nota WHERE cierre_id = '<id del cierre>';` | — | El mismo error; no se borra ninguna nota y la libreta sigue mostrándolas. |
| CP-D15-03 | US37 | alterno | Registro del bimestre «Abierto» con notas | 1. `DELETE FROM nota WHERE id = '<id>';` | — | Se borra: el trigger solo protege los registros cerrados o publicados. (La aplicación no ofrece borrar notas.) |
| CP-D15-04 | US41 | básico | PC-N, solicitud de rectificación pendiente | 1. Como Administrador, aprobar la solicitud en AD-15. | — | La nota cambia al valor solicitado (UPDATE permitido por `tg_nota_registro_cerrado`); el trigger de borrado no interviene. |
| CP-D15-05 | US21, US57 | alterno | PC-N, alumno con notas en el registro cerrado | 1. Anular o retirar su matrícula. | — | Las notas del registro cerrado se conservan: anular o retirar solo cambia el estado de la matrícula. |
