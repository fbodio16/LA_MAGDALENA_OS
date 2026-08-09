# LA MAGDALENA OS v75.1.0 — Operativo Estable

Corrección de emergencia para uso diario mientras la estación meteorológica no está integrada.

- Si existe un balance hídrico integrado real, se usa ese cálculo.
- Si el balance integrado no está disponible (por ejemplo clima pendiente / ET0 no cargada), se muestran los últimos porcentajes validados del 06/08/2026 en vez de recalcular con valores incompletos.
- El respaldo queda marcado como valor conservado/provisional y no reemplaza un cálculo real nuevo.
- Un cálculo real `balance_integrado` siempre tiene prioridad sobre el respaldo.

Último estado validado usado como respaldo: V1 80%, V2 76%, V3 97%, V4 68%, V5 100%, V6 69%, V7 47%, V8 28%, V9 72%, V10 82%, V11 68%, V12 75%, V13 71%.
