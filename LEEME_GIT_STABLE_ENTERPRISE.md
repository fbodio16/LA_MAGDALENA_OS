# LA MAGDALENA OS — Git profesional

## Estructura
- `stable`: versión de producción. Base actual: v92.1.0 FINAL.
- `enterprise`: desarrollo de LA MAGDALENA OS v100.
- Tag `v92.1.0`: copia inmutable para volver atrás.

## Primera vez
Hacer doble clic en `00_CONFIGURAR_GIT_GITHUB.command`.

El asistente local:
1. inicializa Git;
2. guarda la v92.1.0;
3. crea `stable`;
4. crea `enterprise`;
5. crea el tag `v92.1.0`;
6. opcionalmente conecta y sube a GitHub.

## Desarrollo
Usar `01_TRABAJAR_ENTERPRISE.command` antes de agregar nuevas funciones.

## Producción
Usar `02_VOLVER_A_STABLE.command` para volver a producción.
`03_PUBLICAR_STABLE_VERCEL.command` se niega a publicar si no estás en `stable` o hay cambios sin guardar.
