# Phase 0 — Research: Match Screen UI base

**Feature**: 006-match-screen-ui · **Fecha**: 2026-05-25

Resolución de los puntos de decisión técnica del plan. No quedan `NEEDS CLARIFICATION`.

---

## D1 — Mecanismo de selección de fixture en la ruta

**Decisión**: Query param de la ruta — `?fixture=viewer-player-one|viewer-player-two|empty-table|asymmetric-hand`.
Default: `viewer-player-one`.

**Rationale**:
- FR-019 pide que cambiar de fixture no requiera recompilar y que la UI no necesite
  selector visible.
- Query param es leído trivialmente con `ActivatedRoute.queryParamMap` y reactivo a navegación.
- Un valor desconocido cae silenciosamente al default (no es un path de error del producto).

**Alternativas consideradas**:
- **Service inyectable con DI override en tests**: agrega ceremonia (provider en
  `app.config.ts`) sin valor para esta etapa.
- **Variable de entorno** (`environment.matchFixture`): requiere build y no permite probar
  varios escenarios en la misma sesión.
- **Path param `/match/:fixture`**: contamina la URL definitiva; cuando se integre el BE la
  ruta será `/match/:matchId`, y `:matchId` no debe colisionar con nombres de fixture.

---

## D2 — Datos mock: sync signal vs Observable

**Decisión**: Valor síncrono envuelto en `signal<MatchState>()` dentro de `MatchScreen`.
El módulo de fixtures exporta valores constantes (`as const satisfies MatchState`); el
componente resuelve el fixture activo en `ngOnInit` (o vía `computed()` sobre query params)
y hace `signal.set(fixture)`.

**Rationale**:
- La feature ya consume sin async (es estática), no tiene sentido envolver en `of(...)`.
- Usar `signal` (y no propiedad cruda) deja la API de los componentes preparada para
  reemplazar el provider por `toSignal(http.get<MatchState>(...))` sin tocar templates.
- Mantener `MatchState` como tipo de entrada hace trivial el swap.

**Alternativas consideradas**:
- **Observable + `async` pipe**: innecesario para datos estáticos; agrega `*ngIf` y nullable
  donde no aplica.
- **Resolver de ruta que devuelve el fixture**: agrega indirección sin ganar nada — la
  selección de fixture es trivial y no bloquea el render.

---

## D3 — ¿Extender `MatchState` existente o crear tipo de vista local?

**Decisión**: Extender `MatchState` en `src/app/core/models/match.models.ts` con los 4
campos nuevos del contrato (`viewerSeat`, `playerOneUsername`, `playerTwoUsername`,
`gamesToPlay`). Mantener los nombres exactos del contrato. No crear alias.

**Rationale**:
- El contrato §4.14 ya documenta esos campos como parte del payload real del BE.
- Crear un tipo local de presentación duplicaría la verdad y forzaría un mapper innecesario
  cuando se integre el endpoint.
- La derivación viewer-relative se hace en una función pura (`deriveMatchView`), no en el
  tipo — separación correcta de responsabilidades.

**Alternativas consideradas**:
- **Nuevo tipo `MatchViewModel`** en la feature: sólo agrega trabajo de mapeo a futuro y
  rompe el principio de "el mock debe tener la forma exacta del contrato" (FR-010).
- **Extender en la feature** (interface merging local): rompe la fuente única en `core/models`.

**Impacto**:
- Los lugares que hoy construyen un `MatchState` (no hay ninguno productivo todavía —
  sólo definiciones) quedan obligados a aportar los nuevos campos. No hay call sites a
  romper.

---

## D4 — Derivación viewer-relative (FR-018)

**Decisión**: Función pura `deriveMatchView(state: MatchState): MatchView` con la forma:

```ts
interface SeatView {
  username: string;
  score: number;             // del game actual (0..3)
  gamesWon: number;          // partidas ganadas en la serie
  handCards: Card[] | null;  // null si no se conoce (caso del oponente)
  handCount: number;         // cuántas cartas tiene en mano (para pintar dorsos)
  playedInCurrentHand: Card | null;
  playedInPreviousHands: (Card | null)[]; // alineado a playedHands.length
}

interface MatchView {
  matchId: string;
  status: MatchStatus;
  gamesToPlay: 1 | 3 | 5;
  seriesLabel: 'Mejor de 1' | 'Mejor de 3' | 'Mejor de 5';
  self: SeatView;
  opponent: SeatView;
  currentTurnIsSelf: boolean | null; // null si roundGame es null
  roundStatus: RoundStatus | null;
  playedHandsCount: number;
}
```

**Rationale**:
- Los componentes (`PlayerArea`, `OpponentArea`, `PlayedCardsArea`, `MatchStatusPanel`)
  consumen `self`/`opponent` directamente. No tocan `PLAYER_ONE/PLAYER_TWO` en ningún lugar.
- Single source of truth para "qué cartas en mano tiene el rival" — derivado de cuántas
  jugó en la mano actual y en `playedHands`, NO del array `myCards` (que es del jugador
  autenticado).
- El cálculo de `handCount` del rival es `3 - (jugadas en playedHands del oponente) -
  (1 si el oponente jugó en currentHand else 0)`. Se prueba en `derive-match-view.spec.ts`
  con los 4 fixtures.

**Alternativas consideradas**:
- **Pasar `state + viewerSeat` a cada componente** y dejar que cada uno reorderea: viola
  DRY y dispersa la lógica viewer-relative.
- **Pipe `viewerRelative`**: rompe el patrón funcional puro y dificulta el testing.

---

## D5 — Derivación del texto de estado (FR-006)

**Decisión**: Función pura `deriveStatusText(state: MatchState): string`. Reglas:

1. Si `state.status !== 'IN_PROGRESS'` o `state.roundGame == null` → `'Esperando inicio'`.
2. Si `roundGame.roundStatus === 'FINISHED'` → `'Fin de la mano'`.
3. Si `roundGame.currentTurn === self.username` → `'Tu turno · Mano ${n} de 3'`.
4. Si `roundGame.currentTurn === opponent.username` → `'Turno de ${opponent.username} · Mano ${n} de 3'`.
5. Si `currentTurn == null` → `'Mano ${n} de 3'`.

donde `n = clamp(playedHands.length + 1, 1, 3)`.

**Rationale**:
- Toda la copy queda en una función. Cambiar tono/idioma es un solo archivo.
- Pura → 100% testeable sin componente.

**Alternativas consideradas**:
- **Agregar `statusText` al mock/contrato**: contradice la clarification del spec
  (acordada explícitamente: NO viene del BE).
- **Pipe Angular**: pierde la facilidad de testear con vitest puro.

---

## D6 — Estructura visual y tokens CSS necesarios

**Decisión**: Reutilizar tokens existentes en lo posible. Posibles tokens nuevos a
introducir en `src/styles.scss` si la implementación los requiere:

| Token candidato | Propósito |
|---|---|
| `--t3-table-felt` | Verde paño de la mesa (más oscuro/saturado que `--t3-bg-deep`) |
| `--t3-card-slot-border` | Borde punteado dorado tenue de slot vacío de carta |
| `--t3-card-shadow` | Sombra de carta jugada sobre la mesa (más sutil que `--t3-shadow-card`) |
| `--t3-score-text` | Color del marcador grande (puede mapear a `--t3-text`) |

La decisión final de cuáles agregar se toma durante la implementación de Phase 2; el
principio es: si una propiedad SCSS de feature necesita un literal nuevo, primero se
introduce el token en `src/styles.scss`.

**Rationale**: Constitution I y feedback de `design_system_standards.md` lo exigen.

---

## D7 — Imágenes de cartas

**Decisión**: Cargar desde `/cards/{number}_{suitLower}.png` y `/cards/dorso.png` usando el
patrón ya existente del proyecto. El `suit` viene en mayúsculas del contrato
(`ESPADA|COPA|BASTO|ORO`); se transforma a minúscula sólo para construir la URL.

**Helper**: `buildCardImageUrl(card: Card | null): string` en `card-view.component.ts`.

**Rationale**: Las imágenes ya existen en `public/cards/`. No se introduce nuevo asset
pipeline.

---

## D8 — Routing

**Decisión**: Agregar ruta lazy:

```ts
{
  path: 'match',
  canMatch: [authGuard],
  loadComponent: () =>
    import('./features/match/pages/match-screen/match-screen.component').then(
      (m) => m.MatchScreenComponent,
    ),
}
```

Sin `:matchId` por ahora — la integración futura agregará `'match/:matchId'`. Si llega un
path param hoy, Angular lo ignora; query params (`?fixture=...`) sí se leen.

**Rationale**: Minimizar cambios en el routing. Cuando se integre el BE, agregar el param
es trivial.

---

## D9 — Test de contrato

**Decisión**: `src/tests/contract/match-state-shape.contract.spec.ts` valida con
`satisfies` que **cada uno de los 4 fixtures** named cumple la forma de `MatchState`
extendido. Además, parsea `docs/CONTRATOS_API.md §4.14` con un regex simple y confirma que
los campos top-level documentados están presentes en el tipo TypeScript.

**Rationale**: Consistente con el guardarraíl existente para
`CreateBotMatchRequest`/`Response`. Falla rápido si el BE cambia el contrato sin que el
front se entere.

---

## Resumen de archivos a crear / modificar en Phase 2 (referencia, no se ejecuta acá)

- **Crear** 9 componentes standalone, 1 módulo de fixtures, 2 funciones puras + tests.
- **Modificar** `app.routes.ts`, `core/models/match.models.ts`, `src/styles.scss`
  (sólo si hace falta token nuevo).
- **Crear** test de contrato.
