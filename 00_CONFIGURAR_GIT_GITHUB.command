#!/bin/zsh
set -e
cd "$(dirname "$0")"

clear
echo "=========================================================="
echo " LA MAGDALENA OS - CONFIGURACION GIT PROFESIONAL"
echo " Stable: v92.1.0 | Desarrollo: enterprise"
echo "=========================================================="
echo ""

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: Git no esta instalado en esta Mac."
  echo "Instala las herramientas de Xcode con: xcode-select --install"
  read "REPLY?Presiona Enter para cerrar..."
  exit 1
fi

# Evitar que archivos temporales entren al repositorio.
cat > .gitignore <<'GITIGNORE'
node_modules/
ios/
.DS_Store
*.log
apps/web/.env.local
.vercel/
.env
.env.*
!.env.example
GITIGNORE

if [ ! -d .git ]; then
  git init
fi

# Configurar identidad si Git todavía no la tiene.
if [ -z "$(git config user.name 2>/dev/null || true)" ]; then
  echo ""
  read "GITNAME?Nombre para los commits de Git (ej. Franco Bodio): "
  git config user.name "$GITNAME"
fi
if [ -z "$(git config user.email 2>/dev/null || true)" ]; then
  echo ""
  read "GITEMAIL?Email para los commits de Git: "
  git config user.email "$GITEMAIL"
fi

# Crear/actualizar commit estable.
git add .
if ! git diff --cached --quiet; then
  git commit -m "LA MAGDALENA OS v92.1.0 FINAL estable"
fi

# Nombrar la rama actual stable.
CURRENT=$(git branch --show-current)
if [ "$CURRENT" != "stable" ]; then
  if git show-ref --verify --quiet refs/heads/stable; then
    git switch stable
  else
    git branch -M stable
  fi
fi

# Tag inmutable de la release estable.
if ! git rev-parse v92.1.0 >/dev/null 2>&1; then
  git tag -a v92.1.0 -m "LA MAGDALENA OS v92.1.0 FINAL estable"
fi

# Crear rama enterprise sin modificar stable.
if ! git show-ref --verify --quiet refs/heads/enterprise; then
  git switch -c enterprise
  cat > ENTERPRISE_ROADMAP.md <<'ROADMAP'
# LA MAGDALENA OS Enterprise

Base de desarrollo creada desde v92.1.0 FINAL.

## Próxima versión mayor
v100.0.0 Enterprise

## Regla de trabajo
- `stable`: producción / Vercel. Solo correcciones críticas.
- `enterprise`: desarrollo de nuevas funciones.
- Nunca desarrollar funciones nuevas directamente sobre `stable`.

## Fases iniciales
1. Centro de Producción Inteligente.
2. Laboratorio Inteligente.
3. Fertilización Inteligente.
4. Gemelo Digital Agronómico.
5. IA Agronómica.
6. Economía y rentabilidad.
ROADMAP
  git add ENTERPRISE_ROADMAP.md
  git commit -m "Iniciar rama Enterprise v100"
fi

# Volver a stable al finalizar para dejar produccion protegida.
git switch stable

echo ""
echo "Git local configurado correctamente:"
echo "  - rama stable     -> produccion v92.1.0"
echo "  - rama enterprise -> desarrollo v100"
echo "  - tag v92.1.0     -> punto de restauracion"
echo ""

read "REMOTE?Pega la URL HTTPS del repositorio GitHub (o Enter para hacerlo despues): "
if [ -n "$REMOTE" ]; then
  if git remote get-url origin >/dev/null 2>&1; then
    git remote set-url origin "$REMOTE"
  else
    git remote add origin "$REMOTE"
  fi
  echo ""
  echo "Subiendo stable, enterprise y la etiqueta v92.1.0..."
  git push -u origin stable
  git push -u origin enterprise
  git push origin v92.1.0
  echo ""
  echo "TODO SUBIDO A GITHUB."
else
  echo ""
  echo "Git local listo. GitHub se puede conectar despues."
fi

echo ""
echo "Estado actual:"
git status --short --branch
read "REPLY?Presiona Enter para cerrar..."
