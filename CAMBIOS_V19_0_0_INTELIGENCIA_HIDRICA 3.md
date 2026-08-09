# LA MAGDALENA OS 19.0.0 — Inteligencia hídrica calibrada

## Incorporado

- Prioridad diaria de riego por lote.
- Lámina sugerida y conversión a horas de riego.
- Uso preferente de datos de la estación meteorológica propia.
- Carga de análisis de humedad gravimétrica por lote y profundidad.
- Perfil hídrico configurable por lote.
- Nivel de confianza y aviso de próxima verificación.
- Asociación con NDVI/NDMI provenientes de Mavic y observaciones satelitales.
- Exportación del diagnóstico hídrico a CSV.
- Base de datos preparada para guardar balances diarios y aprendizaje progresivo.

## Migración

Ejecutar en Supabase SQL Editor:

`supabase/020_hydric_intelligence_v19.sql`

La migración no elimina datos existentes.
