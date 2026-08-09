# Instalar LA MAGDALENA OS V33

## Publicar la web

```bash
cd apps/web
npx vercel --prod
```

La V33 utiliza las tablas `satellite_observations` y `satellite_sync_runs` ya instaladas, además de la Edge Function `satellite-sync` V32.

Al ingresar, abrir **🗺 Inteligencia Satelital** en el menú lateral.

## Archivos principales incorporados

- `apps/web/js/modules/satellite-center.js`
- `apps/web/css/modules/satellite-center.css`
- actualización de `apps/web/js/app.js`
- actualización de `apps/web/index.html`
