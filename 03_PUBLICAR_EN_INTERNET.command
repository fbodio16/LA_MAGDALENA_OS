#!/bin/zsh
set -e
cd "$(dirname "$0")"

echo "=============================================="
echo " LA MAGDALENA OS - PUBLICACIÓN EN VERCEL"
echo "=============================================="
echo ""

echo "Se publicará la carpeta apps/web como sitio de producción."
echo "Vercel abrirá el navegador para iniciar sesión la primera vez."
echo ""

npx --yes vercel@latest login
npx --yes vercel@latest --prod --cwd apps/web

echo ""
echo "PUBLICACIÓN FINALIZADA."
echo "Copiá la dirección https://...vercel.app que aparece arriba."
echo "Después agregala en Supabase > Authentication > URL Configuration."
echo ""
read "REPLY?Presioná Enter para cerrar..."
