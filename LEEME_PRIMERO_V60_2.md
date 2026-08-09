# LA MAGDALENA OS 60.5.0 — Enterprise Recuperada

Esta edición recupera la última base integral disponible (36.10.0) y la continúa como versión 60.5.0 sin eliminar módulos ni datos históricos.

## Qué contiene

- Plataforma integral con más de 30 centros operativos.
- Inicio premium, dashboard, producción, mapas, lotes y gemelo digital.
- CRM, ventas, compras, finanzas, transporte y recursos.
- Agricultura de precisión, vuelos, NDVI y órdenes T100.
- Registro de riegos e inteligencia hídrica con Supabase.
- Aplicación web y estructura preparada para iPhone, iPad y Mac mediante Capacitor.

## Recuperación del módulo de riego

- Centro Inteligente con relojes individuales para todos los sectores.
- Ranking operativo que permite seleccionar una válvula y abrir su detalle.
- Estado general, disponibilidad media, prioridades y confianza de los cálculos.
- Recomendación de lámina, volumen y duración estimada.
- Cronología conjunta de riegos, muestras gravimétricas y vuelos.
- Proyección de agotamiento durante los próximos siete días.
- Pronóstico de lluvia integrado cuando el servicio meteorológico está disponible.
- Lee perfiles, válvulas, eventos y muestras existentes en Supabase.
- Usa muestras de las capas 0–30 y 30–60 cm.
- Mantiene el límite configurado de aplicación por turno.
- Conserva las muestras con fecha futura, pero no las utiliza en recomendaciones antes de que llegue esa fecha.
- No activa bombas, electroválvulas ni caudalímetros. El hardware permanece preparado como integración futura.

## Abrir en Mac

1. Descomprimir el ZIP.
2. Abrir la carpeta del proyecto.
3. Hacer doble clic en `00_ABRIR_WEB_LOCAL.command`.
4. Ingresar con el usuario ya registrado en Supabase.

Alternativamente, desde una terminal ubicada en la carpeta:

```bash
npm run web:start
```

Luego abrir `http://localhost:8080`.

## Base de datos

La aplicación ya apunta al proyecto existente de LA MAGDALENA OS. No es necesario volver a crear los datos. El archivo `supabase/035_v60_1_compatibilidad_datos_existentes.sql` documenta la vista de compatibilidad utilizada por el centro de riego moderno.

Las recomendaciones dependen de la calidad de los datos disponibles. La aplicación informa la confianza y exige confirmación en campo; nunca inicia ni detiene equipos.

Antes de ejecutar cualquier migración adicional, hacer una copia de seguridad de Supabase. No volver a ejecutar toda la estructura histórica sobre una base que ya contiene las tablas.

## Verificación

```bash
npm run web:check
```

Este control valida la sintaxis de todos los archivos JavaScript de la aplicación web.
