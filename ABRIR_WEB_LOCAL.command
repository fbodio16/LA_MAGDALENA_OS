#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
WEB="$ROOT/apps/web"
PORT=8080

echo "LA MAGDALENA OS 3.0.0 · PRODUCCIÓN ENTERPRISE"
echo "Cerrando servidores anteriores en el puerto $PORT..."
OLD_PIDS="$(lsof -ti tcp:$PORT 2>/dev/null || true)"
if [ -n "$OLD_PIDS" ]; then
  kill $OLD_PIDS 2>/dev/null || true
  sleep 1
  OLD_PIDS="$(lsof -ti tcp:$PORT 2>/dev/null || true)"
  [ -z "$OLD_PIDS" ] || kill -9 $OLD_PIDS 2>/dev/null || true
fi

cd "$WEB"
echo "Iniciando la versión correcta desde: $WEB"
python3 -m http.server "$PORT" > "$ROOT/servidor_local.log" 2>&1 &
SERVER_PID=$!
sleep 1

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "No se pudo iniciar el servidor. Revisá servidor_local.log"
  read -p "Presioná Enter para cerrar..."
  exit 1
fi

URL="http://localhost:$PORT/?version=3.0.0"
echo "Abriendo $URL"
open "$URL"
echo "Servidor activo. No cierres esta ventana mientras uses la plataforma."
wait "$SERVER_PID"
