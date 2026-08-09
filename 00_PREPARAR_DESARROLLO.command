#!/bin/bash
set -e
cd "$(dirname "$0")"

printf '\033]0;LA MAGDALENA OS - Preparar desarrollo\007'
echo "=============================================="
echo " LA MAGDALENA OS · BASE PROFESIONAL CON GIT"
echo "=============================================="

chmod +x ./*.command 2>/dev/null || true

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: Git no está instalado. Instalá las herramientas de línea de comandos de Apple."
  echo "Podés iniciar la instalación con: xcode-select --install"
  read -r -p "Presioná Enter para cerrar..."
  exit 1
fi

if [ ! -d .git ]; then
  git init
  git branch -M main
fi

if ! git config user.name >/dev/null; then
  read -r -p "Tu nombre para Git (ejemplo: Franco Bodio): " GIT_NAME
  git config user.name "${GIT_NAME:-Franco Bodio}"
fi

if ! git config user.email >/dev/null; then
  read -r -p "Tu email para Git: " GIT_EMAIL
  git config user.email "$GIT_EMAIL"
fi

git add .
if ! git diff --cached --quiet; then
  git commit -m "chore: establish stable v1.6.6 baseline"
fi

echo
echo "Repositorio preparado correctamente."
echo "Rama actual: $(git branch --show-current)"
echo "Último commit: $(git log -1 --oneline)"
echo
open -a "Visual Studio Code" . || true
read -r -p "Presioná Enter para cerrar esta ventana..."
