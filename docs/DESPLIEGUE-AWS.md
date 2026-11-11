# Kubo · Despliegue en AWS Academy (Learner Lab)

Guía paso a paso para correr Kubo en **una EC2 Ubuntu 24.04 con PostgreSQL en RDS**, con HTTPS y despliegue automático desde `main`. Todo se hace en la consola de AWS, región **us-east-1 (N. Virginia)**.

**Solo datos de prueba (RNF14).** No se cargan datos reales de alumnos, apoderados ni docentes.

## Cómo funciona

| Pieza | Dónde | Detalle |
|---|---|---|
| Aplicación (frontend + API) | EC2 `t3.small` (2 GB de RAM + 2 GB de swap), Ubuntu 24.04 | `kubo.service` ejecuta `next start` en `127.0.0.1:3000` desde `/opt/kubo/current` |
| HTTPS | Caddy en la misma EC2 | Certificado automático de Let's Encrypt para `<ip-con-guiones>.sslip.io` (la Elastic IP) o para un dominio propio (ver «Dominio propio (DuckDNS)») |
| Base de datos | RDS PostgreSQL `db.t4g.micro` | Sin acceso público: solo la EC2 llega al puerto 5432; conexión cifrada (`sslmode=require`) |
| Despliegue | La propia EC2 | `kubo-desplegar.timer` revisa `main` al arrancar y cada 5 minutos, y ejecuta `deploy/aws/desplegar.sh` |
| Acceso al servidor | Session Manager | Sin SSH ni puerto 22 abierto; sin llaves |

**Sin credenciales de AWS en GitHub.** Las del Learner Lab caducan en cada sesión, así que GitHub no despliega: es la EC2 la que hace `git fetch` del repositorio público. Cada push o PR unido a `main` llega solo en menos de 5 minutos.

### Qué hace cada despliegue

1. Si `origin/main` es distinto del commit en uso, lo clona en `/opt/kubo/releases/<sha>`.
2. Ejecuta `npm ci --include=dev`, `npm run build` y `prisma migrate deploy` con `/etc/kubo/kubo.env`. Con `NODE_ENV=production`, npm omitiría las devDependencies, que el build y Prisma necesitan.
3. Si algo de lo anterior falla, **no toca** `current`: la versión en uso sigue funcionando.
4. Cambia el symlink `current`, reinicia `kubo.service` y consulta `GET /api/v1/salud`. Si no responde `"estado":"ok"` con el commit nuevo, **vuelve al release anterior**.
5. Conserva los últimos 3 releases. Un candado evita dos despliegues a la vez. Todo queda en `/opt/kubo/shared/logs/despliegue.log`.

Un commit que falló no se reintenta cada 5 minutos: se espera al siguiente commit en `main`. Para forzarlo, ver «Problemas comunes».

### Archivos

```
deploy/aws/instalar.sh             Prepara la EC2 una sola vez (idempotente)
deploy/aws/desplegar.sh            El despliegue (se instala en /opt/kubo/bin)
deploy/aws/kubo.env.ejemplo        Plantilla de /etc/kubo/kubo.env (sin valores)
deploy/aws/Caddyfile               Proxy inverso con HTTPS
deploy/aws/systemd/                kubo.service, kubo-desplegar.service y kubo-desplegar.timer
src/app/api/v1/salud/route.ts      GET /api/v1/salud (público)
```

En el servidor:

```
/opt/kubo/repo.git                 Copia del repositorio para hacer git fetch
/opt/kubo/releases/<sha>/          Un release por commit (los últimos 3)
/opt/kubo/current → releases/<sha> El que está en uso
/opt/kubo/shared/logs/             despliegue.log y el log de la aplicación (LOG_DIR)
/etc/kubo/kubo.env                 Variables (dueño kubo, chmod 600)
/etc/kubo/caddy.env                Solo los dominios (principal y respaldo), para Caddy
/etc/kubo/dominio                  Dominio propio, opcional (una línea)
/etc/kubo/rds-global-bundle.pem    Certificado de AWS RDS (para sslmode=require)
```

## Una sola vez: crear la infraestructura

Antes de empezar: **Start Lab** en el Learner Lab, espera a que el círculo esté en verde y abre **AWS** (la consola). Verifica arriba a la derecha que la región sea **N. Virginia (us-east-1)**.

> **Respeta los límites del Learner Lab.** Usa solo los tipos, tamaños y servicios de esta guía. Exceder los límites del lab (tipos de instancia o de almacenamiento no permitidos, demasiadas instancias o gastar el crédito) puede desactivar la cuenta, y con ella se pierden la EC2, la base de datos y sus datos.

### 1. Grupos de seguridad

EC2 → Network & Security → **Security Groups** → **Create security group**, en la VPC por defecto:

| Nombre | Reglas de entrada | Para qué |
|---|---|---|
| `kubo-web` | HTTP (80) desde `0.0.0.0/0` y `::/0` · HTTPS (443) desde `0.0.0.0/0` y `::/0` | La EC2. **Sin el puerto 22**: se entra por Session Manager. El 80 hace falta para emitir el certificado HTTPS |
| `kubo-db` | PostgreSQL (5432) con origen **el grupo `kubo-web`** (no una IP) | RDS: solo la EC2 llega a la base |

Deja las reglas de salida como vienen (todo permitido).

### 2. Base de datos en RDS

RDS → **Create database**:

1. **Standard create** → **PostgreSQL**. Elige la versión 16 o 17 más reciente que ofrezca la lista.
2. Template: **Free tier**, o **Dev/Test** si no aparece.
3. DB instance identifier: `kubo-db`.
4. Master username: `kubo_admin`. Credentials management: **Self managed**. Escribe una contraseña larga y guárdala en un lugar seguro, fuera del repositorio. Evita `@ : / ? # & %`, o tendrás que codificarlos en la URL.
5. Instance configuration: **db.t4g.micro**.
6. Storage: **General Purpose SSD (gp2), 20 GB**. El Learner Lab solo admite gp2 en RDS; la EC2 sí puede usar gp3. Desmarca *Enable storage autoscaling*.
7. Availability: **Single-AZ** (sin standby).
8. Connectivity:
   - VPC por defecto.
   - **Public access: No**.
   - VPC security group: **Choose existing** → `kubo-db`. Quita `default`.
9. Desmarca *Performance Insights* y *Enhanced monitoring*. No hacen falta y el Learner Lab puede no permitirlos.
10. **Additional configuration**:
    - Initial database name: `kubo`.
    - Backup retention: **7 days**.
    - Desmarca *Enable deletion protection* solo si piensas borrar la base al terminar el curso.
11. **Create database**. Tarda unos 10 minutos. Al terminar, copia el **Endpoint** (pestaña *Connectivity & security*), por ejemplo `kubo-db.xxxxxxxx.us-east-1.rds.amazonaws.com`.

### 3. Servidor EC2

EC2 → **Launch instance**:

1. Name: `kubo-web`.
2. AMI: **Ubuntu Server 24.04 LTS** (64-bit x86).
3. Instance type: **t3.small**.
4. Key pair: **Proceed without a key pair**. Se entra por Session Manager.
5. Network settings → **Select existing security group** → `kubo-web`. Auto-assign public IP: **Enable**.
6. Storage: **20 GiB gp3**. Cada release ocupa cerca de 1 GB con `node_modules` y se guardan 3.
7. Advanced details → **IAM instance profile: `LabInstanceProfile`**. Sin él no aparece Session Manager.
8. **Launch instance**.

Después, EC2 → **Elastic IPs** → **Allocate Elastic IP address** → **Allocate**, y luego **Actions → Associate** con la instancia `kubo-web`. Así la IP, y con ella el dominio y el certificado, no cambian entre sesiones.

> Mientras la instancia está detenida, la Elastic IP tiene un costo pequeño que se descuenta del crédito del lab. Si borras la instancia, libera también la Elastic IP (**Release**).

### 4. Entrar al servidor por Session Manager

EC2 → Instances → `kubo-web` → **Connect** → pestaña **Session Manager** → **Connect**.

Si dice que la instancia no está conectada, espera 2 o 3 minutos después del arranque. Si sigue igual, revisa que tenga el perfil `LabInstanceProfile`: *Actions → Security → Modify IAM role*, y luego reinicia la instancia.

La sesión abre como `ssm-user`. Pasa a root:

```bash
sudo -i
```

### 5. Instalar (una sola vez)

```bash
git clone https://github.com/DavidSQ114/Kubo_Back.git /root/kubo-instalador
bash /root/kubo-instalador/deploy/aws/instalar.sh
```

El script deja todo listo y al final muestra el **dominio**, por ejemplo `https://3-91-20-15.sslip.io`. Esto es lo que hace:

- crea el swap de 2 GB;
- instala Node 22, git, Caddy y el cliente de PostgreSQL;
- crea el usuario `kubo` y las carpetas de `/opt/kubo`;
- crea `/etc/kubo/kubo.env` desde la plantilla, sin valores;
- descarga el certificado de RDS;
- configura Caddy con el dominio: el de `/etc/kubo/dominio` si existe y apunta a la instancia, o el de sslip.io de la Elastic IP;
- instala las unidades systemd y activa el timer.

Se puede volver a ejecutar sin riesgo: no pisa `kubo.env`. Hazlo cuando cambien los archivos de `deploy/aws`:

```bash
git -C /root/kubo-instalador pull
bash /root/kubo-instalador/deploy/aws/instalar.sh
```

### 6. Completar las variables

```bash
nano /etc/kubo/kubo.env
```

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Reemplaza `<usuario>` (`kubo_admin`), `<clave>` y `<endpoint-rds>`. Deja el resto de la URL como está: base `kubo`, `sslmode=require`, `sslrootcert` y la zona UTC |
| `JWT_SECRET` | Uno nuevo, de 32 caracteres o más: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `APP_URL` | `https://` + el dominio principal que mostró `instalar.sh` |
| `SMTP_*` | Opcional. Sin SMTP los correos no salen y la pantalla muestra la contraseña temporal para entregarla |

Guarda con Ctrl+O, Enter y Ctrl+X. El archivo queda con dueño `kubo` y permisos 600: no lo copies ni lo pegues en chats o capturas.

Comprueba que la EC2 llega a RDS. Pide la contraseña de `kubo_admin`:

```bash
psql "host=<endpoint-rds> dbname=kubo user=kubo_admin sslmode=require" -c "select version();"
```

### 7. Primer despliegue

```bash
systemctl start --no-block kubo-desplegar.service
tail -f /opt/kubo/shared/logs/despliegue.log
```

El primero tarda de 5 a 10 minutos: `npm ci`, el build y las migraciones. Termina con `==== Despliegue de <sha> terminado ====` (Ctrl+C para salir del `tail`). Comprueba:

```bash
curl -s https://<dominio>/api/v1/salud
```

Debe responder `{"data":{"estado":"ok","version":"<sha corto>","baseDatos":"ok"}}`.

### 8. Datos iniciales (una sola vez)

Carga el seed: grados, áreas, competencias, cursos y el administrador inicial. Es idempotente:

```bash
sudo -u kubo bash -c 'cd /opt/kubo/current && set -a && . /etc/kubo/kubo.env && set +a && npm run db:seed:remoto'
```

Abre `https://<dominio>`, ingresa con `admin@kubo.edu.pe` y la contraseña inicial del seed, y **cámbiala de inmediato**: el sistema lo exige en el primer ingreso.

## Dominio propio (DuckDNS)

Opcional. Por defecto Kubo responde en `https://<ip-con-guiones>.sslip.io`. Con un subdominio gratuito de DuckDNS, por ejemplo `kubo-codecoffee.duckdns.org`, ese pasa a ser el **dominio principal**. El de sslip.io queda como **respaldo**: redirige con un 308 al principal y conserva la ruta, así que los enlaces viejos (incluidos los de los correos ya enviados) siguen funcionando.

### 1. Crear el subdominio

1. Entra a [duckdns.org](https://www.duckdns.org) con una cuenta del equipo y crea el subdominio (por ejemplo `kubo-codecoffee`).
2. En **current ip** escribe la **Elastic IP** de `kubo-web` (EC2 → Elastic IPs) y pulsa **update ip**. La Elastic IP no cambia, así que no hace falta instalar ningún actualizador en la EC2.
3. **No publiques el token de DuckDNS.** Con él cualquiera puede apuntar el dominio a otro servidor. No va en el repositorio, ni en `kubo.env`, ni en capturas o chats.

Comprueba desde la EC2 (Session Manager) que el dominio ya apunta a la instancia. Debe mostrar la Elastic IP:

```bash
getent ahostsv4 kubo-codecoffee.duckdns.org
```

### 2. Configurar la EC2

```bash
echo kubo-codecoffee.duckdns.org > /etc/kubo/dominio
nano /etc/kubo/kubo.env        # APP_URL="https://kubo-codecoffee.duckdns.org"
git -C /root/kubo-instalador pull
bash /root/kubo-instalador/deploy/aws/instalar.sh
systemctl restart kubo.service
```

`instalar.sh` usa el dominio propio solo si resuelve a la IP pública de la instancia. Si no, avisa y se queda con el de sslip.io: corrige la IP en DuckDNS, espera un par de minutos y vuelve a ejecutarlo. Al terminar muestra el dominio principal y avisa si `APP_URL` no coincide con él. `APP_URL` se lee al arrancar la app, por eso se reinicia `kubo.service`; no hace falta volver a desplegar.

Comprueba:

```bash
curl -s https://kubo-codecoffee.duckdns.org/api/v1/salud
curl -sI https://<ip-con-guiones>.sslip.io/inicio | grep -i -e '^HTTP' -e '^location'
```

El primero responde `"estado":"ok"`; el segundo, `308` con `location: https://kubo-codecoffee.duckdns.org/inicio`.

**Las sesiones abiertas en el dominio anterior se pierden.** Las cookies de sesión pertenecen a cada dominio: tras el cambio, cada usuario vuelve a iniciar sesión una vez en el dominio nuevo.

Para volver a sslip.io: `rm /etc/kubo/dominio`, `APP_URL` con el dominio de sslip.io, `instalar.sh` y `systemctl restart kubo.service`.

## Pago en línea (Mercado Pago, modo de prueba)

US70 y US71. Solo **modo de prueba**: no se procesan pagos reales. Detalle técnico en [AD-15](arquitectura/AD-15-pasarela-pagos.md). Sin estas variables el portal no muestra «Pagar» y todo lo demás funciona igual.

### 1. Cuenta y credenciales de prueba

1. En https://www.mercadopago.com.pe/developers → **Tus integraciones**, crea (o abre) la aplicación de Checkout Pro con **Orders**.
2. En **Cuentas de prueba**, crea un *vendedor* y un *comprador* de prueba. La API de Orders no acepta credenciales `TEST-`: se usan las **credenciales de producción del vendedor de prueba**, que solo mueven dinero ficticio. Copia su *Access Token* (`APP_USR-…`).
3. Nunca pegues el token en un chat, un commit ni un ticket (estándar, sección 8).

### 2. Configurar el webhook en Mercado Pago

1. **Tus integraciones → (aplicación) → Webhooks → Configurar notificaciones**, en el modo de prueba.
2. URL: `https://<dominio>/api/v1/matricula/pagos/webhooks/pasarela` (el dominio de `APP_URL`, con HTTPS).
3. Evento: **Order (Mercado Pago)**. Guarda.
4. **Revelar clave secreta**: esa es `MP_WEBHOOK_SECRET`. Kubo la usa para validar `x-signature`. Sin ella, todos los avisos responden 401.

### 3. Cargar las claves en el servidor sin que queden en pantalla ni en el historial

En Session Manager, como root (`sudo -i`). `read -s` no muestra lo que se pega y los valores no quedan en el historial de bash:

```bash
read -rs -p "MP_ACCESS_TOKEN: " MP_TOKEN; echo
read -rs -p "MP_WEBHOOK_SECRET: " MP_SECRETO; echo
ARCHIVO=/etc/kubo/kubo.env
sed -i '/^PASARELA=/d;/^MP_ACCESS_TOKEN=/d;/^MP_WEBHOOK_SECRET=/d' "$ARCHIVO"
printf 'PASARELA="mercadopago"\nMP_ACCESS_TOKEN="%s"\nMP_WEBHOOK_SECRET="%s"\n' "$MP_TOKEN" "$MP_SECRETO" >>"$ARCHIVO"
unset MP_TOKEN MP_SECRETO
chown kubo:kubo "$ARCHIVO" && chmod 600 "$ARCHIVO"
systemctl restart kubo.service
grep -c '^MP_' "$ARCHIVO"   # 2 (cuenta las líneas sin mostrar los valores)
```

`APP_URL` debe ser el dominio con `https://`: con él se arman las URL de retorno del checkout.

### 4. Timer de conciliación (US71)

`instalar.sh` instala y activa `kubo-conciliar-pagos.timer`, que ejecuta `npm run conciliar-pagos` cada 15 minutos. En un servidor instalado antes de este cambio, se activa **una vez** con:

```bash
install -o root -g root -m 644 /opt/kubo/current/deploy/aws/systemd/kubo-conciliar-pagos.{service,timer} /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now kubo-conciliar-pagos.timer
systemctl list-timers kubo-conciliar-pagos.timer
```

Sin `PASARELA`, la conciliación termina enseguida sin hacer nada.

### 5. Comprobar

1. En Mercado Pago, **Simular notificación** del webhook. Debe responder 200. El log de la app muestra «Aviso de una order sin intento en Kubo», porque la order simulada no existe en Kubo.
2. Como apoderado de prueba: AP-02 → «Pagar» → «Ir a pagar». Paga en el checkout con el comprador de prueba y una tarjeta de prueba. La pantalla de retorno debe mostrar «Pago aprobado».
3. Resultado de la conciliación: `journalctl -u kubo-conciliar-pagos.service -n 20`.

## En cada sesión del Learner Lab

1. **Start Lab** y espera el círculo verde. Abre la consola de AWS.
2. **EC2 → Instances:** `kubo-web` debe estar *Running*. Si está *Stopped*: **Instance state → Start**.
3. **RDS → Databases:** `kubo-db` debe estar *Available*. Si está *Stopped*: **Actions → Start**. Tarda unos minutos.
4. **Espera el despliegue.** Al arrancar, la instancia revisa `main` en 1 minuto y despliega si hay commits nuevos (5 a 10 minutos). Si nada cambió, la app arranca en segundos.
5. **Abre el dominio principal** (el propio o `https://<ip-con-guiones>.sslip.io`). Para confirmar la versión: `https://<dominio>/api/v1/salud`.
6. **Al terminar:** RDS → `kubo-db` → **Actions → Stop temporarily**, si no se detuvo solo. AWS vuelve a encender una base detenida a los 7 días. La EC2 se detiene sola al acabar la sesión del lab.

## Operación

| Necesito… | Comando (en Session Manager, como root) |
|---|---|
| Ver el último despliegue | `tail -n 50 /opt/kubo/shared/logs/despliegue.log` |
| Desplegar ya, sin esperar 5 minutos | `systemctl start --no-block kubo-desplegar.service` |
| Ver si la app corre | `systemctl status kubo.service` |
| Ver errores de la app | `journalctl -u kubo.service -n 100` y `ls /opt/kubo/shared/logs` |
| Saber qué commit está en uso | `readlink -f /opt/kubo/current` o `curl -s localhost:3000/api/v1/salud` |
| Volver a mano al release anterior | `ls -t /opt/kubo/releases`, luego `ln -sfn /opt/kubo/releases/<sha> /opt/kubo/current && systemctl restart kubo.service` |
| Ver el HTTPS | `systemctl status caddy` y `journalctl -u caddy -n 50` |
| Conciliar pagos en línea ya (US71) | `systemctl start kubo-conciliar-pagos.service` y `journalctl -u kubo-conciliar-pagos.service -n 20` |

Las migraciones se aplican antes de cambiar de release. Si un despliegue vuelve al anterior, la base ya tiene la migración nueva: por eso las migraciones deben ser compatibles con la versión anterior (agregar columnas o tablas, no borrarlas en el mismo cambio).

## Problemas comunes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| Session Manager no deja conectar | La instancia acaba de arrancar o no tiene `LabInstanceProfile` | Esperar 2 a 3 minutos; asignar el perfil (*Modify IAM role*) y reiniciar |
| El navegador no abre el dominio o falla el certificado | Puerto 80 o 443 cerrado en `kubo-web`, o la IP cambió | Revisar el grupo de seguridad; usar la Elastic IP y volver a ejecutar `instalar.sh` (escribe el dominio nuevo); `journalctl -u caddy -n 50` |
| `instalar.sh` avisa que el dominio propio «resuelve a … y no a …» | El subdominio no apunta a la Elastic IP o el DNS aún no se actualizó | Corregir la IP en DuckDNS, esperar un par de minutos y volver a ejecutar `instalar.sh`; mientras tanto el principal es el de sslip.io |
| `502 Bad Gateway` | `kubo.service` no está corriendo (primer despliegue en curso o error al arrancar) | `tail` del log de despliegue; `journalctl -u kubo.service -n 100` |
| El log dice «Falta completar /etc/kubo/kubo.env» | La línea `DATABASE_URL` sigue con `<usuario>`, `<clave>` o `<endpoint-rds>` | Paso 6 y `systemctl start --no-block kubo-desplegar.service` |
| `P1001: Can't reach database server` en las migraciones | RDS detenida, endpoint mal escrito o `kubo-db` no admite al grupo `kubo-web` | Iniciar RDS; revisar el endpoint y la regla 5432 del grupo `kubo-db` |
| `self-signed certificate in certificate chain` | Falta `sslrootcert=/etc/kubo/rds-global-bundle.pem` en `DATABASE_URL` (el driver `pg` verifica el certificado con `sslmode=require`) | Revisar la URL y que exista el archivo (`instalar.sh` lo descarga). Como último recurso, cambiar `sslmode=require` por `uselibpqcompat=true&sslmode=require`: cifra sin verificar el certificado |
| `password authentication failed` | Usuario o contraseña de `DATABASE_URL` | Corregir; si la clave tiene `@ : / ? # & %`, codificarlos (`@` → `%40`) |
| El build se corta (`Killed` o `JavaScript heap out of memory`) | Memoria: el build es el pico | Revisar que el swap esté activo (`swapon --show`); volver a desplegar |
| El log muestra el error de un commit y luego nada más | Un commit fallido no se reintenta solo | Corregir y unir otro commit a `main`, o forzar: `sudo -u kubo FORZAR=1 /opt/kubo/bin/desplegar.sh` |
| «No pasó la salud» y volvió al anterior | La app no arrancó o no llega a la base | `journalctl -u kubo.service -n 100`; `curl -s localhost:3000/api/v1/salud` |
| El disco se llena | Releases y logs | `df -h /`; se guardan solo 3 releases; `rm -rf /opt/kubo/releases/<sha-viejo>` si hace falta (nunca el de `current`) |
| La base aparece encendida sin haberla iniciado | AWS reinicia una RDS detenida a los 7 días | Detenerla otra vez al terminar la sesión |
| No aparece «Pagar» en AP-02 | Falta `PASARELA`, `MP_ACCESS_TOKEN` o `MP_WEBHOOK_SECRET`, o tienen un valor demasiado corto | `journalctl -u kubo.service \| grep -i pasarela` (solo nombra las variables); paso 3 de «Pago en línea» |
| Los avisos de Mercado Pago responden 401 | `MP_WEBHOOK_SECRET` no es la clave secreta del webhook de la aplicación | Revelarla otra vez en Mercado Pago y volver a cargarla (paso 3); la conciliación registra los pagos aprobados mientras tanto |
| Un pago aprobado queda «En proceso» | El aviso no llegó (EC2 apagada o URL mal configurada) | Esperar a la conciliación (máximo 25 minutos) o `systemctl start kubo-conciliar-pagos.service` |
