# Publicar LA MAGDALENA OS en Internet

## Publicación inicial

1. Hacé doble clic en `03_PUBLICAR_EN_INTERNET.command`.
2. En la primera ejecución, Vercel solicitará iniciar sesión o crear una cuenta.
3. Aceptá los valores sugeridos por Vercel para publicar `apps/web`.
4. Al finalizar, el comando abrirá la URL pública y guardará una copia en `URL_PUBLICA.txt`.

## Configuración obligatoria en Supabase

En **Authentication → URL Configuration** configurá:

- **Site URL:** la URL pública terminada en `.vercel.app`.
- **Redirect URLs:** la misma URL agregando `/**`.

Esto permite que confirmaciones de correo y recuperación de contraseña regresen correctamente a la aplicación publicada.

## Actualizaciones futuras

Después de modificar el proyecto, ejecutá nuevamente:

`03_PUBLICAR_EN_INTERNET.command`

Vercel actualizará la misma aplicación vinculada.

## Dominio propio

Más adelante podés conectar un dominio como `app.lamagdalenaos.com` desde el panel del proyecto en Vercel. Después hay que reemplazar la Site URL de Supabase por el dominio definitivo y conservar la URL de Vercel dentro de Redirect URLs para pruebas.
