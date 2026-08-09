#!/bin/bash
set -euo pipefail
REPO="$HOME/Documents/GitHub/la-magdalena-os"
SRC="$(cd "$(dirname "$0")" && pwd)"
REPORT="$HOME/Desktop/LA_MAGDALENA_OS_19_0_CAMBIOS.txt"
if [ ! -d "$REPO/.git" ]; then echo "No se encontró el repositorio Git en: $REPO"; read -r -p "Presioná Enter para cerrar..."; exit 1; fi
cd "$SRC"
node scripts/check-web.mjs
node scripts/check-release.mjs
{
  echo "LA MAGDALENA OS 19.0.0 · INTELIGENCIA HÍDRICA CALIBRADA"
  echo "Fecha: $(date)"
  echo "Repositorio: $REPO"
  echo
  echo "=== ARCHIVOS QUE CAMBIARÁN ==="
  diff -qr "$REPO/apps/web" "$SRC/apps/web" || true
} > "$REPORT"
rsync -a --delete "$SRC/apps/web/" "$REPO/apps/web/"
rsync -a "$SRC/supabase/" "$REPO/supabase/"
rsync -a "$SRC/docs/" "$REPO/docs/"
rsync -a "$SRC/scripts/" "$REPO/scripts/"
cp "$SRC/package.json" "$SRC/README.md" "$SRC/VERSION_19.0.0.txt" "$SRC/CAMBIOS_V19_0_0_INTELIGENCIA_HIDRICA.md" "$REPO/"
{
  echo
  echo "=== ESTADO GIT DESPUÉS DE INSTALAR ==="
  cd "$REPO"
  git status --short
} >> "$REPORT"
if [ -z "$(cd "$REPO" && git status --porcelain)" ]; then echo "No se detectaron cambios." | tee -a "$REPORT"; open -a TextEdit "$REPORT"; exit 1; fi
chmod +x "$REPO"/*.command 2>/dev/null || true
open -a TextEdit "$REPORT"
open -a "GitHub Desktop" "$REPO" || true
