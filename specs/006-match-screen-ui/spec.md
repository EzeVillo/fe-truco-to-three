# Feature Specification: Match Screen — UI base con datos mock

**Feature Branch**: `006-match-screen-ui`

**Created**: 2026-05-25

**Status**: Draft

**Input**: Especificar la UI base de la pantalla de partida (match) de Truco a 3. Sólo diseño visual y estructura — sin lógica de juego, WebSocket ni backend. Render con datos mock. Layout y estética derivados de `public/referencias/match.png`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visualizar el tablero base de una partida en curso (Priority: P1)

Como jugador que entra a la pantalla de match (ruta dedicada de partida), quiero ver de un vistazo dónde estoy parado: contra quién juego, cómo va el puntaje, qué cartas tengo, qué cartas ya se jugaron y qué pasa ahora. Aunque la pantalla todavía no sea interactiva, debe transmitir con claridad que es una partida de Truco en curso y respetar la composición visual de la referencia.

**Why this priority**: Es la base sobre la que se construirán todas las features futuras de match (acciones, animaciones, eventos WS). Sin esta estructura visual, no se puede avanzar con el resto del flujo de partida. Es el MVP visual.

**Independent Test**: Navegando a la ruta de match con datos mock, el jugador ve una pantalla coherente con la referencia `public/referencias/match.png`: zona del rival arriba con cartas boca abajo, zona de cartas jugadas en el centro, mano propia abajo con cartas boca arriba, panel de estado con puntaje y turno. La pantalla se entiende sin explicación como "una partida de Truco".

**Acceptance Scenarios**:

1. **Given** el usuario está autenticado y navega a la pantalla de match con datos mock cargados, **When** la pantalla termina de renderizar, **Then** ve simultáneamente: nombre propio, nombre del rival, puntaje del match, sus 3 cartas (boca arriba), las cartas del rival (boca abajo) y el área central de cartas jugadas.
2. **Given** la pantalla está renderizada en mobile (ancho 360–599 px), **When** el usuario la observa, **Then** todas las zonas principales son visibles sin scroll y respetan la jerarquía visual de la referencia (rival arriba, mesa al centro, mano propia abajo).
3. **Given** los datos mock incluyen cartas ya jugadas por ambos jugadores, **When** la pantalla renderiza, **Then** esas cartas se muestran en la zona central, en columnas/posiciones que insinúan el orden de juego del Truco (filas para el rival arriba, fila para el jugador abajo).
4. **Given** la pantalla está renderizada, **When** el usuario observa el panel de estado, **Then** lee de forma clara el puntaje actual (X – Y, hasta 3) y un texto simple del estado de la mano o turno (ej. "Tu turno", "Turno del rival", "Mano 1 de 3").

---

### User Story 2 - Reconocer instantáneamente la identidad visual del producto (Priority: P2)

Como jugador que ya conoce el resto de la app (lobby, auth, pantallas premium en verde profundo), quiero que la pantalla de match se sienta parte del mismo producto y no una pantalla genérica de Truco. Tipografía, paleta, radios, sombras y espaciados deben encajar con la estética premium que ya existe.

**Why this priority**: Refuerza la consistencia del producto. Es importante pero no bloqueante: una versión sin pulir igual funcionaría para validar la estructura, pero la pantalla de match es la pantalla central del producto y merece el cuidado visual de la referencia.

**Independent Test**: Comparando la pantalla con `public/referencias/match.png` y con otras pantallas existentes (lobby, auth), los colores, radios, tipografías y proporciones se perciben como parte de la misma familia visual. No hay elementos Material crudos sin tematizar ni colores fuera del sistema de tokens del proyecto.

**Acceptance Scenarios**:

1. **Given** la pantalla está renderizada, **When** se compara contra la referencia, **Then** la mesa usa el verde profundo característico del producto, las cartas se ven destacadas sobre la mesa con sombra/elevación sutil y el panel superior tiene jerarquía clara (nombres + puntaje + indicador de formato de serie).
2. **Given** la pantalla está renderizada, **When** se inspeccionan los estilos, **Then** todos los colores, espaciados, radios y sombras provienen de los design tokens (`var(--t3-…)`) — no hay hex hardcodeado.
3. **Given** la pantalla está renderizada en desktop (≥ 1024 px), **When** el usuario la observa, **Then** se ve cómoda y centrada, sin estirarse a ancho completo de manera que rompa las proporciones de la mesa.

---

### User Story 3 - Tener un placeholder visible para futuras acciones disponibles (Priority: P3)

Como desarrollador que continuará la feature, quiero que la pantalla deje reservada y visualmente identificada la zona donde, en una etapa posterior, aparecerán las acciones disponibles del jugador (cantos, mazo, ir al mazo, truco, envido, etc.). Esto evita rediseñar el layout en la próxima iteración.

**Why this priority**: Es un facilitador para iteraciones futuras. No aporta valor de usuario directo en esta etapa, pero ahorra retrabajo. Bajo costo, alto retorno.

**Independent Test**: La pantalla muestra una zona claramente identificable (con tamaño y posición coherentes con la referencia) destinada a alojar el panel de acciones disponibles. Esa zona renderiza un placeholder simple (ej. label "Acciones disponibles" o un contenedor visual neutro), sin implementar ningún botón funcional.

**Acceptance Scenarios**:

1. **Given** la pantalla está renderizada, **When** el usuario la observa, **Then** existe un contenedor visible reservado para "Acciones disponibles", posicionado próximo a la mano del jugador.
2. **Given** la zona de acciones existe, **When** se inspecciona, **Then** sólo contiene un placeholder visual (sin botones funcionales y sin lógica) y está documentada en el código como punto de extensión.

---

### Edge Cases

- **Sin cartas jugadas todavía**: la zona central debe seguir visible y reconocible como mesa, no debe colapsar a 0 px de alto.
- **Cartas jugadas asimétricas** (ej. el jugador jugó 1 carta, el rival ninguna): los slots vacíos deben representarse de forma sutil (silueta/marco) para que se entienda la progresión de la mano.
- **Nombres largos**: nombres de jugador/rival con más de ~14 caracteres deben truncarse con elipsis sin romper el header.
- **Ancho mínimo 360 px**: en el ancho más chico soportado, las tres cartas de la mano propia deben caber en una sola fila sin solapamiento ni scroll horizontal.
- **Puntajes en valor máximo**: el componente de puntaje debe poder renderizar dos dígitos por lado sin desbordar, aunque sólo se permitan valores 0–3.
- **Modo desktop ≥ 1024 px**: la mesa no debe estirarse hasta el ancho completo; se centra con márgenes generosos para conservar proporciones.

## Clarifications

### Session 2026-05-25

- Q: Forma del mock de estado del match (alineado con `docs/CONTRATOS_API.md` §4.14) → A: Espejar 1:1 el `MatchStateResponse` completo del contrato, incluso campos que la UI de esta etapa no muestra (`currentTrucoCall`, `availableActions`, `winner`, etc.) con valores `null`/`[]` cuando no aplique.
- Q: ¿Cómo identifica la UI qué asiento ocupa el jugador autenticado (jugador propio vs rival)? → A: El contrato `MatchStateResponse` se amplía con `viewerSeat: 'PLAYER_ONE' | 'PLAYER_TWO'` y `playerOneUsername` / `playerTwoUsername`. El mock también incluye esos campos. La derivación "jugador propio / rival" se hace 100% desde la respuesta del BE, sin recordar estado WS previo ni mirar `AuthStore`. (Cambio aplicado en `docs/CONTRATOS_API.md` §4.14; implementación en BE pendiente del owner del backend.)
- Q: ¿Cómo se expresa el formato de la serie en el snapshot del match? → A: Se agrega `gamesToPlay: 1 | 3 | 5` al `MatchStateResponse` (contrato + mock). La UI deriva la etiqueta "Mejor de N" a partir de ese número. El enum interno `BEST_OF_*` del FE queda fuera del contrato del match. (Cambio aplicado en `docs/CONTRATOS_API.md` §4.14.)
- Q: ¿De dónde sale el texto de estado del match ("Tu turno", "Mano 1 de 3", etc.)? → A: No es un campo del mock ni del contrato. La UI lo deriva como función pura sobre `currentTurn`, `roundStatus`, `playedHands` y `viewerSeat` (más `playerOneUsername`/`playerTwoUsername` para resolver el username del turno actual). El mock NO incluye ningún `statusText`/`statusLabel`.
- Q: ¿La vista cambia según el asiento del viewer? → A: No. La pantalla es **viewer-relative**: el jugador autenticado se renderiza SIEMPRE en la zona inferior (mano propia abajo) y el rival SIEMPRE en la zona superior (cartas boca abajo arriba), independientemente de si `viewerSeat` es `PLAYER_ONE` o `PLAYER_TWO`. El mismo principio aplica al área central: la fila de cartas jugadas del viewer queda más cerca de la zona inferior y la del rival más cerca de la superior. El marcador en cabecera respeta el mismo criterio: el puntaje del viewer aparece a la izquierda (o en la posición prominente definida por la referencia) y el del rival a la derecha, sin importar el seat.
- Q: ¿Cómo se organizan los fixtures del módulo de mock? → A: El módulo expone un set de fixtures named, todos con la forma `MatchStateResponse` del contrato (ej. `mockMatchViewerPlayerOne`, `mockMatchViewerPlayerTwo`, `mockMatchEmptyTable`, `mockMatchAsymmetricHand`). La `MatchScreen` renderiza por defecto `mockMatchViewerPlayerOne` (mid-game) y permite seleccionar otro fixture vía query param de la ruta (ej. `?fixture=viewer-player-two`). Sirve para validar FR-018 y los edge cases del spec en navegador sin recompilar.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La aplicación DEBE exponer una pantalla de match accesible desde una ruta dedicada y protegida por autenticación, alimentada por datos mock locales (sin llamadas HTTP ni WebSocket).
- **FR-002**: La pantalla DEBE renderizar, simultáneamente y sin scroll en mobile estándar (360–599 px de ancho), las siguientes zonas: cabecera del match, zona del rival, zona central de cartas jugadas, mano del jugador, panel de estado y placeholder de acciones disponibles.
- **FR-003**: La zona del rival DEBE mostrar el nombre/avatar del rival y sus cartas en mano representadas boca abajo (dorso), con cantidad coherente con los datos mock.
- **FR-004**: La zona del jugador DEBE mostrar el nombre del jugador actual y sus cartas en mano boca arriba, leyendo las imágenes desde `public/cards/` con el patrón `{número}_{palo}.png` (palos válidos: `copa`, `espada`, `basto`, `oro`).
- **FR-005**: La zona central de cartas jugadas DEBE representar las cartas ya jugadas en la mano actual, separando visualmente las del rival (más cerca de la zona del rival) de las del jugador (más cerca de la mano propia), con slots para hasta 3 cartas por lado (3 manos por partida).
- **FR-006**: El panel de estado del match DEBE mostrar el puntaje del match en formato "jugador X – rival Y" (cada uno entre 0 y 3, mapeado desde `scorePlayerOne`/`scorePlayerTwo` según `viewerSeat`) y un texto simple del estado actual (ej. turno o número de mano). Ese texto NO proviene de un campo del contrato/mock: la UI lo DEBE derivar como función pura sobre `currentTurn`, `roundStatus`, `playedHands.length`, `viewerSeat`, `playerOneUsername` y `playerTwoUsername`.
- **FR-007**: La cabecera DEBE indicar el formato de la serie (mejor de 1, 3 o 5) derivando la etiqueta de presentación desde `gamesToPlay` (1 | 3 | 5) del `MatchStateResponse` y, si aplica, el progreso de partidas ganadas (`gamesWonPlayerOne` / `gamesWonPlayerTwo`), en línea con `public/referencias/match.png`.
- **FR-008**: La pantalla DEBE construirse con los siguientes componentes Angular standalone, cada uno en su propio archivo, con responsabilidades acotadas: `MatchScreen`, `GameBoard`, `PlayerArea`, `OpponentArea`, `PlayedCardsArea`, `PlayerHand`, `MatchStatusPanel`, `CardView`, `PlaceholderAvailableActionsArea`.
- **FR-009**: `CardView` DEBE soportar dos modos de render: carta visible (recibe número y palo) y carta boca abajo (renderiza `public/cards/dorso.png`).
- **FR-010**: Los datos mock DEBEN vivir en un único módulo de mock dentro de la feature (no inlineados en cada componente) y DEBEN tener exactamente la forma del `MatchStateResponse` documentado en `docs/CONTRATOS_API.md` §4.14 (campos top-level: `matchId`, `status`, `viewerSeat`, `playerOneUsername`, `playerTwoUsername`, `gamesToPlay`, `scorePlayerOne`, `scorePlayerTwo`, `gamesWonPlayerOne`, `gamesWonPlayerTwo`, `matchWinner`, `roundGame`; con `roundGame` conteniendo `status`, `currentTurn`, `myCards`, `roundStatus`, `currentTrucoCall`, `winner`, `availableActions`, `playedHands`, `currentHand`). Los campos que la UI de esta etapa no renderiza (ej. `currentTrucoCall`, `availableActions`, `winner`, `matchWinner`) DEBEN estar presentes con valores `null` o `[]` según corresponda, no omitidos. El mapeo "jugador propio / rival" en la UI DEBE derivarse exclusivamente de `viewerSeat`.
- **FR-011**: La pantalla NO DEBE realizar ninguna llamada HTTP ni abrir conexiones WebSocket/STOMP en esta etapa.
- **FR-012**: La pantalla NO DEBE incluir lógica de reglas del Truco (validación de jugadas, cálculo de envido/truco, fin de partida, etc.). Cualquier interacción de botón/carta queda fuera de scope, salvo navegación trivial (volver al lobby).
- **FR-013**: El placeholder de acciones disponibles DEBE estar presente como contenedor visual con un identificador claro (clase/atributo) que permita reemplazarlo en una iteración futura sin reestructurar el layout.
- **FR-014**: Toda regla visual (color, espaciado, radio, sombra, tipografía) DEBE expresarse mediante los design tokens del proyecto (`var(--t3-…)`); está prohibido el uso de colores hexadecimales, `rgb()/rgba()/hsl()`, colores nombrados o estilos Material crudos. Esta regla la verifica `pnpm lint:styles` y `pnpm lint:themes`.
- **FR-015**: Los nombres de jugador/rival DEBEN truncarse con elipsis cuando excedan el ancho disponible, sin romper el layout de la cabecera ni de las zonas de jugador/rival.
- **FR-016**: La estructura de los componentes y de los datos mock DEBE quedar alineada con el contrato del backend documentado en `docs/CONTRATOS_API.md` (nombres de campos, formas de payload de cartas, enums de palos en mayúsculas como `ESPADA`/`COPA`/`BASTO`/`ORO`, formato de serie `BEST_OF_1|3|5`), de modo que la integración futura sea reemplazar la fuente de datos sin renombrar tipos ni componentes.
- **FR-017**: La pantalla DEBE ser usable en el ancho mínimo soportado por el proyecto (360 px) y escalar a desktop con un único breakpoint `@media (min-width: 1024px)`, sin agregar sub-breakpoints ni media queries de `max-height`.
- **FR-018**: La pantalla DEBE ser **viewer-relative**: el jugador autenticado se renderiza SIEMPRE en la zona inferior (mano propia abajo, fila de cartas jugadas propias más cerca del borde inferior) y el rival SIEMPRE en la zona superior (cartas boca abajo arriba, fila de cartas jugadas del rival más cerca del borde superior), **independientemente** de si `viewerSeat` es `PLAYER_ONE` o `PLAYER_TWO`. El marcador y todas las etiquetas de "yo / rival" DEBEN respetar el mismo criterio: la vista del jugador 2 es visualmente idéntica a la del jugador 1, sólo cambian los datos.
- **FR-019**: El módulo de mock DEBE exponer múltiples fixtures con nombre (mínimo: `mockMatchViewerPlayerOne` mid-game, `mockMatchViewerPlayerTwo` mid-game, `mockMatchEmptyTable` sin cartas jugadas, `mockMatchAsymmetricHand` con jugadas asimétricas), todos con la forma exacta del `MatchStateResponse` del contrato. La `MatchScreen` DEBE renderizar `mockMatchViewerPlayerOne` por defecto y permitir cambiar el fixture vía query param de la ruta (ej. `?fixture=viewer-player-two`). El selector NO requiere UI visible: alcanza con que un evaluador pueda cambiar la URL y ver otro escenario para validar FR-018 y los edge cases.

### Key Entities *(include if feature involves data)*

- **Match (vista)**: Representación visual del estado de una partida. Atributos visibles: jugador propio, rival, formato de serie, puntaje, lista de cartas jugadas, estado textual.
- **Player (vista)**: Identidad mostrada en pantalla para jugador o rival. Atributos: nombre, avatar/iniciales. Las cartas del jugador propio se muestran visibles; las del rival, sólo cantidad (boca abajo).
- **Card (vista)**: Carta española. Atributos: número (1–7, 10–12) y palo (`ESPADA`, `COPA`, `BASTO`, `ORO`). En modo oculto se renderiza con dorso, sin atributos.
- **Played Card Slot**: Posición en el área central que aloja una carta jugada por uno de los jugadores en una mano determinada. Hasta 6 slots (3 por jugador) durante una partida.
- **Match Status (vista)**: Texto descriptivo simple del estado actual ("Tu turno", "Turno del rival", "Mano 1 de 3", etc.). NO es un campo del contrato ni del mock: se deriva como función pura en la UI a partir de `currentTurn`, `roundStatus`, `playedHands.length`, `viewerSeat` y los usernames de cada asiento.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los usuarios internos que vean la pantalla por primera vez la identifican como "una partida de Truco en curso" sin explicación previa.
- **SC-002**: La pantalla renderiza por completo en menos de 1 segundo desde la navegación a la ruta, en mobile estándar, sin parpadeos ni saltos de layout perceptibles.
- **SC-003**: En el ancho mínimo soportado (360 px), todas las zonas principales (cabecera, rival, mesa, mano, estado, placeholder de acciones) son visibles sin scroll vertical involuntario y sin scroll horizontal.
- **SC-004**: Una comparación visual lado a lado con `public/referencias/match.png` muestra coincidencia clara en: ubicación del rival arriba, mesa central, mano abajo, panel superior con puntaje y formato de serie. Cualquier evaluador del equipo confirma la relación "evolución directa de la referencia" en menos de 10 segundos.
- **SC-005**: `pnpm lint:styles` y `pnpm lint:themes` pasan sin errores sobre los archivos de la feature.
- **SC-006**: La feature queda lista para que el siguiente iterador reemplace los datos mock por la fuente real (REST + WebSocket) y agregue el panel de acciones disponibles sin necesidad de reestructurar el layout ni renombrar componentes.

## Assumptions

- La ruta de match se monta sobre el sistema de routing ya existente y queda detrás del `authGuard`.
- Los datos mock representan un estado intermedio de partida verosímil (algunas cartas jugadas, otras no) para ejercitar todos los slots visuales.
- El idioma de la UI es español (alineado con el proyecto). Los textos de estado del mock se escriben en español.
- Los tipos TypeScript usados en los componentes y en el mock pueden reutilizar los modelos existentes de `core/models/match.models.ts` cuando aplique, o definir tipos locales de presentación con los mismos nombres de campo que el contrato, para minimizar refactor en la integración futura.
- La pantalla soporta sólo mobile portrait y desktop ≥ 1024 px. No se contempla landscape en mobile.
- El modo 1v1 (jugador vs bot/rival único) es el único contemplado, en línea con el alcance actual del producto (lobby vs bots).
- No se requiere accesibilidad WAI-ARIA exhaustiva en esta etapa, pero los textos clave (nombres, puntaje, estado) DEBEN ser leíbles por screen readers (no estar embebidos en imágenes).
- Las imágenes de cartas en `public/cards/` ya están disponibles con el patrón `{número}_{palo}.png` y `dorso.png`, según convenciones del proyecto.
