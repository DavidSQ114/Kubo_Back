#!/usr/bin/env bash
# Prepara una EC2 Ubuntu 24.04 para Kubo (docs/DESPLIEGUE-AWS.md, paso 5). Se ejecuta una vez como root por
# Session Manager y es idempotente: volver a ejecutarlo actualiza los scripts, las unidades y el dominio.
#   sudo bash deploy/aws/instalar.sh
# Deja: swap de 2 GB, Node 22, git, Caddy y cliente de PostgreSQL; usuario kubo con /opt/kubo; la plantilla
# /etc/kubo/kubo.env (sin valores); el dominio para Caddy y las unidades systemd.
# Dominio: si existe /etc/kubo/dominio (una línea, por ejemplo kubo-codecoffee.duckdns.org) y resuelve a la IP
# pública de la instancia, es el principal y <ip-con-guiones>.sslip.io redirige a él; si no, el principal es sslip.io.
set -euo pipefail

DIR_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USUARIO="kubo"
RAIZ="/opt/kubo"
CONFIG="/etc/kubo"
VERSION_NODE="22"
TAMANO_SWAP="2G"
URL_CERTIFICADO_RDS="https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem"

paso() { printf '\n==> %s\n' "$*"; }
aviso() { printf 'AVISO: %s\n' "$*" >&2; }

# Primera línea de /etc/kubo/dominio, sin espacios y en minúsculas (vacío si no existe).
leer_dominio_propio() {
  if [[ -f "$CONFIG/dominio" ]]; then head -n 1 "$CONFIG/dominio" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]'; fi
}

# ¿El dominio resuelve (registro A) a la IP pública de la instancia?
resuelve_a_la_instancia() {
  getent ahostsv4 "$1" | awk '{print $1}' | grep -qxF "$IP_PUBLICA"
}

if [[ $EUID -ne 0 ]]; then
  echo "Ejecuta como root: sudo bash $0" >&2
  exit 1
fi

paso "Swap de $TAMANO_SWAP"
if ! swapon --show=NAME --noheadings | grep -qx /swapfile; then
  [[ -f /swapfile ]] || fallocate -l "$TAMANO_SWAP" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
fi
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
# usar el swap solo cuando falte memoria (el build de Next.js es el pico)
echo 'vm.swappiness=10' >/etc/sysctl.d/90-kubo-swap.conf
sysctl -q -p /etc/sysctl.d/90-kubo-swap.conf

paso "Paquetes base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q ca-certificates curl gnupg git postgresql-client debian-keyring debian-archive-keyring apt-transport-https

paso "Node.js $VERSION_NODE"
if ! command -v node >/dev/null || [[ "$(node -v)" != v${VERSION_NODE}.* ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${VERSION_NODE}.x" | bash -
  apt-get install -y -q nodejs
fi
node -v

paso "Caddy"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' |
    gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' >/etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy
fi
caddy version

paso "Usuario $USUARIO y carpetas"
id "$USUARIO" >/dev/null 2>&1 || useradd --system --create-home --home-dir "/home/$USUARIO" --shell /bin/bash "$USUARIO"
install -d -o "$USUARIO" -g "$USUARIO" -m 755 "$RAIZ" "$RAIZ/releases" "$RAIZ/shared" "$RAIZ/shared/logs" "$RAIZ/bin"
install -o root -g root -m 755 "$DIR_SCRIPT/desplegar.sh" "$RAIZ/bin/desplegar.sh"

paso "Configuración en $CONFIG"
install -d -o root -g "$USUARIO" -m 750 "$CONFIG"
if [[ ! -f "$CONFIG/kubo.env" ]]; then
  install -o "$USUARIO" -g "$USUARIO" -m 600 "$DIR_SCRIPT/kubo.env.ejemplo" "$CONFIG/kubo.env"
  echo "Creado $CONFIG/kubo.env desde la plantilla: complétalo con sudo nano $CONFIG/kubo.env"
else
  chown "$USUARIO:$USUARIO" "$CONFIG/kubo.env"
  chmod 600 "$CONFIG/kubo.env"
  echo "$CONFIG/kubo.env ya existe: no se modifica"
fi
# certificado de AWS RDS para que el driver pg verifique la conexión cifrada (sslrootcert en DATABASE_URL)
curl -fsSL "$URL_CERTIFICADO_RDS" -o "$CONFIG/rds-global-bundle.pem.nuevo"
install -o root -g root -m 644 "$CONFIG/rds-global-bundle.pem.nuevo" "$CONFIG/rds-global-bundle.pem"
rm -f "$CONFIG/rds-global-bundle.pem.nuevo"

paso "Dominio para HTTPS"
# IP pública de la instancia (la Elastic IP si ya está asociada), por el servicio de metadatos (IMDSv2)
TOKEN="$(curl -fsS -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')"
IP_PUBLICA="$(curl -fsS -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 || true)"
if [[ -z "$IP_PUBLICA" ]]; then
  echo "La instancia no tiene IP pública: asocia la Elastic IP y vuelve a ejecutar este script." >&2
  exit 1
fi
DOMINIO_RESPALDO="${IP_PUBLICA//./-}.sslip.io"
DOMINIO="$DOMINIO_RESPALDO"
DOMINIO_PROPIO="$(leer_dominio_propio)"
if [[ -n "$DOMINIO_PROPIO" && "$DOMINIO_PROPIO" != "$DOMINIO_RESPALDO" ]]; then
  if [[ ! "$DOMINIO_PROPIO" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ ]]; then
    aviso "$CONFIG/dominio tiene «$DOMINIO_PROPIO», que no es un dominio válido. Se usa $DOMINIO_RESPALDO."
  elif ! resuelve_a_la_instancia "$DOMINIO_PROPIO"; then
    RESUELTO="$(getent ahostsv4 "$DOMINIO_PROPIO" | awk '{print $1}' | sort -u | paste -sd ' ' || true)"
    aviso "$DOMINIO_PROPIO resuelve a «${RESUELTO:-nada}» y no a $IP_PUBLICA. Se usa $DOMINIO_RESPALDO."
    aviso "Apunta el dominio a la Elastic IP, espera un par de minutos y vuelve a ejecutar este script."
  else
    DOMINIO="$DOMINIO_PROPIO"
  fi
fi
echo "Principal: $DOMINIO  ·  Respaldo: $DOMINIO_RESPALDO"

paso "Caddy y systemd"
CADDYFILE_NUEVO="$(mktemp)"
if [[ "$DOMINIO" == "$DOMINIO_RESPALDO" ]]; then
  # sin dominio propio no hay a quién redirigir: se quita el bloque de respaldo
  sed '/^# --- respaldo: inicio ---$/,/^# --- respaldo: fin ---$/d' "$DIR_SCRIPT/Caddyfile" >"$CADDYFILE_NUEVO"
else
  cp "$DIR_SCRIPT/Caddyfile" "$CADDYFILE_NUEVO"
fi
# se valida antes de reemplazar el que está en uso: si falla, Caddy sigue con la configuración anterior
if ! VALIDACION="$(KUBO_DOMINIO="$DOMINIO" KUBO_DOMINIO_RESPALDO="$DOMINIO_RESPALDO" \
  caddy validate --adapter caddyfile --config "$CADDYFILE_NUEVO" 2>&1)"; then
  printf '%s\n' "$VALIDACION" >&2
  rm -f "$CADDYFILE_NUEVO"
  echo "El Caddyfile no es válido: no se reinicia Caddy." >&2
  exit 1
fi
install -o root -g root -m 644 "$CADDYFILE_NUEVO" /etc/caddy/Caddyfile
rm -f "$CADDYFILE_NUEVO"
# archivo aparte para que Caddy no reciba los secretos de kubo.env
printf 'KUBO_DOMINIO=%s\nKUBO_DOMINIO_RESPALDO=%s\n' "$DOMINIO" "$DOMINIO_RESPALDO" >"$CONFIG/caddy.env"
chmod 644 "$CONFIG/caddy.env"
install -d -m 755 /etc/systemd/system/caddy.service.d
printf '[Service]\nEnvironmentFile=%s/caddy.env\n' "$CONFIG" >/etc/systemd/system/caddy.service.d/kubo.conf
for unidad in kubo.service kubo-desplegar.service kubo-desplegar.timer kubo-conciliar-pagos.service \
  kubo-conciliar-pagos.timer; do
  install -o root -g root -m 644 "$DIR_SCRIPT/systemd/$unidad" "/etc/systemd/system/$unidad"
done
# desplegar.sh corre como kubo y solo puede reiniciar kubo.service
cat >/etc/sudoers.d/kubo-desplegar <<SUDOERS
$USUARIO ALL=(root) NOPASSWD: /usr/bin/systemctl restart kubo.service
SUDOERS
chmod 440 /etc/sudoers.d/kubo-desplegar
visudo -cf /etc/sudoers.d/kubo-desplegar >/dev/null
# el log de despliegues rota cada semana; el de la aplicación rota solo (LOG_DIR, 50 MB)
cat >/etc/logrotate.d/kubo-despliegue <<ROTACION
$RAIZ/shared/logs/despliegue.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  copytruncate
}
ROTACION

systemctl daemon-reload
systemctl enable kubo.service >/dev/null
systemctl enable --now kubo-desplegar.timer >/dev/null
# conciliación de pagos en línea (US71); sin PASARELA en kubo.env no hace nada
systemctl enable --now kubo-conciliar-pagos.timer >/dev/null
systemctl enable caddy >/dev/null
systemctl restart caddy

paso "Listo"
echo "Dominio principal: https://$DOMINIO"
if [[ "$DOMINIO" != "$DOMINIO_RESPALDO" ]]; then
  echo "Respaldo: https://$DOMINIO_RESPALDO (redirige al principal con la misma ruta)"
fi
echo "Recuerda: APP_URL en $CONFIG/kubo.env debe ser https://$DOMINIO"
APP_URL_ACTUAL="$(sed -n 's/^APP_URL=//p' "$CONFIG/kubo.env" | tail -n 1 | tr -d "\"'")"
if [[ -n "$APP_URL_ACTUAL" && "$APP_URL_ACTUAL" != *"<"* && "$APP_URL_ACTUAL" != "https://$DOMINIO" ]]; then
  aviso "APP_URL es $APP_URL_ACTUAL. Cámbialo a https://$DOMINIO y reinicia: systemctl restart kubo.service"
fi
# solo las líneas de las variables, no los comentarios de la plantilla
if grep -Eq '^DATABASE_URL=.*<(usuario|clave|endpoint-rds)>|^JWT_SECRET=""' "$CONFIG/kubo.env"; then
  echo "Falta completar $CONFIG/kubo.env (DATABASE_URL, JWT_SECRET y APP_URL=https://$DOMINIO)."
  echo "Después: sudo systemctl start kubo-desplegar.service  y  sudo tail -f $RAIZ/shared/logs/despliegue.log"
else
  echo "El despliegue corre al arrancar y cada 5 minutos. Ahora: sudo systemctl start kubo-desplegar.service"
fi
