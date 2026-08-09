# Estado del proyecto

## Versión estable: 1.8.0

Funcionamiento confirmado visualmente:

- Dashboard conectado a Supabase.
- 13 lotes y superficie productiva cargados.
- Formato regional de hectáreas.
- GIS con mapa satelital, polígonos, importación KML/GeoJSON y herramientas de dibujo.
- Módulos del menú cargando sin el error `flightsPage is not defined`.

## Regla de estabilidad

Antes de entregar una versión:

1. Ejecutar `npm run check:web`.
2. Abrir Dashboard.
3. Abrir Lotes.
4. Abrir Precisión y mapa.
5. Abrir Vuelos y análisis.
6. Confirmar lectura desde Supabase.
7. Registrar el cambio con Git.
