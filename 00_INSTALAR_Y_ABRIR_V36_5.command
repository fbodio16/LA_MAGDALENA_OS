#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "LA MAGDALENA OS 36.5 - preparando aplicación Apple..."
if [ ! -d node_modules ]; then npm install; fi
node scripts/apple-create.mjs
npx cap sync ios
npx cap open ios
echo "Listo. En Xcode elegí el simulador y presioná Command + R."
