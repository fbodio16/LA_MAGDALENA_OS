# LA MAGDALENA OS 11.0.0

Gestión comercial integrada para ventas, stock y cobranzas.

# LA MAGDALENA OS 1.8.0 · Alfalfa Enterprise

La versión estable incorpora gestión integral de producción de alfalfa, costos, stock, ventas, margen y proyección anual.

# LA MAGDALENA OS

Repositorio unificado de la aplicación móvil Expo, la web pública y el esquema Supabase.

## Estructura

- `apps/mobile`: aplicación Expo para iPhone/Android.
- `apps/web`: web estática desplegable en Vercel.
- `supabase`: esquema inicial de base de datos.
- `docs`: KML y GeoJSON reales de La Magdalena.

## Ejecutar la app móvil

```bash
cd apps/mobile
npm install
npx expo start --clear
```

## Ejecutar la web local

```bash
cd apps/web
python3 -m http.server 8080
```

Abrir `http://localhost:8080`.

## Publicar una actualización web

```bash
cd apps/web
npx vercel --prod
```

La primera vez, Vercel pedirá iniciar sesión y vincular el proyecto `la-magdalena-os`.

## Supabase

La base ya está preparada. No ejecutar nuevamente `001_initial_schema.sql` sobre la base en producción salvo que se quiera reiniciar el esquema y se comprenda el impacto.

## Estado verificado

- No existe ninguna referencia a `numberAR` en `apps/mobile/App.js`.
- La sintaxis de `App.js` fue verificada con Node.
- La web contiene `index.html`, `vercel.json`, manifiesto y service worker.


## Versión 7.2.2
Frontend consolidado y mecanismo de actualización de caché para producción en Vercel.
