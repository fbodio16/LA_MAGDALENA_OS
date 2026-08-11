# LA MAGDALENA OS v92.1.5 — Auditoría hídrica 13 válvulas

- El motor ya no reemplaza valores actuales de la vista hídrica por porcentajes históricos fijos.
- Los valores sin `balance_integrado` quedan explícitamente como provisionales.
- El respaldo histórico sólo se usa como emergencia cuando no existe ningún porcentaje actual.
- Se mantiene el motor hídrico protegido, Sentinel-2 y el Gemelo Digital.
- Objetivo: evitar falsos 100% congelados y diferenciar cálculo vigente de respaldo.
