# LA MAGDALENA OS 9.0.0 · Producción Real de Alfalfa

## Funciones consolidadas
- Registro por lote, campaña y número de corte.
- Superficie cortada, rollos, peso promedio y toneladas.
- Operador, contratista y maquinaria utilizada.
- Humedad, proteína, FDA, FDN, RFV y clasificación comercial.
- Costos desagregados y cálculo de costo por hectárea, rollo y tonelada.
- Código de partida, ubicación, estado y trazabilidad de stock.
- Ingresos, ventas, margen y exportación CSV.
- Resumen productivo por lote y campaña.

## Base de datos
La migración `supabase/007_alfalfa_real_production_v9.sql` agrega campos estructurados, controles de integridad, movimientos de stock y una vista de resumen. Es idempotente y no elimina datos existentes.

## Habilitación
Luego de instalar, ejecutar la migración y registrar un corte ficticio de prueba. Los datos reales se habilitan únicamente después de verificar el flujo completo.
