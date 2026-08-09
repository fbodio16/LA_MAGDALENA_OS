#!/bin/bash
set -e
cd "$(dirname "$0")/apps/mobile"
if ! command -v npm >/dev/null 2>&1; then
  echo "Falta Node.js/npm. Instalalo desde nodejs.org"
  read -n 1 -s -r -p "Presioná una tecla para cerrar..."
  exit 1
fi
npm install
npx expo start --clear
