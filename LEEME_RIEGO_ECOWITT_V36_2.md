# LA MAGDALENA OS 36.2 · Riego Inteligente + Ecowitt

## Incluido

- Carga de humedad gravimétrica por lote, fecha y profundidad.
- Perfil hídrico por lote: capacidad de campo, punto de marchitez, raíces, Kc, eficiencia y caudal del riego.
- Estado y configuración Ecowitt sin exponer claves en el navegador.
- Sincronización manual desde la aplicación mediante una Supabase Edge Function.
- Almacenamiento de temperatura, humedad, lluvia, viento, radiación y presión.
- Estimación de lámina y tiempo de riego con indicador de confianza.
- Validación con NDVI/NDMI cuando existen datos satelitales o de dron.

## Instalación en Supabase

1. Abrir Supabase → SQL Editor.
2. Ejecutar `supabase/031_ecowitt_integration_v36_2.sql`.
3. Desplegar la función:

```bash
supabase functions deploy ecowitt-sync
```

La función usa automáticamente `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` del proyecto.

## Actualizar la aplicación Apple

Desde la raíz del proyecto:

```bash
bash ./02_SINCRONIZAR_APP_APPLE.command
```

Luego ejecutar en Xcode con `⌘ + R`.

## Conectar Ecowitt

Dentro de la aplicación:

1. Abrir **Inteligencia hídrica**.
2. Presionar **Conectar Ecowitt**.
3. Ingresar MAC, Application Key y API Key.
4. Presionar **Guardar y probar conexión**.

Las claves se almacenan en la tabla protegida `ecowitt_integrations` y no se cargan al navegador. La app solo consulta la vista segura `ecowitt_integrations_public`.

## Importante

La humedad estimada es un balance hídrico, no una nueva medición de laboratorio. La app conserva la fecha y el valor de la muestra real y muestra por separado la estimación actual y su nivel de confianza.
