#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/apps/web"
echo "Abriendo LA MAGDALENA OS en http://localhost:8080"
python3 -m http.server 8080 &
sleep 2
open http://localhost:8080
wait
