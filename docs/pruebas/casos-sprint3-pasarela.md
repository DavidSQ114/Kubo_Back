# Casos de prueba · Sprint 3, bloque 1: pago en línea desde el portal del apoderado (US70) y conciliación y devolución de pagos en línea (US71)

Pantallas AP-02 «Pagos» con «Pagar», AP-02R «Pago en línea» (`/apoderado/pagos/retorno`), AP-02P «Checkout de prueba» y AD-11 «Pensiones y pagos». API: [matricula.md](../api/matricula.md#pago-en-línea-us70-y-devolución-us71); ejemplos en [matricula.http](../api/matricula.http) (bloques 48 a 55). Pantallas: [frontend-pago-en-linea.md](../frontend-pago-en-linea.md). Arquitectura: [AD-15](../arquitectura/AD-15-pasarela-pagos.md).
Las reglas puras se prueban además con Vitest (`tests/matricula/pasarela.test.ts`). El webhook, la idempotencia y las carreras se prueban en `tests/matricula/pasarela.integracion.test.ts`, que corre en el CI con PostgreSQL.

**Precondición común (PC):** seed cargado. Año 2026 «En curso» con montos S/ 350.00 y S/ 450.00. Solo datos ficticios (RNF14) y Mercado Pago en **modo de prueba** (sandbox, sin dinero real):
- **Rosa Demo Pasarela** (apoderada) con su hija **Lucía Demo Pasarela**, 1° A. La matrícula está pagada y tiene pensiones pendientes.
- **PC-F:** `PASARELA="falsa"` y `MP_WEBHOOK_SECRET` en `.env` (desarrollo).
- **PC-MP:** `PASARELA="mercadopago"` con el access token del vendedor de prueba y el webhook «Order (Mercado Pago)» configurado (ver [DESPLIEGUE-AWS.md](../DESPLIEGUE-AWS.md#pago-en-línea-mercado-pago-modo-de-prueba)). Se paga con el comprador de prueba y una tarjeta de prueba de Mercado Pago.

Tipos: **básico** (camino feliz), **alterno** (otro camino válido), **excepción** (el sistema rechaza la operación y muestra el mensaje).

## US70 · Pago en línea desde el portal del apoderado

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US70-01 | US70 | básico | PC, PC-F | 1. Iniciar sesión como Rosa e ir a «Pagos». | — | Aparece «Pagar» junto al encabezado. «¿Cómo pagar?» muestra el recuadro «Pago en línea». |
| CP-US70-02 | US70 | alterno | PC, sin `PASARELA` | 1. Ir a «Pagos». | — | No aparece «Pagar» ni el recuadro «Pago en línea». El resto de AP-02 funciona igual. `pagoEnLinea: false`. |
| CP-US70-03 | US70 | básico | CP-US70-01 | 1. «Pagar». 2. Marcar dos pensiones. | — | El modal lista solo las cuotas Pendiente o Vencido sin pago en revisión. Las vencidas vienen marcadas. «Total a pagar» suma las elegidas y el botón dice «Ir a pagar S/ 900.00». |
| CP-US70-04 | US70 | básico | CP-US70-03, PC-F | 1. «Ir a pagar». 2. En AP-02P, «Aprobar pago». | — | Redirige a AP-02P y luego a AP-02R con «Pago aprobado», las cuotas, el monto y el comprobante `R-2026-…`. En AP-02 las cuotas quedan «Pagado» y el PDF se descarga. |
| CP-US70-05 | US70 | alterno | CP-US70-03, PC-F | 1. «Ir a pagar». 2. «Dejar en proceso». | — | AP-02R «Pago en proceso». Consulta cada 4 s; después de 1 minuto aparece «Actualizar». Las cuotas siguen pendientes. |
| CP-US70-06 | US70 | alterno | CP-US70-03, PC-F | 1. «Ir a pagar». 2. «Rechazar». | — | AP-02R «Pago rechazado», sin cobro. Las cuotas siguen pendientes y se puede iniciar otro pago. |
| CP-US70-07 | US70 | básico | PC, PC-MP | 1. «Pagar» → «Ir a pagar». 2. Pagar en el checkout de Mercado Pago con la tarjeta de prueba aprobada. | Comprador de prueba | Mercado Pago vuelve a AP-02R. El webhook llega firmado (log «Order de la pasarela procesada», resultado `REGISTRADO`) y la pantalla muestra «Pago aprobado» con el comprobante. |
| CP-US70-08 | US70 | excepción | PC-MP | 1. `POST /matricula/pagos/webhooks/pasarela?data.id=ORD1&type=order` con `x-signature` inventada. | — | `401 FIRMA_INVALIDA`. No se consulta la order ni se registra nada. |
| CP-US70-09 | US70 | alterno | CP-US70-07 | 1. En Mercado Pago, «Simular notificación» o reenviar el mismo aviso. | Misma order | `200`. No se crea otra operación (log con resultado `REPETIDO`). Hay una sola fila con esa `referencia_externa`. |
| CP-US70-10 | US70 | alterno | PC-F | 1. Crear el intento de setiembre y quedarse en AP-02P. 2. En otra pestaña, como Administrador, registrar setiembre en efectivo (US22). 3. «Aprobar pago». | — | AP-02R «Pago recibido en revisión». En AD-11 la operación de la pasarela queda «Observado» con «Cuota pagada por otro medio». La cuota se cobró una sola vez. |
| CP-US70-11 | US70 | excepción | PC-F | 1. `POST /matricula/apoderado/pagos/intentos` con una cuota ya pagada. | — | `409 CUOTA_YA_PAGADA` «Esta pensión ya fue cancelada el [fecha]». No se crea el intento. |
| CP-US70-12 | US70 | excepción | Sesión de Rosa | 1. `POST …/intentos` con el `estudianteId` de un estudiante ajeno. | — | `403 ESTUDIANTE_NO_VINCULADO`. |
| CP-US70-13 | US70 | excepción | Sesión de Rosa | 1. `POST …/intentos` con cuotas de dos años distintos. | — | `422 CUOTAS_DE_VARIAS_MATRICULAS` «Elige cuotas de un mismo año académico.» |
| CP-US70-14 | US70 | excepción | PC-F, otro apoderado | 1. Abrir AP-02R con el `intento` de Rosa. | — | «No pudimos consultar el pago»: `404 INTENTO_NO_ENCONTRADO`. |
| CP-US70-15 | US70 | excepción | CP-US70-04 | 1. Abrir `/apoderado/pagos/retorno?intento=<id>&status=approved&payment_id=1` de un intento rechazado. | — | Sigue «Pago rechazado»: los parámetros de la URL de retorno no cambian nada. |
| CP-US70-16 | US70 | excepción | `PASARELA="mercadopago"` | 1. `POST …/intentos/{id}/simular`. | — | `409 SIMULACION_NO_DISPONIBLE`. |
| CP-US70-17 | US70 | excepción | PC-MP con un access token inválido | 1. «Ir a pagar». | — | `502 PASARELA_NO_RESPONDE` «No pudimos conectar con la pasarela de pagos…». El intento queda «Rechazado» y el log no muestra el token. |
| CP-US70-18 | US70 | excepción | `PASARELA="falsa"` con `NODE_ENV=production` | 1. Arrancar la app e ir a AP-02. | — | No aparece «Pagar». El log avisa una vez «Pasarela de pagos mal configurada» con el nombre de la variable, sin valores. |
| CP-US70-19 | US70 | básico | CP-US70-04 | 1. Revisar la auditoría de la operación. | — | `REGISTRAR_PAGO` con `usuario_id` nulo, `actor: "SISTEMA"`, `origen: "PASARELA"`, `referenciaExterna` e `intentoId`. Llega el correo con el recibo (o el aviso `SMTP_NO_CONFIGURADO`). |
| CP-US70-20 | US70 | excepción | PC-F | 1. Pago acreditado por un monto distinto al del intento (prueba de integración). | — | No se registra la operación. El intento queda «Observado» («El monto pagado no coincide con las cuotas») y el log tiene un aviso. |
| CP-US70-21 | US70 (D-09) | básico | PC-MP en AWS | 1. Pagar una cuota en el checkout de prueba. 2. Revisar el log de la app al llegar el aviso «Order (Mercado Pago)». | `data.id=ORDTST…` (alfanumérico, en mayúsculas) | El aviso responde `200` (no `401 FIRMA_INVALIDA`) y el log muestra «Order de la pasarela procesada» con resultado `REGISTRADO`, **antes** de abrir la pantalla de retorno. La order se consulta con el id original en mayúsculas. Unitaria: `tests/matricula/firmaWebhook.test.ts`. |
| CP-US70-22 | US70 (D-09) | alterno | PC-MP | 1. En el panel de Mercado Pago, «Simular notificación» del webhook. | `data.id=123456` (numérico) | Sigue respondiendo `200`. El log muestra «Aviso de una order sin intento en Kubo». |
| CP-US70-23 | US70 (D-09) | excepción | PC-MP | 1. Reenviar un aviso real cambiando un carácter de `v1` en `x-signature`. | Misma order | `401 FIRMA_INVALIDA`. No se consulta la order y el log no muestra la clave secreta. |

## US71 · Conciliación y devolución de pagos en línea

| ID | Historia | Tipo | Precondiciones | Pasos | Datos | Resultado esperado |
|---|---|---|---|---|---|---|
| CP-US71-01 | US71 | básico | PC-F | 1. Crear un intento y aprobarlo en la pasarela sin que llegue el aviso. 2. Esperar 10 minutos. 3. `npm run conciliar-pagos`. | — | El comando registra el pago (`resultados.REGISTRADO: 1`) y el intento pasa a «Aprobado». |
| CP-US71-02 | US71 | alterno | PC-F | 1. Crear un intento y no pagar. 2. Pasados 30 minutos, `npm run conciliar-pagos`. | — | El intento pasa a «Expirado». |
| CP-US71-03 | US71 | alterno | PC-F | 1. Crear un intento y ejecutar la conciliación antes de 10 minutos. | — | No lo revisa (`revisados: 0`). |
| CP-US71-04 | US71 | alterno | Sin `PASARELA` | 1. `npm run conciliar-pagos`. | — | Termina enseguida con `revisados: 0` y código 0. |
| CP-US71-05 | US71 | básico | Servidor AWS | 1. `systemctl list-timers kubo-conciliar-pagos.timer`. | — | El timer está activo y su próxima ejecución es en 15 minutos o menos. El resultado se ve con `journalctl -u kubo-conciliar-pagos.service`. |
| CP-US71-06 | US71 | básico | Operaciones de ambos orígenes | 1. AD-11 «Pensiones y pagos» de Lucía. 2. Filtro «Origen: Pasarela». | — | La columna «Origen» muestra «Tesorería» o «Pasarela». El filtro deja solo las de la pasarela. Con un origen sin filas: «No hay operaciones con ese origen.» |
| CP-US71-07 | US71 | básico | CP-US70-10 | 1. En la operación Observado de la pasarela, «Registrar devolución». 2. Observación «Devolución en Mercado Pago 123». 3. Confirmar. | — | La operación pasa a «Anulado» con «Devuelto: Devolución en Mercado Pago 123», tu usuario y la fecha. Las cuotas no cambian. El log muestra «Devolución» y la auditoría tiene `REGISTRAR_DEVOLUCION`. |
| CP-US71-08 | US71 | excepción | Operación Confirmado de la pasarela | 1. `POST /matricula/pagos/{id}/devolver`. | — | `409 DEVOLUCION_NO_PERMITIDA` «Solo se registra la devolución de un pago en línea en estado «Observado».» |
| CP-US71-09 | US71 | excepción | Operación Observado de tesorería (número repetido, US23) | 1. `POST /matricula/pagos/{id}/devolver`. | — | `409 DEVOLUCION_NO_PERMITIDA`. La pantalla no muestra «Registrar devolución» para esa fila. |
| CP-US71-10 | US71 | excepción | CP-US70-10 | 1. `POST /matricula/pagos/{id}/descartar` sobre el pago en línea Observado. | — | `409 USAR_DEVOLUCION`. La pantalla no muestra «Descartar» para esa fila. |
| CP-US71-11 | US71 | alterno | CP-US70-10, el pago de tesorería anulado después | 1. «Confirmar» en el pago en línea Observado. | — | Pasa a «Confirmado» con su comprobante y la cuota a «Pagado» (US23). |
| CP-US71-12 | US71 | excepción | Sesión de Apoderado | 1. `POST /matricula/pagos/{id}/devolver`. | — | `403 ACCESO_DENEGADO`. |

## Casos unitarios (Vitest)

| Archivo | Qué cubre |
|---|---|
| `tests/matricula/firmaWebhook.test.ts` | D-09: id de la order en minúsculas para la firma; aviso real con id alfanumérico en mayúsculas (pasa y conserva el id original), simulación numérica (pasa), firma alterada, otra clave u otro id (401) y la ruta con 401 sin la clave en el log. |
| `tests/matricula/pasarela.test.ts` | Monto del intento (válido, cuota pagada, otro estudiante, dos matrículas); expiración a los 30 min y límite de conciliación de 10 min; cuándo un cobro es pagado (monto pagado, total y referencia); estados de Orders (`processed/accredited`, `failed`, `canceled`, `expired`, `created`, `processing`, devueltos); montos de texto a céntimos; Observado por cuota pagada, anulada o monto distinto; devolución y descarte; configuración con Zod; firma `x-signature` válida e inválida. |
| `tests/matricula/pasarela.integracion.test.ts` | 401 de la ruta con firma inválida; aviso duplicado y simultáneo (una sola operación); cuota ya pagada → Observado y devolución con auditoría; carrera con un pago manual (la cuota se cobra una vez); conciliación (aprobado y expirado); monto distinto; intento ajeno. |
