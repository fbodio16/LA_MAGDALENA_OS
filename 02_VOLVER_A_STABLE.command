#!/bin/zsh
set -e
cd "$(dirname "$0")"
if [ ! -d .git ]; then
  echo "Primero ejecuta 00_CONFIGURAR_GIT_GITHUB.command"
  read "REPLY?Presiona Enter para cerrar..."
  exit 1
fi
git switch stable
echo ""
echo "RAMA ACTIVA: stable (PRODUCCION)"
git status --short --branch
read "REPLY?Presiona Enter para cerrar..."
