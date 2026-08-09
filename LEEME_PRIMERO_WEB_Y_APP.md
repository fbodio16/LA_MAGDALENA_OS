# LA MAGDALENA OS 36.7 — Web y App unificadas

Esta versión usa una sola fuente de interfaz y lógica:

`apps/web`

Capacitor copia exactamente esa carpeta a Xcode. Por eso, cualquier cambio hecho en `apps/web` puede publicarse en Internet y también sincronizarse con iPhone, iPad y Mac.

## Para actualizar la app Apple

Ejecutar:

`bash ./00_ACTUALIZAR_WEB_Y_APP.command`

Luego, en Xcode, presionar `Command + R`.

## Para publicar la versión web

Ejecutar:

`bash ./01_PUBLICAR_WEB.command`

## Para probar la web sin publicar

Ejecutar:

`bash ./02_ABRIR_WEB_LOCAL.command`

## Base de datos

La app y la web deben apuntar al mismo proyecto de Supabase. De esa forma, los datos cargados desde el teléfono aparecen en la web y viceversa.

Antes de cargar información real, ejecutar una sola vez en Supabase:

`00_SQL_ACTIVAR_CARGA_REAL_SUPABASE.sql`

## Seguridad

No guardar tokens de Vercel, claves service_role ni otras credenciales privadas dentro del proyecto. La clave anon/publishable de Supabase puede usarse en el cliente siempre que las políticas RLS estén correctamente configuradas.
