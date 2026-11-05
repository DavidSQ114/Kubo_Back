#!/usr/bin/env bash
# Prepara una EC2 Ubuntu 24.04 para Kubo (docs/DESPLIEGUE-AWS.md, paso 5). Se ejecuta una vez como root por
# Session Manager y es idempotente: volver a ejecutarlo actualiza los scripts, las unidades y el dominio.
#   sudo bash deploy/aws/instalar.sh
# Deja: swap de 2 GB, Node 22, git, Caddy y cliente de PostgreSQL; usuario kubo con /opt/kubo; la plantilla
# /etc/kubo/kubo.env (sin valores); el dominio <ip-con-guiones>.sslip.io para Caddy y las unidades systemd.
set -euo pipefail

DIR_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USUARIO="kubo"
RAIZ="/opt/kubo"
CONFIG="/etc/kubo"
VERSION_NODE="22"
TAMANO_SWAP="2G"
URL_CERTIFICADO_RDS="https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem"

paso() { printf '\n==> %s\n' "$*"; }

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
DOMINIO="${IP_PUBLICA//./-}.sslip.io"
# archivo aparte para que Caddy no reciba los secretos de kubo.env
printf 'KUBO_DOMINIO=%s\n' "$DOMINIO" >"$CONFIG/caddy.env"
chmod 644 "$CONFIG/caddy.env"

paso "Caddy y systemd"
install -o root -g root -m 644 "$DIR_SCRIPT/Caddyfile" /etc/caddy/Caddyfile
install -d -m 755 /etc/systemd/system/caddy.service.d
printf '[Service]\nEnvironmentFile=%s/caddy.env\n' "$CONFIG" >/etc/systemd/system/caddy.service.d/kubo.conf
for unidad in kubo.service kubo-desplegar.service kubo-desplegar.timer; do
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
systemctl enable caddy >/dev/null
systemctl restart caddy

paso "Listo"
echo "Dominio: https://$DOMINIO"
if grep -q '<endpoint-rds>\|^JWT_SECRET=""' "$CONFIG/kubo.env"; then
  echo "Falta completar $CONFIG/kubo.env (DATABASE_URL, JWT_SECRET y APP_URL=https://$DOMINIO)."
  echo "Después: sudo systemctl start kubo-desplegar.service  y  sudo tail -f $RAIZ/shared/logs/despliegue.log"
else
  echo "El despliegue corre al arrancar y cada 5 minutos. Ahora: sudo systemctl start kubo-desplegar.service"
fi
