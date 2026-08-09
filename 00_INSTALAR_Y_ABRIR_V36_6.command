#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "============================================================"
echo " LA MAGDALENA OS 36.6 · CARGA REAL HABILITADA"
echo " iPhone / iPad / Mac"
echo "============================================================"
echo "1/4 Instalando dependencias..."
npm install
echo "2/4 Verificando proyecto iOS..."
node scripts/apple-create.mjs
echo "3/4 Sincronizando la versión 36.6..."
npx cap sync ios
echo "4/4 Abriendo Xcode..."
npx cap open ios
echo "LISTO: en Xcode presioná Command + R."
echo "Después ejecutá 00_SQL_ACTIVAR_CARGA_REAL_SUPABASE.sql en Supabase."
