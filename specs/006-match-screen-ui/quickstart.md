# Quickstart — Match Screen UI base (006)

## Correr la pantalla en local

```bash
pnpm install   # si todavía no
pnpm start     # http://localhost:4200
```

1. Iniciar sesión por `/login` (cualquier credencial válida del flujo existente).
2. Navegar a `http://localhost:4200/match`.

## Probar fixtures

| URL | Escenario | Qué valida |
|---|---|---|
| `/match` o `/match?fixture=viewer-player-one` | Default. Viewer es `PLAYER_ONE`, mid-game, score 1–0, 1 mano jugada. | Render base (US1, US2). |
| `/match?fixture=viewer-player-two` | Viewer es `PLAYER_TWO`, mismos datos espejados. | FR-018: la vista del jugador 2 es **visualmente idéntica** a la del jugador 1 (mano propia abajo, rival arriba) — sólo cambian usernames y cartas. |
| `/match?fixture=empty-table` | Sin cartas jugadas, `currentHand` vacía, `gamesToPlay: 1`. | Edge case "sin cartas jugadas todavía" + etiqueta "Mejor de 1". |
| `/match?fixture=asymmetric-hand` | El viewer puso carta, el oponente todavía no, `gamesToPlay: 5`. | Edge case "cartas jugadas asimétricas" + etiqueta "Mejor de 5". |
| `/match?fixture=does-not-exist` | Key desconocido. | Fallback silencioso al default (sin error UI). |

## Comprobaciones rápidas

- **Mobile 360 px** (DevTools, modo dispositivo): todas las zonas (cabecera, rival, mesa,
  mano, panel de estado, placeholder de acciones) caben sin scroll vertical involuntario y
  sin scroll horizontal.
- **Desktop ≥ 1024 px**: la mesa no se estira a full width; queda centrada con márgenes.
- **Nombres largos**: cambiar manualmente un fixture para meter `playerOneUsername:
  'a_very_long_username_xyz'` y verificar truncado con elipsis sin romper la cabecera.
- **Imágenes de cartas**: ninguna 404 en consola — todas resuelven contra
  `/cards/{n}_{palo}.png` o `/cards/dorso.png`.

## Comandos de verificación

```bash
pnpm lint:styles          # cero hex en src/app/features/match/**/*.scss
pnpm lint:themes          # cero mat-flat-button / color="primary|accent|warn"
pnpm lint                 # ESLint TS/HTML
pnpm test                 # incluye:
                          #   - derive-match-view.spec.ts
                          #   - derive-status-text.spec.ts
                          #   - card-view.component.spec.ts
                          #   - match-screen.component.spec.ts
                          #   - tests/contract/match-state-shape.contract.spec.ts
pnpm build                # build de producción sin warnings nuevos
```

## Lo que NO se valida acá (queda para iteraciones siguientes)

- Interactividad (jugar carta, cantar truco/envido, ir al mazo).
- Integración HTTP (`GET /api/matches/{matchId}`).
- Suscripción WebSocket a `/user/queue/match`.
- Animaciones de carta.
- Accesibilidad WAI-ARIA exhaustiva (sólo se garantiza que los textos clave son leíbles
  por screen reader, no embebidos en imágenes).
