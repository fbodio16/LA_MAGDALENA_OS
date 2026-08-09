# LA MAGDALENA OS v92.0.2 — Release Candidate Estable

## Corrección crítica
- Restaurada la lectura de las 13 válvulas del Motor Hídrico canónico.
- `app.js` y `hydric-intelligence/index.js` ahora importan **la misma instancia** de `hydric-state.js` con la misma clave de versión (`v=92.0.2`).
- Se elimina la duplicación de módulos ES que provocaba que el proveedor hídrico se registrara en una instancia y la pantalla consultara otra, dejando `0/13` y “Datos incompletos”.

## Conservado de v92
- Auditoría visual limpia del historial.
- No registra eventos sin cambio porcentual ni de estado.
- Mejoras de trazabilidad, predicción y presentación.
- El cálculo hídrico canónico no fue alterado por esta corrección.

## Regla de estabilidad
Todos los consumidores de `services/hydric-state.js` deben usar exactamente la misma URL de importación para compartir el singleton del proveedor y del estado canónico.
