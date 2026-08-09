# LA MAGDALENA OS v75.0.0 — Operativo inmediato

- Base recuperada desde v72, última versión validada con los 13 porcentajes visibles.
- El motor no borra un porcentaje válido cuando una fuente temporalmente falta.
- Tres niveles: DECISIÓN HABILITADA, DECISIÓN PROVISIONAL · VERIFICAR y DATOS INSUFICIENTES.
- La caché estable sólo se actualiza con porcentajes válidos; un lote incompleto no borra los demás.
- Las decisiones provisionales no deben ejecutarse sin verificación de campo cuando falte ET0, muestra, caudal o lámina exacta.
