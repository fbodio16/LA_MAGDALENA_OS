# LA MAGDALENA OS v61.2.0 — Fusión hídrica

- Todos los relojes muestran un estado, incluso cuando falta calibración completa.
- Prioridad de cálculo: balance calibrado de suelo + riego + lluvia + ET0 + satélite; luego vista hídrica existente; por último estimación preventiva.
- Las estimaciones quedan identificadas como **Estimado** y no se presentan como exactas.
- Se integran NDVI/observaciones satelitales para ajustar Kc y consumo.
- Se prioriza la estación meteorológica propia; Open-Meteo queda como respaldo.
- Se mantiene toda la estructura y todos los registros existentes en Supabase.
- No incluye migraciones destructivas ni borrado de datos.

## Para alcanzar precisión calibrada por válvula
Cada sector necesita: perfil hídrico, muestras 0–30 y 30–60 cm, densidad aparente, fecha de implantación, Kc, eficiencia, caudal/superficie y ET0 de estación.
