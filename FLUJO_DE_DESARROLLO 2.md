# Flujo de desarrollo — LA MAGDALENA OS

## Base estable

La versión `1.6.6` es el punto de partida estable. No se desarrollan funciones nuevas directamente sobre `main`.

## Primera configuración

1. Ejecutar `00_PREPARAR_DESARROLLO.command`.
2. El comando inicializa Git, crea la rama `main` y registra el primer commit.
3. Abrir el proyecto mediante `02_ABRIR_EN_VSCODE.command`.

## Trabajo por módulo

Crear una rama antes de modificar código:

```bash
git switch -c feature/gis-lotes
```

Probar la aplicación:

```bash
npm run web:start
```

Validar sintaxis:

```bash
npm run check:web
```

Guardar una entrega:

```bash
git add .
git commit -m "feat(gis): agregar ficha operativa de lote"
```

Volver a la versión estable:

```bash
git switch main
```

## Próximo desarrollo

La primera rama recomendada es `feature/gis-lotes`, con este alcance:

- seleccionar un lote desde su polígono;
- mostrar su ficha operativa vinculada a Supabase;
- abrir Producción, Riego, Vuelos y Órdenes T100 con el lote preseleccionado;
- guardar y editar geometrías sin duplicarlas;
- mantener el Dashboard y la autenticación sin cambios regresivos.
