# LA MAGDALENA OS 36.6 — Carga real habilitada

Esta versión mantiene el proyecto Apple que ya compila y agrega la activación final para comenzar a cargar datos reales.

## Orden único de activación

1. Abrir Supabase → SQL Editor → New query.
2. Copiar y ejecutar todo el archivo `00_SQL_ACTIVAR_CARGA_REAL_SUPABASE.sql`.
3. Volver a la app y abrir `Inteligencia hídrica` → `Preparar lotes`.
4. Por cada lote cargar:
   - perfil: franco limoso, 200 cm, 320 mm;
   - densidad aparente cuando esté disponible;
   - muestra 0–30 cm;
   - muestra 30–60 cm;
   - riegos posteriores a la fecha de la muestra.

## Qué queda medido y qué queda estimado

- 0–30 cm: dato real de la muestra.
- 30–60 cm: dato real de la muestra.
- 60–200 cm: reserva estimada por balance hídrico, hasta contar con calibraciones adicionales.

Las recomendaciones son orientativas hasta completar densidad aparente, capacidad de campo, punto de marchitez y calibraciones periódicas.
