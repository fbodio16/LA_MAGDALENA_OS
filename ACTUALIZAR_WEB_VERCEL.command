#!/bin/zsh
set -e
cd "$(dirname "$0")"
echo "=============================================="
echo " LA MAGDALENA OS v92.1.0 - PUBLICAR EN VERCEL"
echo "=============================================="
echo ""
if command -v node >/dev/null 2>&1; then
  npm run check:release
fi
cd apps/web
npx --yes vercel@latest --prod
echo ""
echo "LISTO: v92.1.0 publicada en Vercel."
read "REPLY?Presioná Enter para cerrar..."
