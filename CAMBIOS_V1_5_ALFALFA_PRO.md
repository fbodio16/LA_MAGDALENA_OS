# LA MAGDALENA OS 1.5 · Alfalfa PRO

Cambios incluidos:
- Módulo Producción separado e integrado con app.js.
- Indicadores de rollos del día y del mes, toneladas del año, rendimiento, stock y valor estimado.
- Costos por corte: combustible, mano de obra, maquinaria, flete y reparaciones.
- Cálculo de costo total, por rollo, por hectárea y por tonelada.
- Datos operativos: operador, equipo, contratista, horarios, humedad y clima.
- Exportación CSV del historial filtrado.
- Filtros por búsqueda, lote, calidad y destino.
- Caché del Service Worker actualizado.

No se modificó el esquema de Supabase. Los nuevos datos se guardan dentro del campo `notes` usando el formato existente `LMOS_CUT`.
