#!/bin/zsh
set -e
cd "$(dirname "$0")"
python3 - <<'PY2'
import json,hashlib,sys
from pathlib import Path
r=Path('.')
m=json.loads((r/'MOTOR_HIDRICO_PROTEGIDO.json').read_text())
ok=True
print('LA MAGDALENA OS',m['release'],'· Verificación Motor Hídrico Protegido')
for rel,info in m['files'].items():
    p=r/rel
    h=hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else 'FALTA'
    good=h==info['sha256']
    print(('OK  ' if good else 'ERROR ')+rel)
    ok &= good
print('\nRESULTADO:', 'MOTOR ÍNTEGRO' if ok else 'MOTOR MODIFICADO')
sys.exit(0 if ok else 1)
PY2
