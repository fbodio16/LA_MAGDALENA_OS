#!/bin/bash
set -e
cd "$(dirname "$0")"
chmod +x "REINICIAR_LIMPIO.command" 2>/dev/null || true
exec ./REINICIAR_LIMPIO.command
