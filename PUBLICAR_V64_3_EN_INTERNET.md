# Publicar LA MAGDALENA OS v64.3.0

## Publicación inicial

1. Hacé doble clic en `03_PUBLICAR_EN_INTERNET.command`.
2. Iniciá sesión en Vercel cuando se abra el navegador.
3. Aceptá crear un proyecto nuevo cuando la Terminal lo solicite.
4. Al finalizar, copiá la dirección `https://...vercel.app`.

La publicación usa `apps/web` como raíz del sitio. La base de datos continúa siendo Supabase; no se copian ni borran registros.

## Configuración necesaria en Supabase

Cuando tengas la dirección pública:

1. Abrí Supabase.
2. Entrá en **Authentication > URL Configuration**.
3. Colocá la dirección pública en **Site URL**.
4. Agregá también estas redirecciones:
   - `https://TU-DOMINIO.vercel.app/**`
   - `http://localhost:8080/**`

Esto permite iniciar sesión tanto en Internet como durante las pruebas locales.

## Actualizaciones futuras

Desde la carpeta del proyecto podés volver a ejecutar:

```bash
npx --yes vercel@latest --prod --cwd apps/web
```

Vercel publicará la actualización sobre el mismo proyecto vinculado.
