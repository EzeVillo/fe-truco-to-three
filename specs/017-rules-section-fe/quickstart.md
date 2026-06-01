# Quickstart: Sección de reglas de variante

## Objetivo

Validar que el lobby ofrece un CTA hacia `/lobby/reglas` y que el contenido de esa página
coincide con `docs/REGLAS_VARIANTE.md`.

## Pasos de implementación

1. Crear `src/app/features/lobby/models/variant-rules.ts` con la colección local de reglas.
2. Crear `src/app/features/lobby/components/rules-section/` como componente standalone presentacional.
3. Crear `src/app/features/lobby/pages/rules-page/` como página dedicada.
4. Agregar el CTA de reglas en `LobbyPageComponent`.
5. Agregar la ruta `/lobby/reglas`.
6. Ajustar estilos usando solo tokens `var(--t3-...)`.
7. Agregar tests de componente, página y navegación desde lobby.

## Validación manual

1. Ejecutar `pnpm start`.
2. Abrir `http://localhost:4200/lobby`.
3. Usar el CTA "Reglas de la variante" para navegar a `/lobby/reglas`.
4. Verificar que la página muestra:
   - punto exacto a `3`;
   - Falta envido;
   - "quiero y me voy al mazo";
   - cierre por ancho de espada;
   - restricción del jugador mano para irse al mazo.
5. Confirmar que no aparece el bloque visual "Claves".
6. Revisar mobile desde `360 px` y desktop desde `1024 px`.

## Comandos de verificación

```bash
pnpm lint
pnpm lint:styles
pnpm lint:themes
pnpm test
pnpm build
```

## Criterio de finalización

La feature está lista cuando el CTA del lobby lleva a `/lobby/reglas`, la página cubre el 100% de
`docs/REGLAS_VARIANTE.md`, no muestra "Claves" y todos los comandos de verificación pasan.
