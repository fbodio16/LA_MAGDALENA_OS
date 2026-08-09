# Activar Sentinel-1 y Sentinel-2

La aplicación queda preparada para usar la misma cuenta de Copernicus Data Space con ambas misiones.

## 1. Crear la tabla radar

En Supabase, abrir **SQL Editor**, crear una consulta nueva, pegar todo el archivo
`PEGAR_EN_SUPABASE_ACTIVAR_SENTINEL_1_Y_2.sql` y presionar **Run**.

Este paso agrega una tabla nueva. No borra ni modifica las observaciones Sentinel-2 existentes.

## 2. Publicar la función

Publicar la carpeta `supabase/functions/satellite-sync` como Edge Function `satellite-sync`.
La función necesita estos Secrets de Supabase:

- `COPERNICUS_CLIENT_ID`
- `COPERNICUS_CLIENT_SECRET`

Si ya estaban configurados, no volver a crearlos ni compartirlos. La misma cuenta sirve para consultar Sentinel-1 GRD y Sentinel-2 L2A.

## 3. Comprobar desde la aplicación

Abrir **Inteligencia Satelital** y presionar **Sincronizar ambos**.

La auditoría debe mostrar una fila por válvula y estas dos fechas:

- Sentinel-1: radar VV, VH, relación VH/VV e índice radar.
- Sentinel-2: NDVI, NDRE y MSAVI.

Si alguna fila muestra **Falta sincronizar**, revisar primero que el lote tenga su polígono georreferenciado.

## Interpretación responsable

Sentinel-1 y Sentinel-2 se conservan como fuentes separadas. Los índices satelitales complementan el suelo, el clima y las recorridas; no reemplazan mediciones agronómicas ni activan hardware.
