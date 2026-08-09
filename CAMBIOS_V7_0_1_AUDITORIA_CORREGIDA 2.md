# LA MAGDALENA OS 7.0.1

- Reemplaza la migración de auditoría por una versión limpia e idempotente.
- Evita errores cuando `company_members` aún no existe.
- Crea o renueva los triggers solamente en tablas existentes.
- Incluye una consulta final de verificación.
- No elimina datos operativos.
