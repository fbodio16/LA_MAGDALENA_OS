# LA MAGDALENA OS v67.0.0

## Motor hídrico canónico

- Se incorporó `apps/web/js/services/hydric-state.js` como almacén único del estado por válvula.
- Inicio Premium, Riego e Inteligencia Hídrica consumen la misma instantánea.
- Después de cada carga desde Supabase se invalida la instantánea y el siguiente módulo reconstruye exactamente el mismo estado.
- Se eliminaron caches paralelos dentro del módulo hídrico.
- El servicio expone `getHydricState`, `getHydricRows` y `getHydricValve`.
- No incluye migraciones destructivas ni modifica registros existentes.
