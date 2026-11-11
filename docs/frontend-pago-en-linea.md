# Frontend · Pago en línea (US70) y devolución (US71): AP-02 «Pagar», AP-02R retorno, AP-02P pasarela de prueba y AD-11

El Figma no tiene frames para estas pantallas. Siguen el estilo de AP-02 «Pagos» (tarjetas blancas con borde `border-borde`, títulos de 32 px, botones y alertas de `components/ui`) y de AD-11 «Pensiones y pagos». Este documento sirve de base para dibujarlas luego en el Figma. API: [matricula.md](api/matricula.md#pago-en-línea-us70-y-devolución-us71). Arquitectura: [AD-15](arquitectura/AD-15-pasarela-pagos.md).

## Archivos

```
src/app/(portal)/apoderado/pagos/page.tsx                    AP-02: botón «Pagar» junto al selector de año
src/app/(portal)/apoderado/pagos/retorno/page.tsx            AP-02R: resultado del pago (estado registrado en Kubo)
src/app/(portal)/apoderado/pagos/pasarela-de-prueba/page.tsx AP-02P: checkout falso (solo PASARELA=falsa)
src/components/apoderado/pagoEnLinea.tsx                     BotonPagar, modal de selección, useIntento, pantallas
src/components/apoderado/pagos.tsx                           Tipos (pagoEnLinea, pagable) y «¿Cómo pagar?»
src/components/admin/pagos.tsx                               Columna y filtro de origen, ModalDevolucion
src/app/(portal)/admin/pagos/page.tsx                        AD-11: abre ModalDevolucion y avisa el resultado
```

## AP-02 · Botón «Pagar» y selección de cuotas

- **Cuándo aparece:** solo si `GET /matricula/apoderado/hijos/{id}/pagos` responde `pagoEnLinea: true` (hay una pasarela configurada) y alguna cuota tiene `pagable: true` (Pendiente o Vencido y sin un pago en revisión). Si no, AP-02 queda igual que en el sprint 2.
- **Ubicación:** a la derecha del encabezado «Pagos», antes del selector «Año académico». Es un botón primario `Boton` con el ícono `check-blanco` y el texto «Pagar».
- **Modal «Pagar en línea»** (`Modal`, ícono `nav-wallet-azul` en tono azul). Subtítulo: «[Estudiante] · Año [año]».
  - Texto: «Elige las cuotas que quieres pagar ahora.»
  - Lista con borde: cada cuota pagable es una `Casilla` «[Concepto] · vence el [dd/mm/aaaa]», con el monto a la derecha y la insignia roja «Vencido» si corresponde. Al abrir se marcan las vencidas; si no hay vencidas, la primera pendiente.
  - Caja gris «Total a pagar» con el total en azul, de 22 px y en negrita. Se calcula en céntimos, sin float.
  - `Alerta` info «Pagarás en Mercado Pago»: «Te llevaremos a la página segura de Mercado Pago. Kubo no recibe ni guarda los datos de tu tarjeta…».
  - Pie: «Cancelar» (secundario) y «Ir a pagar S/ [total]» (primario, deshabilitado con total 0 y con `cargando` mientras crea el intento).
  - Error de la API (por ejemplo, `PAGO_EN_LINEA_NO_DISPONIBLE` o `CUOTA_YA_PAGADA`): `Alerta` de error con el `message`.
- Al confirmar: `POST /matricula/apoderado/pagos/intentos` y redirección (`window.location.assign`) a `urlCheckout` (Mercado Pago o AP-02P).
- **«¿Cómo pagar?»:** con el pago en línea activo, agrega arriba un recuadro azul «Pago en línea»: «Usa «Pagar» para pagar con tarjeta en Mercado Pago. El pago se registra apenas Mercado Pago lo confirma.»

## AP-02R · Resultado del pago en línea (`/apoderado/pagos/retorno?intento=…`)

A esta pantalla vuelve el apoderado desde el checkout (las tres URL de retorno apuntan aquí). **No usa los parámetros que agrega Mercado Pago:** pide `GET /matricula/apoderado/pagos/intentos/{id}`. Si el intento sigue Pendiente, el servidor consulta antes la order.

- Encabezado: «Pago en línea» / «Estado de tu pago en Kubo.»
- Tarjeta centrada (máx. 640 px) con un círculo de ícono, la insignia del estado, un título, un texto, el detalle (cuotas, monto y comprobante si hay) y «Volver a Pagos». Al pie: «Este estado es el que registró Kubo con la confirmación de Mercado Pago, no el de la página de la que vienes.»

| Estado del intento | Insignia | Título | Texto |
|---|---|---|---|
| `APROBADO` | verde «Aprobado» | Pago aprobado | Registramos tu pago. Las cuotas ya figuran como pagadas y te enviamos el comprobante por correo. (Muestra «Comprobante R-AAAA-NNNNNN») |
| `PENDIENTE` | ámbar «En proceso» | Pago en proceso | Mercado Pago aún no confirma tu pago… no vuelvas a pagar las mismas cuotas. Consulta cada 4 s, hasta 15 veces (con un spinner en el círculo); después aparece «Actualizar». |
| `RECHAZADO` | roja «Rechazado» | Pago rechazado | Mercado Pago no aprobó el pago y no se hizo ningún cobro. Puedes intentarlo de nuevo con otro medio. |
| `EXPIRADO` | gris «Expirado» | El pago expiró | No se completó el pago dentro de los 30 minutos… |
| `OBSERVADO` | ámbar «En revisión» | Pago recibido en revisión | Recibimos tu pago, pero tesorería debe revisarlo (por ejemplo, una de las cuotas ya estaba pagada por otro medio). Si corresponde, te devolveremos el dinero. |

Estados de la pantalla: *cargando* (`Spinner`), *error* («No pudimos consultar el pago» con el mensaje y «Volver a Pagos»; un intento ajeno o inexistente responde 404 `INTENTO_NO_ENCONTRADO`) y *con datos*.

## AP-02P · Pasarela de prueba (`/apoderado/pagos/pasarela-de-prueba?intento=…`)

Solo existe con `PASARELA=falsa` (desarrollo y pruebas). Reemplaza al checkout de Mercado Pago. La tarjeta tiene borde discontinuo ámbar y una `Alerta` de aviso: «Pasarela de prueba. Esta pantalla reemplaza al checkout de Mercado Pago en desarrollo (PASARELA=falsa). No hay cobro real.» Debajo van las cuotas y el monto, y los botones «Aprobar pago», «Rechazar» (peligro) y «Dejar en proceso» (secundario). Cada uno llama a `POST …/intentos/{id}/simular` y lleva a AP-02R. Con otra pasarela, el servidor responde 409 `SIMULACION_NO_DISPONIBLE`.

## AD-11 · Pensiones y pagos: origen y devolución (US71)

- **Operaciones de pago:** nueva columna «Origen» con una insignia («Tesorería» en gris, «Pasarela» en celeste) y un selector «Origen» (Todos, Tesorería, Pasarela) sobre la tabla. Si el filtro no deja filas: «No hay operaciones con ese origen.»
- El número de operación de un pago en línea es el id de la order (`ORD…`) y se parte en varias líneas.
- **Pago en línea Observado:** bajo las cuotas, en ámbar, «[motivo] · confirma si la cuota quedó libre o registra la devolución». Acciones: «Registrar devolución» (secundario) y «Confirmar» (primario, el mismo de US23). No hay «Descartar»: un pago en línea no se descarta como duplicado.
- **Modal «Registrar devolución»** (`Modal`, ícono `act-refresh` azul). Subtítulo: «Pago en línea [order] · S/ [monto]». Lleva la tarjeta del estudiante con las cuotas, el motivo y la insignia «Observado», un `Campo` «Observación (opcional)» (300 caracteres; ejemplo: «N.° de la devolución en Mercado Pago») y una `Alerta` info «Antes de registrar»: «Devuelve primero el dinero desde el panel de Mercado Pago. Aquí solo se deja constancia…». Pie: «Cancelar» y «Registrar devolución». Al terminar: aviso de éxito «Devolución registrada» y recarga del estado de cuenta.
- **Log de auditoría de pagos:** nueva acción «Devolución» (insignia ámbar). Los registros de la pasarela muestran «· en línea» en el detalle y el usuario «Sistema».
- El registrador de una operación de la pasarela se muestra como «Sistema (pago en línea)» (también en el recibo).

## Accesibilidad y seguridad

- Las casillas tienen etiqueta visible y el resultado de AP-02R está en una región `aria-live="polite"`.
- No se guarda nada en `localStorage` ni en `sessionStorage`. El intento se identifica por la URL y el servidor exige que lo haya creado el apoderado en sesión.
- La pantalla nunca decide el estado: lo muestra tal como lo registró Kubo.
