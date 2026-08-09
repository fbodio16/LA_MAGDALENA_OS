#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT=8080
PIDS="$(lsof -ti tcp:$PORT 2>/dev/null || true)"
[ -z "$PIDS" ] || kill -9 $PIDS 2>/dev/null || true
open "http://localhost:$PORT/?limpiar-cache=3.0.0"
exec "$ROOT/ABRIR_WEB_LOCAL.command"
