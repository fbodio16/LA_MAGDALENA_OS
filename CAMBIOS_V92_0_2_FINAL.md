# LA MAGDALENA OS v92.0.2 FINAL

- No modifica el porcentaje canónico, decisiones, lámina, volumen ni duración.
- Corrige la interpretación de ETc: `x.etc` es acumulada desde la muestra, no consumo diario.
- El consumo diario se calcula como ET₀ diaria × Kc vigente.
- La interfaz diferencia explícitamente ET₀ diaria (mm/día) de ETc acumulada (mm).
- Simulador, riesgo y reconstrucción hídrica usan demanda diaria, no ETc acumulada.
