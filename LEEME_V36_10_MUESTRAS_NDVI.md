# LA MAGDALENA OS 36.10.0

## Qué corrige
- Reconoce las capas por `layer_code` y también por profundidades 0–30 / 30–60.
- Compara IDs como texto para evitar fallas de asociación.
- Ordena por fecha y hora de creación.
- Lee NDVI desde `satellite_observations`, además de vuelos y observaciones manuales.
- Agrega **Cargar NDVI** para Sentinel-2 o Mavic procesado.
- Aplica una corrección moderada del Kc según NDVI.

## Antes de probar
Ejecutar `SQL_V36_10_REPARAR_CAPAS_Y_NDVI.sql` en Supabase.

## Importante
El NDVI no vuelve el cálculo “exacto” por sí solo. Mejora la estimación del vigor y Kc, pero la recomendación debe calibrarse con gravimetría, lluvia/riego medidos y ET0. La sincronización automática Sentinel requiere desplegar la Edge Function `satellite-sync` y configurar las credenciales de Copernicus en Supabase.
