# LA MAGDALENA OS v75.0.0 — Enterprise Hídrico Auditable

## Cambios principales

- Motor hídrico canónico único para Inicio Premium, Centro Inteligente de Riego e Historial de Riegos.
- Protección del último cálculo válido mientras cargan Supabase, clima, satélite o muestras.
- Historial causal por válvula: porcentaje anterior, porcentaje nuevo, delta, fecha, motivo y fuentes.
- Explicación automática de por qué cambió cada porcentaje.
- LM AI consulta el mismo motor canónico para responder preguntas de riego.
- La ficha del gemelo hídrico muestra el historial del porcentaje canónico además del historial operativo.
- Auditoría de 13/13 válvulas y detección de duplicados o lotes sin identificador.
- No se agregan migraciones destructivas ni se eliminan registros de Supabase.

## Regla de seguridad agronómica

Un salto mayor a 25 puntos porcentuales se conserva en el último valor válido cuando no existe nueva evidencia (riego, lluvia, muestra, satélite o cambio de ET).
