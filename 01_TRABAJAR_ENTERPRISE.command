#!/bin/zsh
set -e
cd "$(dirname "$0")"
if [ ! -d .git ]; then
  echo "Primero ejecuta 00_CONFIGURAR_GIT_GITHUB.command"
  read "REPLY?Presiona Enter para cerrar..."
  exit 1
fi
git switch enterprise
echo ""
echo "RAMA ACTIVA: enterprise"
echo "Esta es la rama para desarrollar LA MAGDALENA OS v100."
git status --short --branch
read "REPLY?Presiona Enter para cerrar..."
