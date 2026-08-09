# LA MAGDALENA OS v60.6.0 — riego exacto e intuitivo

Esta versión corrige la estimación de duración de los riegos sin modificar los registros históricos de Supabase.

## Qué cambió

- Se eliminó el uso silencioso de 4,5 mm/h como si fuera una calibración real.
- La tasa de aplicación se obtiene, en este orden, de:
  1. caudal y superficie configurados;
  2. último riego del sector con milímetros y horas registrados;
  3. tasa calibrada del perfil, siempre que no sea el valor provisional heredado de 4,5 mm/h.
- Si no existe información suficiente, la aplicación muestra “duración pendiente de calibración”.
- El detalle de cada válvula informa la tasa usada y su fuente.
- El formulario de perfil advierte que 4,5 mm/h es un valor provisional heredado.
- La pantalla antigua de riego ya no calcula con ET₀ ni tasas fijas: muestra solamente el historial real.
- Se incorporó una calibración guiada de las 13 válvulas con siete controles por sector.
- La exportación identifica la tasa, su origen y los valores pendientes.
- Los sectores incompletos no reciben una recomendación ni una proyección aparentemente exacta.
- Se eliminaron los supuestos silenciosos de ET₀, profundidad radicular y capacidad de suelo.

## Perfil de suelo confirmado

- Textura: franco limoso.
- Capacidad útil: 320 mm hasta 200 cm.
- Relación de almacenamiento: 1,6 mm por centímetro de profundidad radicular activa.
- La raíz activa se calcula según cultivo y días desde la implantación.
- El consumo se calcula mediante ET₀ × Kc; se suman la lluvia útil y el riego efectivo.
- Un límite radicular medido puede reemplazar el máximo agronómico estimado.

## Caso V-08 verificado

El historial contiene 11 mm aplicados durante 8 horas. La tasa observada es 1,375 mm/h. Para una recomendación de 45 mm, la duración estimada pasa a 32,7 horas. Este cálculo es orientativo hasta confirmar el caudal real y la superficie efectivamente regada.

## Seguridad de datos

La actualización es sólo de lógica y presentación. No elimina, reemplaza ni recarga muestras, riegos, perfiles ni datos satelitales.
