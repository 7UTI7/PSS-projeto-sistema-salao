#!/usr/bin/env bash
# MongoDB local de homologação, sem Docker (WSL/Ubuntu).
#   ./ops/local/mongo.sh setup   -> cria pastas, config, senhas, sobe o mongod e cria os usuários
#   ./ops/local/mongo.sh start | stop | status
#   ./ops/local/mongo.sh rotate  -> rotaciona os logs (MongoDB e API) via logrotate
# Segredos ficam em ops/local/.runtime/mongo.env (permissão 600, ignorado pelo Git).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
RUNTIME="$HERE/.runtime"
CONF="$RUNTIME/mongod.conf"
SECRETS="$RUNTIME/mongo.env"
BACKEND_ENV="$REPO/backend/.env"
MONGO_PORT=27717
MONGO_APP_DB=salao

# Usa o mongod do PATH ou o binário que o mongodb-memory-server já baixou para os testes.
find_mongod() {
  if [[ -n "${MONGOD_BIN:-}" ]]; then echo "$MONGOD_BIN"; return; fi
  if command -v mongod >/dev/null 2>&1; then command -v mongod; return; fi
  local cached
  cached="$(find "$REPO/backend/node_modules/.cache/mongodb-memory-server" -maxdepth 1 -type f -name 'mongod-*' ! -name '*.md5' 2>/dev/null | head -1)"
  [[ -n "$cached" ]] || { echo "mongod não encontrado. Rode 'npm test' no backend uma vez ou defina MONGOD_BIN." >&2; exit 1; }
  echo "$cached"
}

secret() { openssl rand -base64 33 | tr -d '/+=' | cut -c1-32; }

running() { [[ -f "$RUNTIME/mongod.pid" ]] && kill -0 "$(cat "$RUNTIME/mongod.pid")" 2>/dev/null; }

start() {
  if running; then echo "mongod já está rodando (PID $(cat "$RUNTIME/mongod.pid"))."; return; fi
  "$(find_mongod)" --config "$CONF" --fork >/dev/null
  echo "mongod iniciado em 127.0.0.1:$MONGO_PORT (PID $(cat "$RUNTIME/mongod.pid"))."
}

stop() {
  if running; then kill "$(cat "$RUNTIME/mongod.pid")"; echo "mongod encerrado."; else echo "mongod não está rodando."; fi
}

write_logrotate() {
  sed "s#__RUNTIME__#$RUNTIME#g" "$REPO/ops/logrotate/sistema-salao.local.conf" > "$RUNTIME/logrotate.conf"
}

setup() {
  if [[ -f "$SECRETS" ]]; then echo "Já configurado ($SECRETS). Use start/stop."; exit 1; fi
  umask 077
  mkdir -p "$RUNTIME/data" "$RUNTIME/logs"
  sed "s#__RUNTIME__#$RUNTIME#g" "$HERE/mongod.conf.template" > "$CONF"
  write_logrotate

  cat > "$SECRETS" <<EOF
MONGO_PORT=$MONGO_PORT
MONGO_APP_DB=$MONGO_APP_DB
MONGO_ADMIN_USER=salao_dba
MONGO_ADMIN_PASSWORD=$(secret)
MONGO_APP_USER=salao_api
MONGO_APP_PASSWORD=$(secret)
EOF
  chmod 600 "$SECRETS"

  start
  sleep 2
  (set -a; . "$SECRETS"; set +a; cd "$REPO/backend" && npx tsx src/scripts/create-local-mongo-users.ts)

  if [[ -f "$BACKEND_ENV" ]]; then
    echo "backend/.env já existe; ajuste MONGO_URI manualmente (veja $SECRETS)."
  else
    # shellcheck disable=SC1090
    . "$SECRETS"
    cat > "$BACKEND_ENV" <<EOF
NODE_ENV=development
# Porta da API alterada (padrão do projeto era 3000).
PORT=3900
HOST=127.0.0.1
LOG_LEVEL=info
LOG_FILE=$RUNTIME/logs/api.log
MONGO_URI=mongodb://$MONGO_APP_USER:$MONGO_APP_PASSWORD@127.0.0.1:$MONGO_PORT/$MONGO_APP_DB?authSource=$MONGO_APP_DB
MONGO_DB_NAME=$MONGO_APP_DB
JWT_SECRET=$(openssl rand -base64 48)
DATA_ENCRYPTION_KEY=$(openssl rand -base64 32)
CORS_ORIGIN=http://localhost:8081
API_PUBLIC_URL=http://127.0.0.1:3900
FRONTEND_PUBLIC_URL=http://localhost:8081
OTEL_SERVICE_NAME=sistema-salao-api
EOF
    chmod 600 "$BACKEND_ENV"
    echo "backend/.env criado para a homologação local (porta 3900, MongoDB em $MONGO_PORT)."
  fi
}

rotate() {
  write_logrotate
  logrotate --force --state "$RUNTIME/logrotate.state" "$RUNTIME/logrotate.conf"
  echo "Logs rotacionados em $RUNTIME/logs:"
  ls -l "$RUNTIME/logs"
}

case "${1:-}" in
  setup) setup ;;
  start) start ;;
  stop) stop ;;
  status) if running; then echo "rodando (PID $(cat "$RUNTIME/mongod.pid"))"; else echo "parado"; fi ;;
  rotate) rotate ;;
  *) echo "Uso: $0 setup|start|stop|status|rotate" >&2; exit 2 ;;
esac
