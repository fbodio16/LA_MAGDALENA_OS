#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

echo "============================================================"
echo " LA MAGDALENA OS 36.8 · MOTOR DE RIEGO · WEB + APP"
echo "============================================================"

echo "1/4 Instalando dependencias..."
npm install

echo "2/4 Verificando la versión web..."
npm run check:release

echo "3/4 Sincronizando iPhone / iPad / Mac..."
node scripts/apple-create.mjs
npx cap sync ios

echo "4/4 Abriendo Xcode..."
npx cap open ios

echo
echo "LISTO: la app Apple quedó sincronizada con apps/web."
echo "En Xcode presioná Command + R."
