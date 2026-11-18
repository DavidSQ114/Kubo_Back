# Arquitectura · Notificaciones internas y bandeja de salida de correos (US55, US59)

Decisión AD-17. Sprint 3, bloque 9. Código en `src/platform/notificaciones` (dueño de `notificacion` y de las filas `CORREO` de `outbox_evento`, ambas en `prisma/schema/platform.prisma` desde el diagrama de clases v4.2) y los recordatorios de pago en `src/modules/matricula` (`application/recordatorios.ts`). **Sin migración:** las tablas y `matricula.ultimo_recordatorio_en` ya existían. API en [api/notificaciones.md](../api/notificaciones.md) y [api/matricula.md](../api/matricula.md#recordatorios-de-pago-a-apoderados-morosos-us59-ad-12-m-24).

## AD-17 · Las notificaciones son un servicio de plataforma que se escribe en la transacción de la operación, y los correos salen por una bandeja de salida con reintentos

**Contexto.** US55 pide un indicador de no leídas, un panel con «Marcar como leídas» y que un correo que falla se reintente sin revertir ni bloquear la operación. Los avisos nacen en cinco módulos (evaluación, horarios, matrícula y, por sus correos, comunidad e identidad), que hasta ahora mandaban el correo con `enviarCorreo` después de confirmar: si fallaba, se perdía. El estándar exige que la auditoría vaya en la misma transacción y que el correo salga después de confirmar.

**Decisión.**

1. **`platform/notificaciones`, no un módulo.** Como la auditoría, lo usan todos los módulos y no conoce a ninguno: recibe destinatarios por `usuarioId` y textos ya armados. El README ya preveía `platform/notificaciones/`. Las rutas son `/api/v1/notificaciones/…` (como `/api/v1/salud`); sus esquemas Zod están en `platform/notificaciones/schemas.ts` y las reglas puras, en `reglas.ts`.
2. **`registrarAvisos(tx, { notificaciones, correos, origen })` dentro de la transacción** de la operación: crea las notificaciones (`createMany`) y deja los correos `PENDIENTE` en `outbox_evento` (`tipo_evento = 'CORREO'`, `agregado_tipo/agregado_id` = la entidad que los originó). Si la operación se revierte, no queda ni el aviso ni el correo; si se confirma, quedan los dos.
3. **`despacharCorreos(ids)` después de confirmar** hace el primer intento y nunca lanza. Devuelve cuántos salieron (lo que ya informaban las respuestas, `aviso.enviados`).
4. **Reintentos con el timer existente.** `scripts/conciliarPagos.ts` (que ejecuta `kubo-conciliar-pagos.timer` cada 15 minutos en la EC2) ahora, además de conciliar los pagos en línea, llama a `procesarBandeja()`. Como el servicio corre `npm run conciliar-pagos` desde el release desplegado, el cambio llega con el despliegue normal: **no hay paso manual en la EC2**. `npm run reintentar-correos` lo hace a mano.
5. **Reglas del reintento** (`reglas.ts`, probadas en `tests/platform/notificaciones.test.ts`): enviado → `PROCESADO`; fallo → sigue `PENDIENTE` con `proximo_intento` a 5, 10, 20 y 40 minutos; al **quinto** intento fallido → `FALLIDO` (se registra un `logger.error`). `ultimo_error` guarda un texto genérico; el detalle (sin datos personales) va al log.
6. **Sin envíos dobles.** Cada intento primero *reserva* el correo con un `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)` que mueve `proximo_intento` 10 minutos adelante. El despacho inmediato y el job nunca toman el mismo correo a la vez; si el proceso muere a mitad del envío, la reserva vence y el job lo reintenta.
7. **Destinatarios.** Cada módulo resuelve a quién avisar con lo que ya expone comunidad (personas de administradores, docentes, apoderados y alumnos) y pasa de persona a usuario con `usuariosDePersonas` de identidad (cuentas no dadas de baja). Los destinatarios se calculan **antes** de abrir la transacción; si esa consulta falla, la operación sigue sin avisos (se registra un `warn`): un aviso nunca bloquea la operación.
8. **Solo el destinatario.** Todas las consultas filtran por el `usuarioId` de la sesión; marcar un id ajeno responde 404 sin marcar nada. Los enlaces se guardan solo si son rutas internas.
9. **US59 en matrícula.** `enviarRecordatoriosPago` bloquea las matrículas, vuelve a leer las cuotas vencidas dentro de la transacción (quien pagó mientras tanto se omite), registra notificación y correo, guarda `ultimo_recordatorio_en` y audita `ENVIAR_RECORDATORIOS` por estudiante, todo en una transacción.

**Alternativas descartadas.**

- *Tabla nueva `correo_saliente`:* `outbox_evento` ya tiene estado, intentos, próximo intento, último error y fecha de proceso, y su comentario la reservaba para «correos masivos, notificaciones». Una tabla nueva obligaba a migrar y a cambiar el diagrama sin ganar nada.
- *Pasar la copia del recibo (US25) por la bandeja:* lleva el PDF adjunto y ya tiene su propia constancia (`comprobante.enviado_en`) y su manejo de «SMTP no configurado». Se dejó igual; el pago confirmado solo agrega la notificación interna.
- *Timer nuevo `kubo-reintentar-correos`:* habría exigido instalar la unidad a mano en la EC2. Reutilizar el de 15 minutos no necesita ningún paso.
- *Enviar el correo dentro de la transacción:* alargaría las transacciones con llamadas SMTP y, si el correo falla, obligaría a elegir entre revertir la operación o perder el aviso.
- *Notificaciones en tiempo real (WebSocket o SSE):* la campana consulta cada 60 s, como pide la historia; en Vercel y en la EC2 con `next start` no hay infraestructura de conexiones persistentes.

**Consecuencias.**

- `aviso.enviados` (notas, horario, cierre, rectificación) y `correos` de la asistencia cuentan solo el primer intento; los reintentos posteriores no actualizan esos contadores ni `aviso_asistencia.correos_enviados`.
- Hoy la EC2 no tiene SMTP: los correos de la bandeja fallarán 5 veces y quedarán `FALLIDO` (ver `SELECT estado, count(*) FROM outbox_evento WHERE tipo_evento = 'CORREO' GROUP BY estado`). Las notificaciones internas funcionan igual.
- `outbox_evento` y `notificacion` crecen sin límite. El panel solo muestra 30 días; una limpieza periódica (por ejemplo, borrar `PROCESADO` de más de 90 días) queda pendiente.
- `aviso_asistencia.registrar` pasó a `INSERT … ON CONFLICT DO NOTHING` (`createManyAndReturn` con `skipDuplicates`) para poder ir dentro de la transacción sin abortarla cuando dos registros llegan a la vez.
