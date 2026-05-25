# Feature Specification: Corrección de Lobby vs Bots y Guardarraíles de Consistencia

**Feature Branch**: `004-lobby-bots-fixes`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "no se respeto para nada la paleta de colores que se tenia en el proyecto en el ultimo plan, el boton para jugar contra bots, es enorme, tiene un titulo y una descripcion que estan pegados, uno al lado del otro, ademas el endpoint de crear el match esta fallando porque no se respeta el contrato, quiero no solo que soluciones esto, sino que no vuelva a pasar"

## Clarifications

### Session 2026-05-24

- Q: ¿Qué valores de `gamesToPlay` acepta hoy el backend de `POST /api/matches/bot` para BEST_OF_1 / BEST_OF_3 / BEST_OF_5? → A: Games-to-play literales **1 / 3 / 5**. Evidencia: respuesta del backend `InvalidGamesToPlayException` — `"gamesToPlay must be one of: 1, 3, 5, but was: 2"` (requestId `9aa17514-9330-4a73-9637-8ffef3f428c9`, 2026-05-24T22:51:21Z). El mapeo actual del cliente (`BEST_OF_3 → 2`) es la causa raíz del fallo. La descripción "partidas a ganar" en `docs/CONTRATOS_API.md §9.2` está desalineada con el comportamiento real del backend y debe corregirse a "partidas totales (mejor de N)".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El CTA "Jugar contra bots" se ve fiel al diseño del producto (Priority: P1)

Un jugador que entra al lobby ve el acceso para jugar contra bots presentado con el mismo lenguaje visual que el resto del producto (colores verdes y dorados de marca, tipografía y espaciados consistentes). El botón tiene un tamaño razonable para mobile y desktop, con su título y su descripción claramente apilados verticalmente y separados con aire suficiente para leerse sin esfuerzo.

**Why this priority**: La primera pantalla post-login del modo principal de juego es la cara visible del producto. Una pieza visualmente rota mina la percepción de calidad de toda la feature de lobby ya entregada.

**Independent Test**: Abrir `/lobby` en mobile (360 px) y desktop (≥ 1024 px) y verificar que el CTA usa los tokens de la paleta (`--t3-green-*`, `--t3-gold-*`), no ocupa más del ancho útil definido por el layout del lobby, y que el título y la descripción están en líneas separadas con separación visible entre sí.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado en `/lobby` en mobile 360×780, **When** observa el CTA "Jugar contra bots", **Then** el botón tiene una altura cómoda (no excede ~25% del alto visible del contenido del lobby), título y descripción aparecen en dos líneas distintas con un espacio vertical perceptible (no pegados), y los colores usados son los de la paleta de marca declarada en los design tokens.
2. **Given** el mismo usuario en desktop 1440×900, **When** observa el CTA, **Then** el botón mantiene proporciones equilibradas dentro del ancho del lobby, conserva la jerarquía título/descripción en líneas separadas y reutiliza los tokens de color y radios del sistema.
3. **Given** un revisor inspecciona los estilos del CTA, **When** busca valores de color, **Then** no encuentra hex codes hardcodeados; todos los colores se resuelven vía `var(--t3-…)`.

---

### User Story 2 - Crear partida vs bot funciona end-to-end respetando el contrato del backend (Priority: P1)

Un jugador elige un bot y un formato de serie y presiona "Jugar". El backend acepta la solicitud, devuelve un `matchId` válido y el jugador es navegado a la pantalla de la partida. No hay error del lado del servidor por payload inválido.

**Why this priority**: Es la acción final de la feature de lobby vs bots. Si falla, la feature entera no entrega valor independientemente de cuán pulida esté la UI.

**Independent Test**: Desde `/lobby/bots`, seleccionar un bot, mantener el formato por defecto (mejor de 3), presionar el CTA de crear partida y verificar que la request a `POST /api/matches/bot` retorna `200` con un `matchId` y que el cliente navega a la vista de partida.

**Acceptance Scenarios**:

1. **Given** un usuario sin partida activa en `/lobby/bots`, **When** confirma la creación con bot X y formato "Mejor de 3", **Then** el cliente envía exactamente el payload que el backend documenta como válido para ese formato y recibe `200 { matchId }`.
2. **Given** el backend responde `422` por "ya tiene una partida activa", **When** el cliente recibe el error, **Then** se muestra un mensaje accionable del catálogo de copy del front (no se renderiza `ApiError.message` crudo) y el jugador puede reintentar o navegar a la partida activa.
3. **Given** el backend responde `404` por `botId` inexistente, **When** el cliente recibe el error, **Then** se invalida la selección y se invita al jugador a refrescar el catálogo de bots.

---

### User Story 3 - Guardarraíles para que estos defectos no vuelvan a ocurrir (Priority: P1)

El equipo (y futuras corridas de Spec Kit) cuenta con reglas y verificaciones automatizadas que detectan: (a) uso de colores hardcodeados fuera de los design tokens, (b) divergencias entre los tipos/cliente del front y los contratos del backend en `docs/CONTRATOS_API.md`, y (c) componentes nuevos cuyo layout viola las pautas de jerarquía/tamaño (p. ej. título y descripción en la misma línea cuando el diseño dictamina apilarlos).

**Why this priority**: El usuario pidió explícitamente que "no vuelva a pasar". Sin guardarraíles, el mismo defecto reaparece en la próxima iteración.

**Independent Test**: Introducir deliberadamente en una rama de prueba (a) un `color: #fff` hardcodeado en un SCSS de feature, (b) un payload de creación de match con un campo extra que no figura en el contrato, y (c) una rejilla horizontal en un CTA pensado vertical. Las tres modificaciones deben ser bloqueadas por las verificaciones del proyecto (lint, test, o gate documentado en CLAUDE.md / constitution) antes de mergear.

**Acceptance Scenarios**:

1. **Given** un desarrollador agrega un hex code fuera de `src/styles.scss` (donde se declaran los tokens), **When** corre `pnpm lint` o el CI, **Then** la verificación falla con un mensaje que apunta al token equivalente.
2. **Given** un desarrollador modifica `CreateBotMatchRequest` con un campo que no existe en `docs/CONTRATOS_API.md`, **When** corre la suite de tests del contrato, **Then** la verificación falla señalando la divergencia.
3. **Given** Spec Kit ejecuta `/speckit-plan` para una nueva feature de UI, **When** revisa el checklist generado, **Then** el plan incluye explícitamente puntos obligatorios sobre uso de design tokens y validación cruzada del contrato del backend, derivados del documento de constitution/CLAUDE.md.

---

### Edge Cases

- ¿Qué muestra la UI si el catálogo de bots está vacío al entrar a `/lobby/bots`? (estado vacío con mensaje y reintento; sin crash).
- ¿Qué pasa si el usuario presiona "Jugar" dos veces seguidas? (la segunda invocación debe quedar inhibida hasta resolver la primera, sin duplicar matches en el backend).
- ¿Qué pasa si el WebSocket está caído al momento de crear el match? (el match se crea por REST igual; la UI debe avisar de la desconexión y reintentar la suscripción a `/user/queue/match` antes de habilitar la vista de partida).
- ¿Qué pasa en mobile 360 px si el nombre de un bot es muy largo? (el texto debe truncar o wrappear sin romper el alto del CTA ni desbordar el card).
- ¿Qué pasa si el backend responde `200` con un `matchId` malformado (no UUID)? (el cliente trata la respuesta como error y muestra mensaje genérico del catálogo).

## Requirements *(mandatory)*

### Functional Requirements

**FR — UI del lobby vs bots**

- **FR-001**: El CTA "Jugar contra bots" en `/lobby` DEBE consumir exclusivamente los design tokens declarados en `src/styles.scss` (`--t3-green-*`, `--t3-gold-*`, `--t3-text*`, `--t3-radius-*`, `--t3-gap-*`, `--t3-shadow-*`). No se permiten valores de color, radio ni sombra hardcodeados en el SCSS del componente.
- **FR-002**: El CTA "Jugar contra bots" DEBE mostrar el título y la descripción apilados verticalmente (no en la misma línea) con un espacio vertical perceptible entre ambos (no menor a `--t3-gap-xs` y consistente con la escala del proyecto).
- **FR-003**: El alto del CTA en mobile (360 px) NO DEBE superar el equivalente a dos líneas de texto + padding interno (≤ ~96 px) y NO DEBE provocar scroll dentro del lobby cuando es el único contenido visible.
- **FR-004**: En desktop (≥ 1024 px), el CTA DEBE respetar el ancho máximo del contenedor `lobby__inner` (640 px) y mantener proporciones equivalentes a un botón primario del sistema (no ocupar todo el alto del viewport).
- **FR-005**: Los textos del CTA DEBEN truncar o wrappear cuando excedan el ancho disponible sin romper la altura mínima ni desbordar horizontalmente en 360 px.

**FR — Creación de partida vs bot**

- **FR-006**: El cliente DEBE enviar a `POST /api/matches/bot` un payload que coincida exactamente con el contrato vigente documentado en `docs/CONTRATOS_API.md §9.2` (campos `botId` y `gamesToPlay`, sin campos extra).
- **FR-007**: El cliente DEBE enviar `gamesToPlay` como el **total de partidas de la serie** (games-to-play), no como partidas a ganar. El mapeo válido y único es: `BEST_OF_1 → 1`, `BEST_OF_3 → 3`, `BEST_OF_5 → 5`. Cualquier otro valor (en particular `2`) provoca `422 InvalidGamesToPlayException` y NO debe emitirse desde el cliente. La función `seriesFormatToGamesToPlay` y los tipos de `CreateBotMatchRequest` (`gamesToPlay: 1 | 3 | 5`) DEBEN actualizarse en consecuencia, junto con los tests que dependen del mapeo viejo.
- **FR-007a**: Como parte de esta feature DEBE corregirse `docs/CONTRATOS_API.md §9.2` para que la descripción del campo `gamesToPlay` diga "Partidas totales de la serie (mejor de N); valores válidos: 1, 3, 5" en lugar de "Partidas a ganar para terminar el match". Esta corrección es parte de FR-013 (registro de divergencias contrato↔backend).
- **FR-008**: Ante respuesta `200`, el cliente DEBE navegar a la ruta de la partida usando el `matchId` recibido. Ante `4xx`, NO DEBE navegar y DEBE renderizar un mensaje del catálogo de copy del front mapeado por código de error (nunca mostrar `ApiError.message` crudo).
- **FR-009**: El botón "Jugar" en `/lobby/bots` DEBE quedar inhabilitado mientras una solicitud de creación está en vuelo para impedir doble submit.

**FR — Guardarraíles anti-regresión**

- **FR-010**: El proyecto DEBE incluir una verificación automática (lint rule, test, o script de CI) que falle el build si un archivo `.scss` fuera de `src/styles.scss` introduce colores en formato hex/rgb/hsl literales, exigiendo el uso de `var(--t3-…)`.
- **FR-011**: El proyecto DEBE incluir un test de contrato que verifique que cada request DTO usado contra el backend (empezando por `CreateBotMatchRequest`) coincide en nombre de campos y tipos con la sección correspondiente de `docs/CONTRATOS_API.md`. La verificación falla si hay campos extra, faltantes o renombrados.
- **FR-012**: El documento del proyecto que guía a Claude (`CLAUDE.md`) y la constitution del Spec Kit DEBEN reflejar como reglas explícitas: (a) "todo color/espaciado/radio/sombra en SCSS de feature pasa por un token `--t3-…`", (b) "antes de tipar o consumir un endpoint, validar campo a campo contra `docs/CONTRATOS_API.md`", y (c) "los CTAs con título + descripción se apilan verticalmente salvo que el diseño explícito indique lo contrario". Estas reglas deben ser referenciadas desde los templates de plan/tasks del Spec Kit para que aparezcan en los checklists de futuras features.
- **FR-013**: Cualquier hallazgo de divergencia entre el front y `docs/CONTRATOS_API.md` que requiera cambio de contrato DEBE quedar registrado en el repo (issue, TODO con referencia, o sección en el spec/plan) en lugar de resolverse silenciosamente en el cliente.

### Key Entities *(include if data involved)*

- **Design tokens (`--t3-…`)**: Conjunto de CSS custom properties declaradas en `:root` dentro de `src/styles.scss`. Son la única fuente legítima de colores, radios, espaciados y sombras consumidos por SCSS de feature.
- **`CreateBotMatchRequest` / `CreateBotMatchResponse`**: DTOs del cliente que reflejan el contrato `POST /api/matches/bot` del backend. Deben mantenerse en paridad estricta con `docs/CONTRATOS_API.md §9.2`.
- **Catálogo de copy de errores**: Mapeo del front desde códigos de `ApiError` a mensajes localizados al español; única fuente para mostrar errores en la UI.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Inspección visual y auditoría de SCSS muestran **0** hex codes o colores literales en los archivos SCSS de `src/app/features/lobby/**`; el **100%** de las referencias de color resuelven a `var(--t3-…)`.
- **SC-002**: En mobile 360 px, el CTA "Jugar contra bots" ocupa **≤ 96 px** de alto y muestra título y descripción en **2 líneas separadas** con separación vertical no nula; el lobby no requiere scroll cuando ese es el único contenido.
- **SC-003**: La tasa de éxito (HTTP 200) de `POST /api/matches/bot` desde el cliente con un bot válido y el formato por defecto es **100%** en pruebas manuales y en la suite de integración del front. En particular, el payload enviado para "mejor de 3" contiene `gamesToPlay: 3` (no `2`) y deja de producir `InvalidGamesToPlayException`.
- **SC-004**: Un test de contrato automático rompe cuando se introduce intencionalmente (en una rama de verificación) un campo extra o renombrado en `CreateBotMatchRequest`. Esto se demuestra al menos una vez antes del cierre.
- **SC-005**: Una verificación de lint/CI rompe cuando se introduce intencionalmente un `color: #ffffff` en un SCSS de feature fuera de `src/styles.scss`. Esto se demuestra al menos una vez antes del cierre.
- **SC-006**: `CLAUDE.md` y los artefactos del Spec Kit (constitution o templates de plan/tasks) incluyen, después de esta feature, secciones explícitas y referenciables sobre (a) consumo obligatorio de design tokens, (b) validación cruzada con `docs/CONTRATOS_API.md`, y (c) jerarquía vertical por defecto en CTAs con título + descripción.

## Assumptions

- La paleta y los design tokens vigentes (`src/styles.scss`) son la fuente correcta de verdad; cualquier desacuerdo de marca se resuelve actualizando los tokens, no introduciendo hex codes en componentes.
- `docs/CONTRATOS_API.md` es la fuente autoritativa del contrato del backend (según `CLAUDE.md`). Si el backend diverge de la doc en runtime, la doc se actualiza para reflejar el comportamiento real y el cliente se alinea con ese comportamiento.
- El catálogo de copy de errores del front ya existe o se crea en esta feature como parte de FR-008 (consistente con la memoria `error_messaging.md`).
- "Mejor de 3" sigue siendo el formato por defecto del selector de serie (consistente con `game_rules.md` y la spec 003).
- El layout del lobby (`lobby__inner` con `max-width: 480px` mobile / `640px` desktop) se conserva como contenedor; sólo cambia el styling y la estructura del CTA dentro de él.
- Las verificaciones automatizadas (lint para colores, test de contrato para DTOs) pueden implementarse con las herramientas ya presentes en el stack (ESLint con regla custom o stylelint para colores; Vitest + parsing del markdown del contrato para DTOs). No se introducen nuevas dependencias mayores sin justificación explícita en el plan.
