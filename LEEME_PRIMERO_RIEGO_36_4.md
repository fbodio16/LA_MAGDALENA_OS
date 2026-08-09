# LA MAGDALENA OS 36.4 — Riego listo para carga real

## Orden de activación en Supabase
Ejecutar en SQL Editor:
1. `supabase/020_hydric_intelligence_v19.sql`
2. `supabase/031_ecowitt_integration_v36_2.sql`
3. `supabase/032_riego_carga_completa_v36_3.sql`
4. `supabase/033_perfil_hidrico_2m_v36_4.sql`

## Datos configurados
- Textura predeterminada: franco limoso.
- Perfil total: 0–200 cm.
- Capacidad máxima: 320 mm.
- Capas de muestreo: 0–30 y 30–60 cm.
- Reserva 60–200 cm: estimación inicial configurable, hasta recalibrar.

## Inicio de carga
Después de ejecutar los cuatro SQL, abrir Riego inteligente → Preparar lotes. Completar el perfil de cada lote y luego cargar ambas capas en una sola pantalla.
