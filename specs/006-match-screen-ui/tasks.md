---

description: "Task list template for feature implementation"

---

# Tasks: Match Screen — UI base con datos mock (006-match-screen-ui)

**Input**: Design documents from `/specs/006-match-screen-ui/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are included as explicitly requested in the feature specification (plan.md Technical Context + data-model.md §6).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

> **Guardarraíles del proyecto** — verificar en cada tarea relevante:
> - **Tokens CSS**: SCSS de feature → solo `var(--t3-…)`. Correr `pnpm lint:styles` después de cambiar estilos.
> - **Contrato de endpoints**: verificar campos contra `docs/CONTRATOS_API.md` antes de tipar un DTO. `gamesToPlay ∈ {1,3,5}`.
> - **CTAs verticales**: título + descripción en spans separados, `flex-direction: column`, no `mat-flat-button`.
> - **Copy de errores**: usar `getErrorCopy()`, nunca `ApiError.message` crudo en la UI.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Paths shown below assume single project per plan.md structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare feature scaffolding and routing for the match screen.

- [X] T001 [P] Create `src/app/features/match/` directory with `pages/`, `components/`, `mocks/`, `utils/` subdirectories
- [X] T002 [P] Add lazy route `match` in `src/app/app.routes.ts` protected by `authGuard` loading `MatchScreenComponent`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types, mocks, pure functions, and base component that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Extend `MatchState` interface in `src/app/core/models/match.models.ts` adding `ViewerSeat` type and fields `viewerSeat`, `playerOneUsername`, `playerTwoUsername`, `gamesToPlay`
- [X] T004 [P] Create mock fixtures in `src/app/features/match/mocks/match-state.mocks.ts` (`mockMatchViewerPlayerOne`, `mockMatchViewerPlayerTwo`, `mockMatchEmptyTable`, `mockMatchAsymmetricHand`) all typed as `MatchState`
- [X] T005 Create `src/app/features/match/mocks/index.ts` exporting `FixtureKey`, `DEFAULT_FIXTURE`, and `getFixture(key)` lookup function
- [X] T006 [P] Implement `deriveMatchView()` in `src/app/features/match/utils/derive-match-view.ts` with `SeatView` and `MatchView` interfaces
- [X] T007 [P] Implement `deriveStatusText()` in `src/app/features/match/utils/derive-status-text.ts` deriving status text from `currentTurn`, `roundStatus`, `playedHands`, `viewerSeat`, and usernames
- [X] T008 [P] Create `CardViewComponent` in `src/app/features/match/components/card-view/card-view.component.ts` supporting visible (`number` + `suit`) and hidden (`dorso.png`) rendering modes
- [X] T009 Create contract test `src/tests/contract/match-state-shape.contract.spec.ts` validating each fixture satisfies `MatchState` and contains all top-level keys
- [X] T010 Create `src/app/features/match/utils/derive-match-view.spec.ts` testing viewer-relative symmetry, score mapping, and hand counts across all 4 fixtures
- [X] T011 Create `src/app/features/match/utils/derive-status-text.spec.ts` testing all status/turn/hand combinations
- [X] T012 Create `src/app/features/match/components/card-view/card-view.component.spec.ts` testing visible card image URL and hidden card `dorso.png` render

**Checkpoint**: Foundation ready — types, mocks, pure functions, base component, and contract tests pass. User story implementation can now begin.

---

## Phase 3: User Story 1 — Visualizar el tablero base de una partida en curso (Priority: P1)

**Goal**: Render the complete match board with all visual zones driven by mock data: header with score/series, opponent area top, played cards center, player hand bottom, and status panel.

**Independent Test**: Navigate to `http://localhost:4200/match` (default fixture). The screen simultaneously shows: opponent name with face-down cards, played cards area, visible player hand, score, and turn text. Switch to `?fixture=viewer-player-two` to confirm viewer-relative layout (self always bottom, opponent always top).

### Tests for User Story 1

> **NOTE: These tests validate component logic and integration with mocks.**

- [X] T020 [US1] Create `src/app/features/match/pages/match-screen/match-screen.component.spec.ts` testing query-param fixture selection and fallback to default

### Implementation for User Story 1

- [X] T013 [P] [US1] Create `MatchStatusPanelComponent` in `src/app/features/match/components/match-status-panel/match-status-panel.component.ts` displaying score, series label, and turn text from `MatchView`
- [X] T014 [P] [US1] Create `OpponentAreaComponent` in `src/app/features/match/components/opponent-area/opponent-area.component.ts` showing opponent username and face-down cards via `CardView`
- [X] T015 [P] [US1] Create `PlayerHandComponent` in `src/app/features/match/components/player-hand/player-hand.component.ts` rendering visible player cards via `CardView`
- [X] T016 [P] [US1] Create `PlayedCardsAreaComponent` in `src/app/features/match/components/played-cards-area/played-cards-area.component.ts` rendering played cards from previous and current hand via `CardView`
- [X] T017 [US1] Create `PlayerAreaComponent` in `src/app/features/match/components/player-area/player-area.component.ts` showing player username and integrating `PlayerHand`
- [X] T018 [US1] Create `GameBoardComponent` in `src/app/features/match/components/game-board/game-board.component.ts` composing `OpponentArea`, `PlayedCardsArea`, `PlayerArea`, and `MatchStatusPanel`
- [X] T019 [US1] Create `MatchScreenComponent` in `src/app/features/match/pages/match-screen/match-screen.component.ts` selecting fixture from `ActivatedRoute` query params and binding `deriveMatchView`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. The match board renders correctly with all four fixtures.

---

## Phase 4: User Story 2 — Reconocer instantáneamente la identidad visual del producto (Priority: P2)

**Goal**: Ensure the screen matches the reference image (`public/referencias/match.png`) and uses exclusively design tokens, with proper responsive behavior on desktop.

**Independent Test**: Side-by-side comparison with `public/referencias/match.png` shows clear match in layout, colors, and proportions. `pnpm lint:styles` and `pnpm lint:themes` pass with zero violations. Desktop viewport (≥ 1024 px) centers the board without stretching to full width.

### Implementation for User Story 2

- [X] T021 [P] [US2] Add `--t3-table-felt`, `--t3-card-slot-border`, and `--t3-card-shadow` CSS custom properties to `src/styles.scss`
- [X] T022 [P] [US2] Style `game-board.component.scss` using only `var(--t3-…)` tokens for flex column layout: opponent area top, played cards center, player area bottom
- [X] T023 [P] [US2] Style `opponent-area.component.scss` using only `var(--t3-…)` tokens with opponent name ellipsis truncation and face-down card grid layout
- [X] T024 [P] [US2] Style `player-area.component.scss` using only `var(--t3-…)` tokens with player name ellipsis truncation and hand slot layout
- [X] T025 [P] [US2] Style `played-cards-area.component.scss` using only `var(--t3-…)` tokens with table felt background and subtle empty card slot dotted borders
- [X] T026 [P] [US2] Style `player-hand.component.scss` using only `var(--t3-…)` tokens ensuring three cards fit in a single row at 360 px width without overlap or horizontal scroll
- [X] T027 [P] [US2] Style `match-status-panel.component.scss` using only `var(--t3-…)` tokens for score typography, series label, and status text hierarchy
- [X] T028 [P] [US2] Style `card-view.component.scss` using only `var(--t3-…)` tokens for card shadow and fixed aspect ratio sizing
- [X] T029 [US2] Add responsive desktop breakpoint `@media (min-width: 1024px)` to `match-screen.component.scss` centering the board with `max-width` and generous side margins

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently. The screen is visually polished and consistent with the product design system.

---

## Phase 5: User Story 3 — Tener un placeholder visible para futuras acciones disponibles (Priority: P3)

**Goal**: Reserve a visible, documented zone near the player's hand for future action buttons (truco, envido, mazo, etc.).

**Independent Test**: The screen shows an identifiable container positioned near the player's hand with a neutral placeholder label. No functional buttons are rendered. The component file contains a clear code comment marking it as the extension point for actions.

### Implementation for User Story 3

- [X] T030 [P] [US3] Create `PlaceholderAvailableActionsAreaComponent` in `src/app/features/match/components/placeholder-available-actions-area/placeholder-available-actions-area.component.ts` as a visual container with placeholder label
- [X] T031 [US3] Integrate `PlaceholderAvailableActionsAreaComponent` into `src/app/features/match/components/game-board/game-board.component.html` positioned near the player hand area
- [X] T032 [US3] Add JSDoc/inline comment in `placeholder-available-actions-area.component.ts` documenting it as the future extension point for playable actions (truco, envido, mazo, etc.)

**Checkpoint**: All user stories should now be independently functional. The layout is future-proofed for the action panel.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, linting, build verification, and agent context update.

- [X] T033 [P] Run `pnpm lint` and fix ESLint/Prettier violations across all new match feature files
- [X] T034 [P] Run `pnpm test` and fix failures in match feature unit and contract tests
- [X] T035 Run `pnpm build` and verify no new production build warnings from match feature
- [X] T036 Update `CLAUDE.md` `<!-- SPECKIT START -->` block to reference `specs/006-match-screen-ui/plan.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion. T003 blocks T004, T006, T007. T004 blocks T005 and T009. T006 blocks T010. T007 blocks T011. T008 blocks T012. **BLOCKS all user stories.**
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion (T003–T012). T013–T016 can run in parallel. T017 depends on T015. T018 depends on T013, T014, T016, T017. T019 depends on T018, T005, T006. T020 depends on T019.
- **User Story 2 (Phase 4)**: Depends on User Story 1 completion (T013–T020). All styling tasks (T021–T029) are parallelizable.
- **User Story 3 (Phase 5)**: Depends on User Story 1 completion (T018). T030 is parallelizable; T031 depends on T030.
- **Polish (Final Phase)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2). No dependencies on other stories. This is the **MVP**.
- **User Story 2 (P2)**: Can start after User Story 1 (Phase 3). Requires all components to exist so their SCSS can be themed.
- **User Story 3 (P3)**: Can start after User Story 1 (Phase 3). Integrates with `GameBoardComponent` but is independently testable.

### Within Each User Story

- Tests for a story MUST be written alongside or immediately after implementation.
- Models / pure functions before components.
- Leaf components (CardView, PlayerHand) before container components (PlayerArea, GameBoard).
- Page component (`MatchScreen`) last, after all children and mocks are ready.
- Story complete before moving to next priority.

### Parallel Opportunities

- **Phase 1**: T001 and T002 can run in parallel.
- **Phase 2** (after T003 completes): T004, T006, T007, T008 can run in parallel. After T004 completes, T005 and T009 can join the parallel batch.
- **Phase 2 tests** (after implementations): T010, T011, T012 can run in parallel.
- **Phase 3** (after Phase 2): T013, T014, T015, T016 can run in parallel. After T015 completes, T017 can run in parallel with the remaining Phase 3 tasks.
- **Phase 4** (after Phase 3): T021, T022, T023, T024, T025, T026, T027, T028 can all run in parallel.
- **Phase 5** (after Phase 3): T030 is parallelizable; T031 depends on it.
- **Phase 6**: T033 and T034 can run in parallel.

---

## Parallel Example: User Story 1

```bash
# Launch all leaf components together:
Task: "Create MatchStatusPanelComponent in src/app/features/match/components/match-status-panel/match-status-panel.component.ts"
Task: "Create OpponentAreaComponent in src/app/features/match/components/opponent-area/opponent-area.component.ts"
Task: "Create PlayerHandComponent in src/app/features/match/components/player-hand/player-hand.component.ts"
Task: "Create PlayedCardsAreaComponent in src/app/features/match/components/played-cards-area/played-cards-area.component.ts"

# Then compose containers:
Task: "Create PlayerAreaComponent in src/app/features/match/components/player-area/player-area.component.ts"
Task: "Create GameBoardComponent in src/app/features/match/components/game-board/game-board.component.ts"
Task: "Create MatchScreenComponent in src/app/features/match/pages/match-screen/match-screen.component.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational — types, mocks, pure functions, CardView, and tests.
3. Complete Phase 3: User Story 1 — build the full match board with all components and mock data.
4. **STOP and VALIDATE**: Run `pnpm test`, `pnpm lint:styles`, `pnpm lint:themes`, and manual browser check against `public/referencias/match.png`.
5. Deploy/demo if ready.

### Incremental Delivery

1. Setup + Foundational → Foundation ready.
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!).
3. Add User Story 2 → Polish all SCSS with tokens and responsive desktop layout → Test independently → Deploy/Demo.
4. Add User Story 3 → Add placeholder action area → Test independently → Deploy/Demo.
5. Each story adds value without breaking previous stories.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together.
2. Once Foundational is done:
   - **Developer A**: User Story 1 (T013–T020)
   - **Developer B**: User Story 2 styling tasks (T021–T029) — can begin as soon as US1 components exist
   - **Developer C**: User Story 3 (T030–T032) — can begin as soon as GameBoard exists
3. Stories complete and integrate independently.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks within the same phase.
- [Story] label maps task to specific user story for traceability.
- Each user story should be independently completable and testable.
- Verify tests fail before implementing (TDD where applicable).
- Commit after each task or logical group.
- Stop at any checkpoint to validate the story independently.
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence.
