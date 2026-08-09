#!/bin/zsh
set -e
cd "$(dirname "$0")"
if [ ! -d .git ]; then
  echo "Primero ejecuta 00_CONFIGURAR_GIT_GITHUB.command"
  read "REPLY?Presiona Enter para cerrar..."
  exit 1
fi
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "stable" ]; then
  echo "SEGURIDAD: la publicacion solo se permite desde la rama stable."
  echo "Rama actual: $BRANCH"
  echo "Ejecuta primero 02_VOLVER_A_STABLE.command"
  read "REPLY?Presiona Enter para cerrar..."
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "SEGURIDAD: hay cambios sin guardar en Git. No se publica."
  git status --short
  read "REPLY?Presiona Enter para cerrar..."
  exit 1
fi
if command -v node >/dev/null 2>&1; then
  npm run check:release
fi
cd apps/web
npx --yes vercel@latest --prod
read "REPLY?Publicacion terminada. Presiona Enter para cerrar..."
