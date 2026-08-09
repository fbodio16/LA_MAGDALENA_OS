#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "Sincronizando LA MAGDALENA OS 36.2 con Xcode..."
npm install
if [ ! -d "ios" ]; then
  echo "La plataforma iOS todavía no existe. Creándola automáticamente..."
  npx cap add ios
fi
npx cap sync ios
npx cap open ios
