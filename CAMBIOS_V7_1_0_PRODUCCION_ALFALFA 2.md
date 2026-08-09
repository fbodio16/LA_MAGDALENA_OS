# LA MAGDALENA OS 7.1.0 · Producción de Alfalfa

- Registro definitivo de cortes vinculado a empresa y lote.
- Validación de superficie contra las hectáreas del lote.
- Advertencia ante cortes duplicados por lote, fecha y número.
- Código de partida generado automáticamente.
- Validaciones de rollos, peso y superficie.
- Migración idempotente `005_alfalfa_production_core.sql`.
- Índices para historial por lote y campaña.
- Campos estructurados para campaña, calidad, humedad, ubicación y estado operativo.
- Marca automática de fecha de última modificación.

La migración no elimina datos existentes.
