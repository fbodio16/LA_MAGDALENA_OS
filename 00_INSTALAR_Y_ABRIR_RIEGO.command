#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

echo "============================================================"
echo " LA MAGDALENA OS 36.2 · RIEGO INTELIGENTE + ECOWITT"
echo " Instalación automática para iPhone / iPad / Mac"
echo "============================================================"

echo "1/5 Instalando dependencias..."
npm install

echo "2/5 Verificando proyecto iOS..."
if [ ! -d "ios" ]; then
  echo "La plataforma iOS no existe. Creándola ahora..."
  npx cap add ios
else
  echo "La plataforma iOS ya existe."
fi

echo "3/5 Sincronizando contenido web y plugins..."
npx cap sync ios

echo "4/5 Verificando workspace de Xcode..."
if [ ! -d "ios/App/App.xcworkspace" ]; then
  echo "ERROR: no se generó ios/App/App.xcworkspace"
  echo "Ejecutá nuevamente este archivo y enviá una captura del error."
  exit 1
fi

echo "5/5 Abriendo Xcode..."
npx cap open ios

echo "LISTO: proyecto abierto en Xcode."
