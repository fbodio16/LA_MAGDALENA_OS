#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "============================================================"
echo " LA MAGDALENA OS 36.7 · PUBLICAR VERSIÓN WEB"
echo "============================================================"

npm install
npm run check:release
cd apps/web
npx --yes vercel@latest --prod

echo
echo "LISTO: la web fue publicada con el mismo código usado por la app."
