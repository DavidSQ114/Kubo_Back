#!/usr/bin/env bash
# Despliega en la EC2 el último commit de main (docs/DESPLIEGUE-AWS.md). Lo ejecuta kubo-desplegar.service como
# el usuario kubo, al arrancar la instancia y cada 5 minutos; también a mano: sudo systemctl start kubo-desplegar
#   1. git fetch del repositorio público; si origin/main no es el commit desplegado, lo clona en releases/<sha>.
#   2. npm ci (con devDependencies), npm run build y prisma migrate deploy con /etc/kubo/kubo.env.
#   3. Cambia el symlink current, reinicia kubo.service y consulta GET /api/v1/salud.
# Si algo falla antes del cambio, current no se toca; si la salud falla después, vuelve al release anterior.
# Un commit que falló no se reintenta solo (se registra en shared/fallido): FORZAR=1 lo vuelve a intentar.
set -euo pipefail

RAIZ="${KUBO_RAIZ:-/opt/kubo}"
REPOSITORIO="${KUBO_REPOSITORIO:-https://github.com/DavidSQ114/Kubo_Back.git}"
RAMA="${KUBO_RAMA:-main}"
ARCHIVO_ENTORNO="${KUBO_ENTORNO:-/etc/kubo/kubo.env}"
URL_SALUD="http://127.0.0.1:3000/api/v1/salud"
RELEASES_CONSERVADOS=3
INTENTOS_SALUD=30 # cada 2 s: hasta 1 minuto para que Next.js arranque
# el build de Next.js en una t3.small (2 GB + 2 GB de swap) necesita un tope de memoria para no matar la instancia
MEMORIA_BUILD_MB=1536

ESPEJO="$RAIZ/repo.git"
RELEASES="$RAIZ/releases"
ACTUAL="$RAIZ/current"
LOG="$RAIZ/shared/logs/despliegue.log"
CANDADO="$RAIZ/shared/despliegue.lock"
FALLIDO="$RAIZ/shared/fallido"

mkdir -p "$RELEASES" "$(dirname "$LOG")"
exec >>"$LOG" 2>&1

registrar() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

# un solo despliegue a la vez (el timer puede coincidir con uno manual)
exec 9>"$CANDADO"
if ! flock -n 9; then
  registrar "Otro despliegue está en curso: se omite esta ejecución."
  exit 0
fi

sha_desplegado() {
  if [[ -L "$ACTUAL" ]]; then basename "$(readlink -f "$ACTUAL")"; fi
}

reiniciar_app() { sudo -n /usr/bin/systemctl restart kubo.service; }

apuntar_current() {
  ln -sfn "$1" "$ACTUAL.nuevo"
  mv -T "$ACTUAL.nuevo" "$ACTUAL" # cambio atómico del symlink
}

salud_ok() {
  local sha_corto="$1" respuesta
  for ((i = 1; i <= INTENTOS_SALUD; i++)); do
    respuesta="$(curl -fsS --max-time 5 "$URL_SALUD" 2>/dev/null || true)"
    if [[ "$respuesta" == *'"estado":"ok"'* && "$respuesta" == *"\"version\":\"$sha_corto\""* ]]; then
      registrar "Salud: $respuesta"
      return 0
    fi
    sleep 2
  done
  registrar "Salud fallida tras $INTENTOS_SALUD intentos. Última respuesta: ${respuesta:-sin respuesta}"
  return 1
}

limpiar_releases() {
  local en_uso
  en_uso="$(sha_desplegado)"
  # más nuevos primero; se conservan los últimos 3 y nunca el que está en uso
  find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %f\n' | sort -rn | awk '{print $2}' |
    tail -n +$((RELEASES_CONSERVADOS + 1)) | while read -r viejo; do
      if [[ "$viejo" != "$en_uso" ]]; then
        rm -rf "${RELEASES:?}/$viejo"
        registrar "Release borrado: $viejo"
      fi
    done
}

# Cada paso termina con «|| exit 1»: se llama dentro de un if, donde bash ignora set -e.
construir() {
  local dir="$1" sha="$2"
  (
    cd "$dir" || exit 1
    set -a
    # shellcheck disable=SC1090 # el archivo del servidor no está en el repositorio
    . "$ARCHIVO_ENTORNO" || exit 1
    set +a
    # next start carga .env.production: así GET /api/v1/salud informa el commit desplegado
    printf 'KUBO_VERSION=%s\n' "$sha" >.env.production || exit 1
    registrar "npm ci"
    # con NODE_ENV=production npm omitiría las devDependencies, que el build y prisma necesitan
    npm ci --include=dev --no-audit --no-fund || exit 1
    registrar "npm run build"
    NODE_OPTIONS="--max-old-space-size=$MEMORIA_BUILD_MB" npm run build || exit 1
    registrar "prisma migrate deploy"
    npx prisma migrate deploy || exit 1
  )
}

# ---------- 1. ¿Hay un commit nuevo en main? ----------

# solo se mira la línea DATABASE_URL: los comentarios de kubo.env pueden mencionar los marcadores sin que falte nada
if [[ ! -f "$ARCHIVO_ENTORNO" ]] || grep -Eq '^DATABASE_URL=.*<(usuario|clave|endpoint-rds)>' "$ARCHIVO_ENTORNO"; then
  registrar "Falta completar $ARCHIVO_ENTORNO (DATABASE_URL, JWT_SECRET, APP_URL): no se despliega."
  exit 0
fi

if [[ ! -d "$ESPEJO" ]]; then
  git clone --quiet --bare "$REPOSITORIO" "$ESPEJO"
fi
git -C "$ESPEJO" fetch --quiet --prune origin "+refs/heads/$RAMA:refs/heads/$RAMA"
SHA="$(git -C "$ESPEJO" rev-parse "refs/heads/$RAMA")"
SHA_CORTO="${SHA:0:7}"
DESPLEGADO="$(sha_desplegado)"

if [[ "$SHA" == "$DESPLEGADO" ]]; then
  exit 0 # sin cambios: no se registra nada para no llenar el log cada 5 minutos
fi
if [[ "${FORZAR:-0}" != "1" && -f "$FALLIDO" && "$(cat "$FALLIDO")" == "$SHA" ]]; then
  exit 0 # ya falló este commit: se espera uno nuevo en main (o FORZAR=1)
fi

registrar "==== Desplegando $SHA_CORTO (en uso: ${DESPLEGADO:0:7}) ===="
DESTINO="$RELEASES/$SHA"

# ---------- 2. Clonar y construir sin tocar current ----------

rm -rf "$DESTINO"
git clone --quiet --no-checkout "$ESPEJO" "$DESTINO"
git -C "$DESTINO" checkout --quiet --detach "$SHA"

if ! construir "$DESTINO" "$SHA"; then
  registrar "ERROR: falló la construcción o la migración de $SHA_CORTO. current sigue en ${DESPLEGADO:0:7}."
  echo "$SHA" >"$FALLIDO"
  rm -rf "$DESTINO"
  exit 1
fi

# ---------- 3. Cambiar current, reiniciar y comprobar la salud ----------

ANTERIOR=""
if [[ -L "$ACTUAL" ]]; then ANTERIOR="$(readlink -f "$ACTUAL")"; fi
apuntar_current "$DESTINO"
reiniciar_app
registrar "current → $SHA_CORTO; kubo.service reiniciado"

if salud_ok "$SHA_CORTO"; then
  rm -f "$FALLIDO"
  registrar "==== Despliegue de $SHA_CORTO terminado ===="
  limpiar_releases
  exit 0
fi

echo "$SHA" >"$FALLIDO"
if [[ -n "$ANTERIOR" && -d "$ANTERIOR" && "$ANTERIOR" != "$DESTINO" ]]; then
  apuntar_current "$ANTERIOR"
  reiniciar_app
  registrar "ERROR: $SHA_CORTO no pasó la salud. Se volvió a $(basename "$ANTERIOR" | cut -c1-7)."
  registrar "Las migraciones de $SHA_CORTO ya se aplicaron: deben ser compatibles con el release anterior."
else
  registrar "ERROR: $SHA_CORTO no pasó la salud y no hay un release anterior al que volver."
fi
exit 1
