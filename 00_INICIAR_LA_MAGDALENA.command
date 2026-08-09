#!/bin/bash
set -e
cd "$(dirname "$0")"
chmod +x "ABRIR_WEB_LOCAL.command" 2>/dev/null || true
exec ./ABRIR_WEB_LOCAL.command
