# LA MAGDALENA OS 3.1.0 — Seguridad SaaS

## Aplicación en Supabase

1. Abrir el proyecto `la-magdalena-os` en Supabase.
2. Entrar en **SQL Editor**.
3. Crear una consulta nueva.
4. Copiar todo el contenido de `supabase/002_security_saas_roles.sql`.
5. Presionar **Run**.
6. Confirmar que el resultado diga: `roles y RLS aplicados`.

La migración no borra empresas, lotes, cortes, riegos ni usuarios.

## Roles

- **Superadministrador:** control total de plataforma y empresas.
- **Administrador:** gestiona usuarios, configuración y todos los datos de su empresa.
- **Encargado:** opera campo y puede administrar finanzas, sin gestionar membresías.
- **Operario:** carga producción, riego, vuelos, geometrías y órdenes; no elimina ni administra usuarios.
- **Asesor:** consulta información técnica sin modificarla.
- **Cliente:** acceso de consulta al portal y datos autorizados.

## Importante

La creación o invitación de usuarios no debe hacerse con una clave administrativa dentro del navegador. Se incorporará en una siguiente etapa mediante una función segura del servidor.
