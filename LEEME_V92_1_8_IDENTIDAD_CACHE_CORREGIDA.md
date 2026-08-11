# LA MAGDALENA OS v92.1.8

Corrección de identidad y caché de la versión de prueba.

- APP_VERSION unificado en 92.1.8.
- Imports versionados en 92.1.8 para evitar servir módulos anteriores.
- Service Worker usa un caché nuevo v92.1.8 y elimina cachés anteriores al activar.
- No modifica datos de Supabase ni la lógica hídrica de la v92.1.7.
